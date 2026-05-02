import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Shared Versa Image Pipeline v3 ───

const EGYPT_KEYWORDS = [
  'كشري','شاورما','فول','طعمية','كباب','مشويات',
  'sahel','gouna','cairo','alexandria','zamalek','maadi','new cairo','ain sokhna','hurghada',
  'vodafone','orange','etisalat','talabat','elmenus','noon','carrefour','juhayna','edita',
  'ramadan','رمضان','eid','عيد',
];

function detectEgyptContext(text: string): boolean {
  if (!text) return false;
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(text)) return true;
  const lower = text.toLowerCase();
  return EGYPT_KEYWORDS.some((kw) => lower.includes(kw));
}

const COUNTRY_DIRECTIVES: Record<string, string> = {
  egypt: 'Setting: contemporary Cairo or Egyptian city. Cast: Egyptian / North African faces, Gen Z. Arabic signage, local streets, Egyptian lifestyle atmosphere.',
  uae: 'Setting: contemporary Dubai or Abu Dhabi. Cast: mixed Arab and South Asian faces, cosmopolitan MENA. Modern Gulf architecture, clean urban environment.',
  'united arab emirates': 'Setting: contemporary Dubai or Abu Dhabi. Cast: mixed Arab and South Asian faces, cosmopolitan MENA. Modern Gulf architecture, clean urban environment.',
  'saudi arabia': 'Setting: contemporary Riyadh or Jeddah. Cast: Saudi Arab faces, modest fashion, Gen Z. Modern Saudi urban environment, Vision 2030 aesthetic.',
  ksa: 'Setting: contemporary Riyadh or Jeddah. Cast: Saudi Arab faces, modest fashion, Gen Z. Modern Saudi urban environment, Vision 2030 aesthetic.',
  kuwait: 'Setting: contemporary Kuwait City. Cast: Kuwaiti Arab faces, Gulf aesthetic, Gen Z. Modern Gulf urban environment.',
  jordan: 'Setting: contemporary Amman. Cast: Jordanian / Levantine Arab faces, Gen Z. Modern Amman urban atmosphere.',
  lebanon: 'Setting: contemporary Beirut. Cast: Lebanese / Levantine faces, cosmopolitan, Gen Z. Beirut urban lifestyle atmosphere.',
  morocco: 'Setting: contemporary Casablanca or Rabat. Cast: Moroccan / North African faces, Gen Z. Modern Moroccan urban environment.',
  mena: 'Setting: contemporary Middle East and North Africa. Cast: Arab faces, diverse MENA nationalities, Gen Z. Modern urban MENA environment. No Western-coded settings.',
  gcc: 'Setting: contemporary Gulf region. Cast: Arab Gulf faces, cosmopolitan mix, Gen Z. Modern Gulf urban environment, clean and premium aesthetic.',
  global: 'Setting: neutral cosmopolitan urban environment. Cast: diverse international Gen Z. No specific national markers.',
};
const DEFAULT_COUNTRY_DIRECTIVE = COUNTRY_DIRECTIVES.mena;

const CONTEXT_DIRECTIVES: Record<string, string> = {
  'Cairo street': ' Scene: a contemporary Cairo street — local architecture, Egyptian pedestrians, Arabic signage, authentic urban atmosphere.',
  'Sahel beach': ' Scene: North Coast (Sahel) Egypt — Mediterranean beach, white compound aesthetic, Egyptian Gen Z in summer mode.',
  'Egyptian home': ' Scene: a modern Egyptian home interior — local decor cues, family or friends, warm natural light.',
  'Egyptian office': ' Scene: a contemporary Cairo office or co-working space — Egyptian professionals, modern but locally rooted.',
  'Egyptian café': ' Scene: a Cairo specialty café or ahwa — Egyptian Gen Z, local atmosphere, occasional Arabic signage in background.',
  'Egyptian university campus': ' Scene: a modern Egyptian university campus — lecture halls, outdoor quads, Gen Z students in casual 2026 fashion, backpacks, study groups.',
  'Egyptian mall or shopping center': ' Scene: inside a modern Egyptian mall — escalators, bright storefronts, Arabic signage, Gen Z shoppers browsing.',
  'Egyptian gym or outdoor public space': ' Scene: a modern Egyptian gym or outdoor park — fitness equipment, athletic wear, Gen Z working out or jogging in an Egyptian neighbourhood.',
  'Nile view or Cairo waterfront': ' Scene: Cairo Nile corniche or waterfront — river view, feluccas in background, golden hour, aspirational Egyptian lifestyle.',
  'Egyptian wedding venue or celebration': ' Scene: an Egyptian wedding or celebration hall — festive lights, colourful decorations, joyful Gen Z guests in semi-formal Egyptian style.',
  'New Cairo compound or premium residential': ' Scene: a modern New Cairo gated compound — clean streets, manicured gardens, premium villas, aspirational Egyptian residential lifestyle.',
  'Generic global': '',
};

