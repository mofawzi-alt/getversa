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
  const wordCount = t.split(/\s+/).length;
  if (wordCount >= 4) return false;
  const firstChar = t[0];
  const looksProper = firstChar === firstChar.toUpperCase() && /[A-Za-z]/.test(firstChar);
  return looksProper && wordCount <= 3;
}

// Heuristic: detect celebrity / public figure names (2-4 capitalized words, no common product words)
function isCelebrityName(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  // All words should start with uppercase (proper noun pattern)
  const allCapitalized = words.every(w => /^[A-Z\u0600-\u06FF]/.test(w));
  if (!allCapitalized) return false;
  // Exclude common product/brand patterns
  const productWords = /^(iphone|samsung|galaxy|coca|pepsi|nike|adidas|vodafone|orange|etisalat|noon|amazon|uber|careem|netflix|shahid|youtube|instagram|tiktok|facebook|twitter|whatsapp|spotify|apple|google|microsoft|toyota|bmw|mercedes|hyundai|kia)$/i;
  if (words.some(w => productWords.test(w))) return false;
  return true;
}

const PROMPT_TPL = (subject: string, question: string, otherOption: string) => {
  const bothCelebrities = isCelebrityName(subject) && isCelebrityName(otherOption);
  
  if (bothCelebrities) {
    return `CELEBRITY POLL IMAGE — CINEMATIC MOVIE POSTER / STREAMING SCREEN STYLE

Create a dramatic, cinematic movie-poster-style image for "${subject}" in the context of "${question}".

CONCEPT: Design a stylish, moody movie poster or streaming platform (like Netflix/Shahid) title card that prominently features the name "${subject}" as the HERO TITLE TEXT.

MANDATORY ELEMENTS:
- The name "${subject}" MUST appear as large, bold, elegant TITLE TEXT — like a movie title on a poster or a show title on a streaming app screen
- Cinematic dramatic lighting — dark background with spotlight effects, lens flares, or neon glow
- Film-grade color grading — deep blues, warm ambers, dramatic contrast
- A silhouette or abstract human figure in the background (NOT a real face — just a dramatic shadowy outline or artistic blur)
- Visual elements suggesting the entertainment industry: film grain, bokeh lights, stage lights, red carpet glow, or a theater/screen frame
- The overall feel should be PREMIUM and CINEMATIC — like an award-winning movie poster or a Shahid/Netflix original series card

STYLE: Dark cinematic photography, dramatic lighting, movie poster composition, 4:5 portrait, premium streaming platform aesthetic.

TEXT RULES: The name "${subject}" MUST be rendered as stylish typography — think movie credits font, bold serif or elegant sans-serif, with cinematic effects (glow, shadow, metallic sheen).

STRICTLY FORBIDDEN: NO real human faces, NO photographs of actual people, NO logos of streaming platforms, NO brand names other than the person's name. The person's name IS the visual centerpiece.`;
  }

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

  return `VERSA POLL CONTENT SYSTEM — VERSION 2.0
Last updated: April 2026
Apply to every poll generated for the Versa platform without exception.

Cinematic photograph for a Gen Z poll: "${question}". This image represents "${subject}" (vs "${otherOption}"). The "this is me" moment must be obvious in under 1 second.

${isProduct ? hybridBlock : lifestyleBlock}${locationLock}

SAME-CATEGORY DIFFERENTIATION: If "${subject}" and "${otherOption}" belong to the same category, contrast via lifestyle, environment, mood, energy (group vs solo), lighting, framing, time of day.

WHO: ONE visible human aged 18–30, modern Gen Z appearance, casual trendy 2026 clothing, natural expression. NO older subjects. NO corporate styling.

WHERE: realistic 2026 environment — modern Cairo / MENA apartment, rooftop, cafe, university, street, gym, park, or social hangout. Culturally grounded.

RULE 9B — EGYPTIAN CULTURAL ACCURACY: When setting scenes in Egypt: coffee shops must show local ahwa aesthetic OR modern specialty cafe — never generic Starbucks-style. Food scenes must show real Egyptian context — home kitchen with Arabic tiles, street food setting, family table. Fashion must show Egyptian Gen Z naturally — women may or may not wear hijab, never stereotype, show both across different polls. Social settings must be grounded in real Cairo locations — New Cairo compounds, Zamalek rooftops, Maadi streets, university campuses, local markets. Aspirational polls lean North Coast and compound aesthetic. Everyday polls lean downtown Cairo and local street aesthetic. Never show generic Arab stock photo aesthetic or settings that could be any country.

VISUAL CONTRAST: must differ from the paired image in at least 3 of: lighting, location, framing, emotion, activity energy, social setting.

RULE 11B — CONTRAST INTENSITY: The two images must feel like they belong to two completely different worlds — not just two different moments. Test: cover the option labels and show both images to someone — they must immediately understand these are two completely different lifestyle choices without reading any text. If the images could belong to the same person on different days — REJECT and regenerate. The contrast must be felt instantly — not noticed on close inspection.

RULE 12B — EMOTIONAL AUTHENTICITY: The emotion shown must be the natural result of the action — not performed for the camera. The subject must appear unaware of being photographed — caught in a real moment. This is the difference between a lifestyle photo and a stock photo. Always lifestyle. RIGHT: person laughing while eating street food with friends — emotion caused by the moment. WRONG: person smiling directly at camera while holding a product — this is advertising not authenticity.

STYLE: real DSLR / mirrorless photography, cinematic lighting, shallow depth of field, candid, vertical 9:16, magazine-grade TikTok / Instagram aesthetic.

STRICTLY FORBIDDEN: NO logos, NO brand names, NO wordmarks, NO typography or text, NO app UI, NO collages, NO split visuals, NO posters, NO graphics, NO illustrations, NO 3D renders, NO watermarks, NO borders, NO visible packaging labels. Mode: ${mode}.

RULE 17B — PAIR COMPATIBILITY CHECK: Before finalizing — check both images together as a pair. Do they feel like a genuine A vs B choice? Does the visual contrast create an instant opinion in the viewer before the question is read? Would someone who has never seen Versa immediately understand this is a choice between two things? A great poll image pair creates a gut reaction before the question is even read. If the pair does not create that reaction — regenerate one or both images.

RULE 19 — CATEGORY SPECIFIC IMAGE RULES: FMCG and Food: show product being consumed or enjoyed — never just sitting on a surface. Food must look delicious enough to make someone hungry. Financial: show the emotional state and lifestyle of the financial choice — not just the transaction. Telco and Tech: show device in active use — screen visible and active, never held statically. Lifestyle: show the full environment — background tells as much story as the subject. The Pulse: maximum Egyptian cultural authenticity — these polls are about identity. Generic images are unacceptable for this category.

RULE 20 — THE 1 SECOND TEST (MANDATORY FINAL STEP): Before finalizing any image — mentally show it for 1 second then look away. Ask: what did I see? If the answer matches the option exactly — PASS. If the answer is vague or wrong — FAIL — REGENERATE. This test cannot be skipped. A poll image that fails the 1 second test will never be approved regardless of how good it looks on longer inspection.

RULE 21 — NO ALCOHOL: Never show wine, cocktails, beer, champagne, liquor bottles, or any alcohol imagery.

RULE 22 — VISUAL DIRECTION: Each image must represent THREE things simultaneously: a lifestyle, a feeling, and a status signal. Both images must feel like they belong in the same visual world but represent completely different lifestyle choices.`;
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
