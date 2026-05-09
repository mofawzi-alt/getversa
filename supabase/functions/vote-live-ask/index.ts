// Cast a vote on a Live Ask. Snapshots voter demographics (gender, age, city, country)
// + taste_archetype + personality_type + decision time. Computes is_targeted_match
// against the asker's targeting filters — the most valuable B2B field in the schema.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: 'Unauthorized' }, 401);
    const userId = u.user.id;

    const { live_ask_id, choice, session_duration_ms } = await req.json().catch(() => ({} as any));
    if (!live_ask_id || !['A', 'B'].includes(choice)) return json({ error: 'bad input' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch Live Ask + voter profile in parallel
    const [askRes, profileRes] = await Promise.all([
      admin.from('live_asks').select('id, status, asker_id, reveal_at, target_gender, target_age_ranges, target_cities, target_countries').eq('id', live_ask_id).maybeSingle(),
      admin.from('users').select('id, gender, age_range, city, country').eq('id', userId).maybeSingle(),
    ]);

    const ask = askRes.data;
    const prof = profileRes.data;
    if (!ask) return json({ error: 'live ask not found' }, 404);
    if (ask.status !== 'active') return json({ error: 'live ask not active' }, 410);
    if (ask.reveal_at && new Date(ask.reveal_at).getTime() <= Date.now()) {
      return json({ error: 'voting window closed' }, 410);
    }
    if (ask.asker_id === userId) return json({ error: 'cannot vote on your own live ask' }, 403);
    if (!prof) return json({ error: 'profile not found' }, 404);

    // Optional taste/personality lookup (these tables may exist separately; tolerate absence)
    let taste_archetype: string | null = null;
    let personality_type: string | null = null;
    try {
      const { data: tp } = await admin.from('taste_profiles').select('archetype').eq('user_id', userId).maybeSingle();
      taste_archetype = (tp as any)?.archetype ?? null;
    } catch (_) { /* table optional */ }
    try {
      const { data: pt } = await admin.from('personality_results').select('type_code').eq('user_id', userId).maybeSingle();
      personality_type = (pt as any)?.type_code ?? null;
    } catch (_) { /* table optional */ }

    // is_targeted_match: voter satisfies every set targeting filter
    const matchGender = !ask.target_gender || ask.target_gender === prof.gender;
    const matchAge = !ask.target_age_ranges || (ask.target_age_ranges as string[]).includes(prof.age_range ?? '');
    const matchCity = !ask.target_cities || (ask.target_cities as string[]).includes(prof.city ?? '');
    const matchCountry = !ask.target_countries || (ask.target_countries as string[]).includes(prof.country ?? '');
    const is_targeted_match = matchGender && matchAge && matchCity && matchCountry;

    const { error: vErr } = await admin.from('live_ask_votes').insert({
      live_ask_id,
      user_id: userId,
      choice,
      voter_gender: prof.gender,
      voter_age_range: prof.age_range,
      voter_city: prof.city,
      voter_country: prof.country,
      taste_archetype,
      personality_type,
      session_duration_ms: typeof session_duration_ms === 'number' ? session_duration_ms : null,
      is_targeted_match,
    });
    if (vErr) {
      if (String(vErr.message).includes('duplicate')) return json({ error: 'already voted' }, 409);
      throw vErr;
    }

    return json({ ok: true, is_targeted_match });
  } catch (e) {
    console.error('vote-live-ask error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
