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

const CONTEXT_DIRECTIVES: Record<string, string> = {
  'Cairo street': ' Scene: a contemporary Cairo street — local architecture, Egyptian pedestrians, Arabic signage, authentic urban atmosphere.',
  'Sahel beach': ' Scene: North Coast (Sahel) Egypt — Mediterranean beach, white compound aesthetic, Egyptian Gen Z in summer mode.',
  'Egyptian home': ' Scene: a modern Egyptian home interior — local decor cues, family or friends, warm natural light.',
  'Egyptian office': ' Scene: a contemporary Cairo office or co-working space — Egyptian professionals, modern but locally rooted.',
  'Egyptian café': ' Scene: a Cairo specialty café or ahwa — Egyptian Gen Z, local atmosphere, occasional Arabic signage in background.',
  'Generic global': '',
};

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

function resolveCountryDirective(country?: string | null): string {
  if (!country) return DEFAULT_COUNTRY_DIRECTIVE;
  return COUNTRY_DIRECTIVES[country.trim().toLowerCase()] || DEFAULT_COUNTRY_DIRECTIVE;
}

async function generateAndUploadImage(apiKey: string, prompt: string, supabase: any, culturalContext?: string | null, targetCountry?: string | null): Promise<string | null> {
  try {
    const countryDirective = resolveCountryDirective(targetCountry);
    const contextDirective = culturalContext ? (CONTEXT_DIRECTIVES[culturalContext] || '') : '';
    const keywordBoost = detectEgyptContext(prompt)
      ? ' Local cue detected: ensure Egyptian / Arabic signage and local Egyptian atmosphere are clearly present.'
      : '';
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [{ role: 'user', content: `Cinematic lifestyle photograph, DSLR, candid, magazine-grade. NO logos, brands, text, UI, posters, graphics, illustrations. Subject: "${prompt}". ${countryDirective}${contextDirective}${keywordBoost} Never default to Western, American, or European settings. Real scene only — people, hands, environments, or products in authentic use.` }],
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

    // Resolve cultural context: explicit body value > poll row value > Cairo street if Egypt-targeted.
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
    if (!resolvedContext && (resolvedCountry || '').toLowerCase() === 'egypt') {
      resolvedContext = 'Cairo street';
    }

    const [imageA, imageB] = await Promise.all([
      generateAndUploadImage(LOVABLE_API_KEY, imageABrief, supabase, resolvedContext),
      generateAndUploadImage(LOVABLE_API_KEY, imageBBrief, supabase, resolvedContext),
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
