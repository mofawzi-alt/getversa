import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EGYPT_KEYWORDS = [
  // Food (Arabic)
  'كشري', 'شاورما', 'فول', 'طعمية', 'كباب', 'مشويات',
  // Places
  'sahel', 'gouna', 'cairo', 'alexandria', 'zamalek', 'maadi', 'new cairo', 'ain sokhna', 'hurghada',
  // Brands
  'vodafone', 'orange', 'etisalat', 'talabat', 'elmenus', 'noon', 'carrefour', 'juhayna', 'edita',
  // Events
  'ramadan', 'رمضان', 'eid', 'عيد',
];

function detectEgyptContext(text: string): boolean {
  if (!text) return false;
  // Right-to-left / Arabic Unicode block
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(text)) return true;
  const lower = text.toLowerCase();
  return EGYPT_KEYWORDS.some((kw) => lower.includes(kw));
}

const CULTURAL_CONTEXTS: Record<string, string> = {
  'cairo street': 'Downtown Cairo street — bustling traffic, old buildings, baladi shops, warm chaotic atmosphere.',
  'sahel beach': 'Egyptian North Coast / Sahel beach — turquoise water, white sand, resort lifestyle.',
  'egyptian home': 'Egyptian home interior — warm family kitchen, Arabic tiles, cozy living room.',
  'egyptian office': 'Modern Egyptian office — co-working space, startup vibe, New Cairo business park.',
  'egyptian café': 'Egyptian café — ahwa aesthetic or modern specialty coffee shop in Zamalek/Maadi.',
  'egyptian university campus': 'Egyptian university campus — AUC, GUC, or Cairo University grounds, students in casual wear.',
  'egyptian mall': 'Egyptian shopping mall — City Stars, Mall of Egypt style, modern retail environment.',
  'egyptian gym': 'Egyptian gym or outdoor fitness — modern gym equipment, or Nile corniche jogging.',
  'nile view': 'Nile waterfront / Cairo skyline — feluccas, city lights, aspirational evening mood.',
  'egyptian wedding': 'Egyptian wedding celebration — joyful, colorful, family gathering, dabke energy.',
  'new cairo compound': 'New Cairo premium residential compound — gated community, modern villas, manicured gardens.',
  'generic global': 'Global cosmopolitan setting — modern urban environment, diverse faces.',
};

const COUNTRY_DIRECTIVES: Record<string, string> = {
  egypt: 'Contemporary Egyptian setting. Egyptian faces, authentic Cairo or Egyptian urban atmosphere. Arabic signage where natural.',
  uae: 'Contemporary Gulf setting. Cosmopolitan MENA atmosphere, modern Gulf urban environment.',
  'united arab emirates': 'Contemporary Gulf setting. Cosmopolitan MENA atmosphere, modern Gulf urban environment.',
  'saudi arabia': 'Contemporary Saudi setting. Modern Riyadh or Jeddah urban atmosphere.',
  ksa: 'Contemporary Saudi setting. Modern Riyadh or Jeddah urban atmosphere.',
  mena: 'Contemporary Middle East and North Africa. Arab faces, modern MENA urban environment.',
};
const DEFAULT_COUNTRY_DIRECTIVE = COUNTRY_DIRECTIVES.mena;

function resolveCountryDirective(country?: string | null): string {
  if (!country) return DEFAULT_COUNTRY_DIRECTIVE;
  return COUNTRY_DIRECTIVES[country.trim().toLowerCase()] || DEFAULT_COUNTRY_DIRECTIVE;
}

async function generateAndUploadImage(apiKey: string, prompt: string, supabase: any, culturalContext?: string | null, targetCountry?: string | null): Promise<string | null> {
  try {
    const countryDirective = resolveCountryDirective(targetCountry);
    const keywordBoost = detectEgyptContext(prompt)
      ? ' Local cue detected: ensure Egyptian / Arabic signage and local Egyptian atmosphere are clearly present.'
      : '';
    const contextScene = culturalContext && CULTURAL_CONTEXTS[culturalContext.toLowerCase()]
      ? ` SCENE SETTING: ${CULTURAL_CONTEXTS[culturalContext.toLowerCase()]}`
      : '';
    const imagePrompt = `Cinematic lifestyle photograph, DSLR quality, candid, magazine-grade. Real people in real environments.

IMAGE V4 RULES:
- Real life scenes ONLY. No abstract visuals, no icons.
- Each image must represent: a lifestyle, a feeling, and a status signal.
- Real faces, real expressions, real human moments. No people looking at cameras.
- Human centered: people USING or EXPERIENCING the option — not objects alone.
- Premium cinematic quality: warm tones, clean composition, shallow depth of field.
- 1 second clarity test: the image must communicate the meaning instantly.

NO logos, brands, text, UI elements, posters, graphics, illustrations, icons, abstract symbols, or graphic design elements.

Subject: "${prompt}". ${countryDirective}${contextScene}${keywordBoost}

If the subject is an abstract concept, generate a lifestyle scene showing real people embodying that concept.
Never default to Western, American, or European settings. No alcohol imagery.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [{ role: 'user', content: imagePrompt }],
        modalities: ['image', 'text']
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const imageDataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageDataUrl) return null;
    const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) return null;
    const binaryString = atob(base64Match[2]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const fileName = `ai-generated/${crypto.randomUUID()}.${base64Match[1]}`;
    const { error } = await supabase.storage.from('poll-images').upload(fileName, bytes, { contentType: `image/${base64Match[1]}` });
    if (error) return null;
    return supabase.storage.from('poll-images').getPublicUrl(fileName).data.publicUrl;
  } catch { return null; }
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

    // Resolve cultural_context (specific scene) and target_country (geo/cast).
    // Body values win; otherwise read from poll row. Country falls back to MENA via resolveCountryDirective.
    let resolvedContext: string | null = (bodyContext && String(bodyContext).trim()) || null;
    let resolvedCountry: string | null = (bodyCountry && String(bodyCountry).trim()) || null;
    if (!resolvedContext || !resolvedCountry) {
      const { data: pollRow } = await supabase
        .from('polls')
        .select('cultural_context, target_countries')
        .eq('id', pollId)
        .maybeSingle();
      if (!resolvedContext && pollRow?.cultural_context) resolvedContext = pollRow.cultural_context;
      if (!resolvedCountry && Array.isArray(pollRow?.target_countries) && pollRow.target_countries.length) {
        resolvedCountry = pollRow.target_countries[0];
      }
    }

    const [imageA, imageB] = await Promise.all([
      generateAndUploadImage(LOVABLE_API_KEY, imageABrief, supabase, resolvedContext, resolvedCountry),
      generateAndUploadImage(LOVABLE_API_KEY, imageBBrief, supabase, resolvedContext, resolvedCountry),
    ]);

    const { error } = await supabase.from('polls').update({ image_a_url: imageA, image_b_url: imageB }).eq('id', pollId);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, pollId, hasImageA: !!imageA, hasImageB: !!imageB }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
