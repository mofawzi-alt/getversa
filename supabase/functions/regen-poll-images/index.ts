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

  const lifestyleBlock = `MODE: LIFESTYLE (behavior). The QUESTION is "${question}" and this option means "${subject}".

⚠️ ZERO INTERPRETATION RULE — ABSOLUTE LAW ⚠️
You MUST NOT generate a "related", "associated", or "lifestyle adjacent" scene.
You MUST generate ONLY the literal physical action that the option "${subject}" describes in the context of "${question}".
If the option says "exercise" → show EXERCISING. Not food. Not couch (unless option = sedentary). Not coffee. EXERCISING.
If the option says "skincare" → show APPLYING SKINCARE TO FACE. Not a bathroom shelf. Not makeup.
If the option says "mobile wallet" → show TAPPING PHONE TO PAY at a terminal/QR.
If the option says "cash" → show HANDS EXCHANGING PAPER MONEY.
If the option says "ingredients matter" → show person READING THE INGREDIENT LABEL on packaging.
If the option says "brand matters" → show person HOLDING/CHOOSING a branded-looking package and inspecting the front.

ACTION MAPPING — MANDATORY 2-STEP:
Step 1: Convert "${subject}" → ONE specific physical action a human performs.
Step 2: Render ONLY that action, full-body or hands-visible, with the action filling at least 50% of the frame.

EXACT ACTION LIBRARY (use the closest match, render literally):
- exercise / workout / gym / active → person mid-rep lifting weights, running on a street, doing yoga, sweating at a gym
- sedentary / no exercise / lazy → person slumped on couch with phone, snacks visible, NOT exercising
- cook / cooking / home meals → hands chopping at a cutting board, stove visible, ingredients laid out
- order in / delivery → person at door receiving a paper delivery bag from a courier, OR unpacking takeout containers on a table
- smoke → person holding/lighting a cigarette
- vape → person exhaling vapor cloud, vape pen visible
- study → person hunched over books/laptop, focused, notes visible
- sleep early → dark bedroom, person under covers, phone face-down
- sleep late → person awake on phone in bed at night, blue light on face
- travel → airport terminal with rolling suitcase, OR plane window seat with passport
- scroll social media → extreme close-up of phone in hands, app feed visible (no logos), face reflected
- morning routine → bathroom mirror, brushing teeth or applying product
- skincare → fingertips applying cream/serum directly to cheek/forehead, mirror reflection
- makeup → applying mascara/lipstick close-up, mirror or pouch visible
- coffee at home → pouring from french press / moka pot in a kitchen
- coffee at cafe → barista handing cup across counter, or person sipping at a cafe table
- mobile payment / wallet → phone tapped on POS terminal or scanning QR code at register
- cash payment → hands exchanging banknotes at a counter
- card payment → hand inserting/tapping a plastic card at a POS terminal
- read ingredient label → person holding a product close to face, eyes on the back-of-pack ingredient list
- choose by brand → person picking a clearly-branded-looking package off a shelf, inspecting the front
- gym workout → barbell/dumbbells, gym mirror, athletic wear
- home workout → yoga mat in living room, bodyweight exercise
- shop online → person on couch with phone, shopping cart on screen, packages nearby
- shop in store → person walking through a retail aisle holding items
- group hangout → 3-5 friends laughing together at a cafe/rooftop
- solo time → one person alone reading/listening to music in a calm setting

If the question/option is not in this list, derive the SINGLE most literal physical action and render it. NEVER substitute with food, delivery, or shopping unless those ARE the literal action.

REJECTION TEST: If a stranger glanced at this image for 1 second, would they say the EXACT word "${subject}"? If no → you are generating wrong. The action must be unmistakable.`;

  // Detect explicit venue/location in the question and lock to it
  const ql = question.toLowerCase();
  const sl = subject.toLowerCase();
  let locationLock = '';
  if (ql.includes('supermarket') || sl.includes('supermarket')) {
    locationLock = `\n\n🔒 LOCATION LOCK: Scene MUST be INSIDE A MODERN UPSCALE EGYPTIAN SUPERMARKET (Gourmet / Seoudi / Carrefour / Spinneys style) — clean bright indoor aisles, white tiled floors, organized shelves with generic packaged goods. ABSOLUTELY FORBIDDEN: outdoor street markets, wet alleys, souks, vendors, stalls, crates on the ground, tuk-tuks, motorbikes. If your scene is outdoors → WRONG.`;
  } else if (ql.includes('food market') || sl.includes('food market') || sl.includes('souk') || ql.includes('souk')) {
    locationLock = `\n\n🔒 LOCATION LOCK: Scene MUST be at a traditional outdoor Egyptian food market / souk — open-air stalls, fresh produce piled high, vendors, baskets, warm chaotic atmosphere.`;
  } else if (ql.includes('gym')) {
    locationLock = `\n\n🔒 LOCATION LOCK: Scene MUST be inside a modern gym (mirrors, equipment, dumbbells, athletic wear) unless the option explicitly opposes the gym.`;
  } else if (ql.includes('cafe') || ql.includes('café')) {
    locationLock = `\n\n🔒 LOCATION LOCK: Scene MUST be inside a modern Cairo cafe (espresso machine, wood tables, plants, soft daylight).`;
  } else if (ql.includes('butcher')) {
    locationLock = sl.includes('supermarket')
      ? `\n\n🔒 LOCATION LOCK: Scene MUST be at the refrigerated meat counter INSIDE a modern supermarket (cold case, plastic-wrapped trays, price labels). NOT a butcher shop.`
      : `\n\n🔒 LOCATION LOCK: Scene MUST be inside a traditional butcher shop (hanging meat, white tile, butcher in apron with cleaver, wooden block).`;
  }

  return `Cinematic photograph for a Gen Z poll: "${question}". This image represents "${subject}" (vs "${otherOption}"). The "this is me" moment must be obvious in under 1 second.

${isProduct ? hybridBlock : lifestyleBlock}${locationLock}

SAME-CATEGORY DIFFERENTIATION: If "${subject}" and "${otherOption}" belong to the same category, contrast via lifestyle, environment, mood, energy (group vs solo), lighting, framing, time of day.

WHO: ONE visible human aged 18–30, modern Gen Z appearance, casual trendy 2026 clothing, natural expression. NO older subjects. NO corporate styling.

WHERE: realistic 2026 environment — modern Cairo / MENA apartment, rooftop, cafe, university, street, gym, park, or social hangout. Culturally grounded.

VISUAL CONTRAST: must differ from the paired image in at least 3 of: lighting, location, framing, emotion, activity energy, social setting.

STYLE: real DSLR / mirrorless photography, cinematic lighting, shallow depth of field, candid, vertical 9:16, magazine-grade TikTok / Instagram aesthetic.

STRICTLY FORBIDDEN: NO logos, NO brand names, NO wordmarks, NO typography or text, NO app UI, NO collages, NO split visuals, NO posters, NO graphics, NO illustrations, NO 3D renders, NO watermarks, NO borders, NO visible packaging labels. Mode: ${mode}.`;
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
