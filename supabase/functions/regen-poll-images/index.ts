import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT_TPL = (subject: string, question: string, otherOption: string) =>
  `Cinematic lifestyle photograph for a poll question: "${question}". This image represents the option "${subject}" (vs. the other option "${otherOption}"). Show ONE Gen Z person performing the EXACT real-life behavior associated with choosing "${subject}" in this context. The behavior must be obvious in under 1 second; this is the user's "this is me" moment.

CRITICAL BRAND HANDLING: If "${subject}" is a brand name, product name, app, or proper noun, DO NOT show that brand's product, packaging, logo, wordmark, color scheme, or any identifying detail. Instead, depict the GENERIC real-life behavior or lifestyle of someone who would choose that brand in the context of "${question}". Examples: "Dyson" in a vacuum question → young person casually vacuuming a modern apartment with a generic unbranded cordless stick vacuum. "Netflix" → person on couch watching a generic screen, no UI visible. "Talabat" → person receiving a plain unbranded food bag at the door. "iPhone" → person using a generic black smartphone with no visible logo or UI. The brand must be UNRECOGNIZABLE in the final image.

WHO (mandatory): ONE visible human subject aged 18–30, modern Gen Z appearance, casual trendy 2026 clothing, natural and expressive. NO older subjects, NO formal/corporate styling, NO empty scenes without a person.

WHERE: realistic 2026 environment — modern apartment, cafe, Cairo / MENA street, university, or co-working / social space. Use Egyptian / Middle-Eastern context when culturally relevant. NO outdated interiors, NO generic Western stock backgrounds.

ACTION (critical): the subject must be visibly DOING the behavior — e.g. paying with phone for "mobile wallet", handing cash for "cash", eating with friends for "orders often", solo home meal for "rarely orders", inside a car for "private car", in a crowded bus/train for "public transport", watching screen with screen-light on face for streaming.

VIBE: candid, natural, slightly imperfect, social, expressive — NOT posed, NOT polished advertising, NOT stock-photo perfect.

STYLE: real DSLR / mirrorless photography, cinematic high-contrast lighting, close-up immersive framing, shallow depth of field, ONE clear subject, no clutter, vertical 9:16, TikTok / Instagram aesthetic, magazine-grade.

STRICTLY FORBIDDEN: NO logos, NO brand names, NO wordmarks, NO typography, NO text of any kind, NO app interfaces, NO UI screenshots, NO phone-app mockups, NO collages, NO split visuals, NO posters, NO graphics, NO illustrations, NO 3D renders, NO abstract or symbolic visuals, NO watermarks, NO borders, NO product packaging with visible labels, NO recognizable product silhouettes that identify a specific brand.`;

function slugify(s: string) {
  return (s.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30).replace(/^_|_$/g, '')) || 'img';
}

async function genImage(apiKey: string, prompt: string): Promise<Uint8Array | null> {
  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-3.1-flash-image-preview',
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    }),
  });
  if (!r.ok) { console.log('gen fail', r.status, await r.text().catch(()=>'')); return null; }
  const d = await r.json();
  const url = d.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) return null;
  const m = url.match(/^data:image\/\w+;base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function processOne(supabase: any, apiKey: string, poll: any) {
  const [a, b] = await Promise.all([
    genImage(apiKey, PROMPT_TPL(poll.option_a, poll.question, poll.option_b)),
    genImage(apiKey, PROMPT_TPL(poll.option_b, poll.question, poll.option_a)),
  ]);
  if (!a || !b) return { id: poll.id, status: 'gen_failed' };
  const short = poll.id.slice(0, 8);
  const pa = `regen/${short}_a_${slugify(poll.option_a)}.png`;
  const pb = `regen/${short}_b_${slugify(poll.option_b)}.png`;
  const [ua, ub] = await Promise.all([
    supabase.storage.from('poll-images').upload(pa, a, { contentType: 'image/png', upsert: true }),
    supabase.storage.from('poll-images').upload(pb, b, { contentType: 'image/png', upsert: true }),
  ]);
  if (ua.error || ub.error) return { id: poll.id, status: 'upload_failed', err: ua.error?.message || ub.error?.message };
  const urlA = supabase.storage.from('poll-images').getPublicUrl(pa).data.publicUrl;
  const urlB = supabase.storage.from('poll-images').getPublicUrl(pb).data.publicUrl;
  const { error } = await supabase.from('polls').update({ image_a_url: urlA, image_b_url: urlB }).eq('id', poll.id);
  if (error) return { id: poll.id, status: 'db_failed', err: error.message };
  return { id: poll.id, status: 'ok' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const apiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const { polls } = await req.json(); // [{id, option_a, option_b}]
    if (!Array.isArray(polls) || polls.length === 0) {
      return new Response(JSON.stringify({ error: 'no polls' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Process in parallel batches of 3 for stability
    const results: any[] = [];
    for (let i = 0; i < polls.length; i += 3) {
      const batch = polls.slice(i, i + 3);
      const r = await Promise.all(batch.map(p => processOne(supabase, apiKey, p).catch(e => ({ id: p.id, status: 'error', err: String(e) }))));
      results.push(...r);
    }
    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