function resolveCountryDirective(country?: string | null): string {
  if (!country) return DEFAULT_COUNTRY_DIRECTIVE;
  return COUNTRY_DIRECTIVES[country.trim().toLowerCase()] || DEFAULT_COUNTRY_DIRECTIVE;
}

const PAIR_BALANCE_RULE = 'This image will appear side by side with a paired image on a split poll card. Generate with awareness of visual pairing — match brightness level approximately, use complementary not clashing color temperatures, ensure compositional weight is balanced so both images feel like they belong in the same visual world. The two images must not visually clash when placed next to each other.';

const ONE_SECOND_CLARITY_RULE = 'The image must communicate the option meaning in under 1 second to a viewer who has never seen the prompt. Generate only the exact physical action or scene described — never an approximate, symbolic, or loosely related scene. If the intended action is not immediately and obviously visible — the image fails. Regenerate until the action is unmistakable.';

function buildImagePrompt(subject: string, question: string, countryDirective: string, contextDirective: string, keywordBoost: string): string {
  return `Cinematic lifestyle photograph, DSLR, candid, magazine-grade. NO logos, brands, text, UI, posters, graphics, illustrations. Subject: "${subject}". Visual context: "${question}". WHO: ONE visible human aged 18–30, Gen Z, modern casual 2026 clothing, natural expression. ${countryDirective}${contextDirective}${keywordBoost} ${PAIR_BALANCE_RULE} ${ONE_SECOND_CLARITY_RULE} Never default to Western, American, or European settings. Real scene only — people, hands, environments, or products in authentic use.`;
}

// ─── Image generation with 3-attempt retry ───

async function genImage(apiKey: string, prompt: string): Promise<Uint8Array | null> {
  const models = ['google/gemini-3-pro-image-preview', 'google/gemini-3.1-flash-image-preview', 'google/gemini-2.5-flash-image'];
  for (let attempt = 0; attempt < 3; attempt++) {
    const model = models[Math.min(attempt, models.length - 1)];
    try {
      const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], modalities: ['image', 'text'] }),
      });
      if (!r.ok) {
        console.warn(`Attempt ${attempt + 1} failed: ${r.status}`);
        if (r.status === 402 || r.status === 429) { await r.text(); return null; }
        await r.text();
        await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
        continue;
      }
      const d = await r.json();
      const url = d.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!url) { console.warn(`Attempt ${attempt + 1}: no image in response`); await new Promise(res => setTimeout(res, 1000)); continue; }
      const m = url.match(/^data:image\/\w+;base64,(.+)$/);
      if (!m) continue;
      const bin = atob(m[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch (e) {
      console.warn(`Attempt ${attempt + 1} error:`, e);
      await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
    }
  }
  return null;
}

function slugify(s: string) {
  return (s.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30).replace(/^_|_$/g, '')) || 'img';
}

async function processOne(supabase: any, apiKey: string, poll: any) {
  // Fetch poll row for country/cultural context
  const { data: pollRow } = await supabase
    .from('polls')
    .select('cultural_context, target_countries, target_country')
    .eq('id', poll.id)
    .maybeSingle();

  const targetCountry = pollRow?.target_country || (Array.isArray(pollRow?.target_countries) && pollRow.target_countries.length ? pollRow.target_countries[0] : null);
  const culturalContext = pollRow?.cultural_context || null;
  const countryDirective = resolveCountryDirective(targetCountry);
  const contextDirective = culturalContext ? (CONTEXT_DIRECTIVES[culturalContext] || '') : '';
  const combined = `${poll.question || ''} ${poll.option_a} ${poll.option_b}`;
  const keywordBoost = detectEgyptContext(combined)
    ? ' Local cue detected: ensure Egyptian / Arabic signage and local Egyptian atmosphere are clearly present.'
    : '';

  const promptA = buildImagePrompt(poll.option_a, poll.question, countryDirective, contextDirective, keywordBoost);
  const promptB = buildImagePrompt(poll.option_b, poll.question, countryDirective, contextDirective, keywordBoost);

  const [a, b] = await Promise.all([genImage(apiKey, promptA), genImage(apiKey, promptB)]);

  if (!a || !b) {
    // Flag as needs_manual_image after failed attempts
    await supabase.from('polls').update({ needs_manual_image: true }).eq('id', poll.id);
    return { id: poll.id, status: 'gen_failed', needs_manual_image: true };
  }

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
  const { error } = await supabase.from('polls').update({ image_a_url: urlA, image_b_url: urlB, needs_manual_image: false }).eq('id', poll.id);
  if (error) return { id: poll.id, status: 'db_failed', err: error.message };
  return { id: poll.id, status: 'ok' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const apiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const { polls } = await req.json();
    if (!Array.isArray(polls) || polls.length === 0) {
      return new Response(JSON.stringify({ error: 'no polls' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
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
