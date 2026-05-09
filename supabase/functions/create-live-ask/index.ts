// Create a Live Ask. Validates auth, 30-day account age, weekly rate limit (1 free / week,
// 2nd costs 5 ask_credits), runs a Gemini Vision safety pre-check on the photo,
// then inserts the live_asks row.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FREE_PER_WEEK = 1;
const PAID_COST = 5;
const ACCOUNT_AGE_MIN_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: 'Unauthorized' }, 401);
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const { photo_url, question, option_a, option_b, target_gender, target_age_ranges, target_cities, target_countries } = body || {};

    if (!photo_url || typeof photo_url !== 'string') return json({ error: 'photo_url required' }, 400);
    if (!question || question.length < 3 || question.length > 140) return json({ error: 'question 3-140 chars' }, 400);
    if (!option_a || !option_b) return json({ error: 'options required' }, 400);
    if (option_a.length > 40 || option_b.length > 40) return json({ error: 'options max 40 chars' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load profile + counters
    const { data: profile, error: pErr } = await admin
      .from('users')
      .select('id, ask_credits, created_at, live_asks_used_this_week, live_ask_week_start, live_ask_unlocked_at')
      .eq('id', userId)
      .maybeSingle();
    if (pErr || !profile) return json({ error: 'profile not found' }, 404);

    // Account age gate
    const ageDays = (Date.now() - new Date(profile.created_at).getTime()) / 86_400_000;
    const unlockedManually = profile.live_ask_unlocked_at && new Date(profile.live_ask_unlocked_at).getTime() <= Date.now();
    if (ageDays < ACCOUNT_AGE_MIN_DAYS && !unlockedManually) {
      return json({ error: 'Account must be at least 30 days old to create a Live Ask', code: 'ACCOUNT_TOO_NEW' }, 403);
    }

    // Weekly window (Monday-anchored ISO week start)
    const now = new Date();
    const dow = (now.getUTCDay() + 6) % 7; // 0 = Mon
    const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow));
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    let used = profile.live_asks_used_this_week ?? 0;
    if (profile.live_ask_week_start !== weekStartStr) used = 0;

    const isPaid = used >= FREE_PER_WEEK;
    if (isPaid && (profile.ask_credits ?? 0) < PAID_COST) {
      return json({ error: `Need ${PAID_COST} credits for a 2nd Live Ask this week`, code: 'INSUFFICIENT_CREDITS' }, 402);
    }

    // Gemini Vision safety check
    let visionResult: any = { skipped: !LOVABLE_API_KEY };
    if (LOVABLE_API_KEY) {
      let rawContent = '';
      try {
        const visionResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a content safety classifier for a MENA-region social app where users ask "should I post this / buy this / wear this?". ALLOW: outfits, products, food (no alcohol), interiors, scenery, pets, hands holding objects, mirror selfies showing outfits — including the asker\'s own face. REJECT only if the image clearly contains: nudity or sexual content, alcohol (wine, beer, cocktails, liquor), recognizable celebrity or politician faces, political or hate symbols, graphic violence, or a large prominent third-party brand logo as the MAIN subject. Reply ONLY with JSON: {"safe": boolean, "reasons": string[]}. If safe, reasons must be [].',
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: `Question: ${question}` },
                  { type: 'image_url', image_url: { url: photo_url } },
                ],
              },
            ],
            response_format: { type: 'json_object' },
          }),
        });
        const visionJson = await visionResp.json();
        rawContent = visionJson?.choices?.[0]?.message?.content ?? '';
        console.log('[vision] status', visionResp.status, 'content:', rawContent);
        const m = String(rawContent).match(/\{[\s\S]*\}/);
        const parsed = m ? JSON.parse(m[0]) : null;
        if (parsed && typeof parsed === 'object') {
          const safe = parsed.safe === true || parsed.safe === 'true' || parsed.is_safe === true || parsed.approved === true;
          visionResult = { safe, reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [], raw: rawContent };
        } else {
          visionResult = { safe: false, reasons: ['parse_failed'], raw: rawContent };
        }
      } catch (e) {
        console.error('vision check failed', e);
        visionResult = { safe: false, reasons: ['vision_error'], raw: rawContent };
      }
      if (!visionResult.safe) {
        console.log('[vision] rejected:', JSON.stringify(visionResult));
        return json({
          error: 'Photo failed safety check',
          reasons: visionResult.reasons?.length ? visionResult.reasons : ['model flagged image without specific reasons — try a different photo (no alcohol, no celebrity faces, no large logos)'],
          raw: visionResult.raw,
          code: 'PHOTO_REJECTED',
        }, 422);
      }
    }

    // Insert
    const { data: ask, error: insErr } = await admin
      .from('live_asks')
      .insert({
        asker_id: userId,
        photo_url,
        question,
        option_a,
        option_b,
        target_gender: target_gender || null,
        target_age_ranges: Array.isArray(target_age_ranges) && target_age_ranges.length ? target_age_ranges : null,
        target_cities: Array.isArray(target_cities) && target_cities.length ? target_cities : null,
        target_countries: Array.isArray(target_countries) && target_countries.length ? target_countries : null,
        vision_check: visionResult,
        is_paid: isPaid,
        credits_charged: isPaid ? PAID_COST : 0,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    // Update counters + charge credits
    const updates: Record<string, unknown> = {
      live_asks_used_this_week: used + 1,
      live_ask_week_start: weekStartStr,
    };
    if (isPaid) updates.ask_credits = (profile.ask_credits ?? 0) - PAID_COST;
    await admin.from('users').update(updates).eq('id', userId);

    return json({ live_ask: ask, charged: isPaid ? PAID_COST : 0 });
  } catch (e) {
    console.error('create-live-ask error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
