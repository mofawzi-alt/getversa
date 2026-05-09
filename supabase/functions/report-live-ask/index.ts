// Report a Live Ask. 3 reports auto-collapse via DB trigger.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: 'Unauthorized' }, 401);

    const { live_ask_id, reason, notes } = await req.json().catch(() => ({} as any));
    if (!live_ask_id || !reason) return json({ error: 'live_ask_id and reason required' }, 400);

    const { error } = await userClient.from('live_ask_reports').insert({
      live_ask_id,
      reporter_id: u.user.id,
      reason: String(reason).slice(0, 60),
      notes: notes ? String(notes).slice(0, 500) : null,
    });
    if (error) {
      if (String(error.message).includes('duplicate')) return json({ ok: true, already_reported: true });
      throw error;
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
