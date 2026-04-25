import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Heuristic: detect product/brand vs behavior options
function isProductOrBrand(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  // Multi-word phrases that read like behaviors usually contain verbs/spaces > 3 words
  const wordCount = t.split(/\s+/).length;
  if (wordCount >= 4) return false;
  // Capitalized proper noun, or single short token (typical brand/product)
  const firstChar = t[0];
  const looksProper = firstChar === firstChar.toUpperCase() && /[A-Za-z]/.test(firstChar);
  return looksProper && wordCount <= 3;
}

const PROMPT_TPL = (subject: string, question: string, otherOption: string) => {
  const isProduct = isProductOrBrand(subject) && isProductOrBrand(otherOption);
  const mode = isProduct ? 'HYBRID' : 'LIFESTYLE';

  const hybridBlock = `MODE: HYBRID (product-in-context). Show ONE Gen Z person actively USING, HOLDING, OPENING, EATING, DRINKING, OR INTERACTING WITH a generic version of the product "${subject}" inside a real-life moment that ALSO matches the question topic "${question}". The product must be CLEARLY VISIBLE and recognizable as the correct CATEGORY (e.g. soda can, chocolate bar, food delivery bag, smartphone, sneakers) but with NO logos, NO wordmarks, NO brand colors, NO packaging text. The human interaction is mandatory — never a static product-only shot.`;

  const lifestyleBlock = `MODE: LIFESTYLE (behavior). The QUESTION is "${question}" and this option means "${subject}". You MUST visually depict the literal subject of the QUESTION as performed/embodied by the option "${subject}". Derive the EXACT action from the question itself, not from generic lifestyle tropes.

ACTION DERIVATION RULES (read the question literally):
- "exercise/workout/gym" → person actively working out (running, lifting weights, yoga, jogging on street, gym session). "Yes/regularly" = mid-action sweaty energetic shot at gym/park. "No/rarely" = person on couch with phone, sedentary, snacking — NOT cooking, NOT food.
- "cook/cooking" → person at stove/cutting board with ingredients
- "smoke/smoking" → person holding/lighting a cigarette
- "study/studying" → person with books/laptop focused
- "sleep early/late" → bed scene with appropriate lighting (dark vs sunrise)
- "travel" → airport, suitcase, passport, plane window
- "social media/scrolling" → close-up of phone screen reflection on face
- "morning routine" → bathroom mirror, coffee, getting ready

NEVER substitute the action with food/delivery/shopping unless the question is literally about food/delivery/shopping. The question topic is the law.

WHO: ONE visible human aged 18–30, modern Gen Z appearance, casual trendy 2026 clothing (oversized tees, cargos, layered jewelry, modern hairstyles), natural expression — reacting, thinking, choosing, or enjoying. NO older subjects. NO corporate/formal styling. NO posed stock-photo neutrality.

WHERE: realistic 2026 environment — modern Cairo / MENA apartment, rooftop, cafe, university, street, or social hangout. Culturally grounded when relevant. NO outdated interiors, NO western generic stock backdrops.

VISUAL CONTRAST RULES (must differ from the paired image in at least 3 of): lighting temperature, location, camera framing (close vs wide), facial emotion, activity energy, social setting (group vs alone).

STYLE: real DSLR / mirrorless photography, cinematic lighting, shallow depth of field, candid and slightly imperfect, vertical 9:16, magazine-grade TikTok / Instagram aesthetic.

STRICTLY FORBIDDEN: NO logos, NO brand names, NO wordmarks, NO typography or text of any kind, NO app interfaces / UI screenshots, NO phone-app mockups, NO collages, NO split visuals, NO posters, NO graphics, NO illustrations, NO 3D renders, NO abstract visuals, NO watermarks, NO borders, NO visible packaging labels, NO recognizable brand silhouettes. Mode applied: ${mode}.`;
};

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
