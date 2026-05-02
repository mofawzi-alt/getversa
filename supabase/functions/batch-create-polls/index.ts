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

// ─── Image generation with 3-attempt retry + fallback models ───

async function generateAndUploadImage(apiKey: string, brief: string, question: string, supabase: any, culturalContext?: string | null, targetCountry?: string | null): Promise<string | null> {
  const countryDirective = resolveCountryDirective(targetCountry);
  const contextDirective = culturalContext ? (CONTEXT_DIRECTIVES[culturalContext] || '') : '';
  const keywordBoost = detectEgyptContext(`${question} ${brief}`)
    ? ' Local cue detected: ensure Egyptian / Arabic signage and local Egyptian atmosphere are clearly present.'
    : '';
  const prompt = buildImagePrompt(brief, question, countryDirective, contextDirective, keywordBoost);

  const models = ['google/gemini-3-pro-image-preview', 'google/gemini-3.1-flash-image-preview', 'google/gemini-2.5-flash-image'];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const model = models[Math.min(attempt, models.length - 1)];
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], modalities: ['image', 'text'] }),
      });
      if (!response.ok) {
        console.warn(`batch-create attempt ${attempt + 1} fail: ${response.status}`);
        await response.text();
        if (response.status === 402 || response.status === 429) return null;
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      const data = await response.json();
      const imageDataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imageDataUrl) { console.warn(`Attempt ${attempt + 1}: no image`); await new Promise(r => setTimeout(r, 1000)); continue; }
      const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!base64Match) continue;
      const binaryString = atob(base64Match[2]);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const fileName = `ai-generated/${crypto.randomUUID()}.${base64Match[1]}`;
      const { error } = await supabase.storage.from('poll-images').upload(fileName, bytes, { contentType: `image/${base64Match[1]}` });
      if (error) { console.warn('Upload error:', error); continue; }
      return supabase.storage.from('poll-images').getPublicUrl(fileName).data.publicUrl;
    } catch (e) {
      console.warn(`Attempt ${attempt + 1} error:`, e);
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
    const { userId, pollId, imageABrief, imageBBrief, culturalContext: bodyContext, targetCountry: bodyCountry } = await req.json();

    // Verify admin
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').single();
    if (!role) return new Response(JSON.stringify({ error: 'Admin required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Resolve context from body or poll row
    let resolvedContext: string | null = (bodyContext && String(bodyContext).trim()) || null;
    let resolvedCountry: string | null = (bodyCountry && String(bodyCountry).trim()) || null;
    let question = '';
    if (!resolvedContext || !resolvedCountry || !question) {
      const { data: pollRow } = await supabase
        .from('polls')
        .select('cultural_context, target_countries, question')
        .eq('id', pollId)
        .maybeSingle();
      if (!resolvedContext && pollRow?.cultural_context) resolvedContext = pollRow.cultural_context;
      if (!resolvedCountry && Array.isArray(pollRow?.target_countries) && pollRow.target_countries.length) {
        resolvedCountry = pollRow.target_countries[0];
      }
      question = pollRow?.question || '';
    }

    const [imageA, imageB] = await Promise.all([
      generateAndUploadImage(LOVABLE_API_KEY, imageABrief, question, supabase, resolvedContext, resolvedCountry),
      generateAndUploadImage(LOVABLE_API_KEY, imageBBrief, question, supabase, resolvedContext, resolvedCountry),
    ]);

    // If both images failed after 3 attempts each, flag poll
    if (!imageA && !imageB) {
      await supabase.from('polls').update({ needs_manual_image: true }).eq('id', pollId);
      return new Response(JSON.stringify({ success: false, pollId, needs_manual_image: true, error: 'Image generation failed after 3 attempts. Please upload images manually.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updatePayload: any = { needs_manual_image: false };
    if (imageA) updatePayload.image_a_url = imageA;
    if (imageB) updatePayload.image_b_url = imageB;
    const { error } = await supabase.from('polls').update(updatePayload).eq('id', pollId);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, pollId, hasImageA: !!imageA, hasImageB: !!imageB }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
