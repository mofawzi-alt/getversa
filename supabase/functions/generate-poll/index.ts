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

function buildVisualDirectionPrompt(scene: string, emotion: string, contrastType: string, pairRelationship: string, countryDirective: string, contextDirective: string, keywordBoost: string): string {
  return `Cinematic lifestyle photograph, DSLR, candid, magazine-grade. NO logos, brands, text, UI, posters, graphics, illustrations. Scene: ${scene}. Emotion to convey: ${emotion}. Contrast role: ${contrastType}. Pair dynamic: ${pairRelationship}. WHO: ONE visible human aged 18–30, Gen Z, modern casual 2026 clothing, natural expression. ${countryDirective}${contextDirective}${keywordBoost} ${PAIR_BALANCE_RULE} ${ONE_SECOND_CLARITY_RULE} Never default to Western, American, or European settings. Real scene only — people, hands, environments, or products in authentic use.`;
}

// Fallback if visual_direction not available
function buildSimpleImagePrompt(subject: string, question: string, countryDirective: string, contextDirective: string, keywordBoost: string): string {
  return `Cinematic lifestyle photograph, DSLR, candid, magazine-grade. NO logos, brands, text, UI, posters, graphics, illustrations. Subject: "${subject}". Visual context: "${question}". WHO: ONE visible human aged 18–30, Gen Z, modern casual 2026 clothing, natural expression. ${countryDirective}${contextDirective}${keywordBoost} ${PAIR_BALANCE_RULE} ${ONE_SECOND_CLARITY_RULE} Never default to Western, American, or European settings. Real scene only — people, hands, environments, or products in authentic use.`;
}

// ─── Image generation with 3-attempt retry ───

async function generateAndUploadImage(apiKey: string, prompt: string, supabase: any): Promise<string | null> {
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
        const errorText = await response.text();
        console.warn(`Image gen attempt ${attempt + 1} failed: ${response.status}`, errorText.slice(0, 200));
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
      const { error: uploadError } = await supabase.storage.from('poll-images').upload(fileName, bytes, { contentType: `image/${base64Match[1]}`, upsert: false });
      if (uploadError) { console.warn('Upload error:', uploadError); continue; }
      return supabase.storage.from('poll-images').getPublicUrl(fileName).data.publicUrl;
    } catch (error) {
      console.warn(`Attempt ${attempt + 1} error:`, error);
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const { category, userId, targetAgeRange, targetGender, targetCountry } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: adminRole, error: roleError } = await supabase
      .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').single();
    if (roleError || !adminRole) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const randomSeed = Math.floor(Math.random() * 1000000);
    const timestamp = Date.now();

    const ALLOWED_CATEGORIES = [
      'FMCG & Food', 'Beauty & Personal Care', 'Financial Services',
      'Media & Entertainment', 'Retail & E-commerce', 'Telco & Tech',
      'Food Delivery & Dining', 'Automotive & Mobility', 'Lifestyle & Society', 'The Pulse',
    ];

    // Resolve country directive for text generation context
    const resolvedCountry = targetCountry || 'Egypt';
    const countryContext = resolveCountryDirective(resolvedCountry);

    const systemPrompt = `You are an expert poll creator for a social voting app called VERSA, targeting audiences in ${resolvedCountry.toUpperCase()}.
Your job is to create simple "X vs Y" or "This or That" style comparison polls that resonate with the target audience.

CRITICAL: VARIETY IS ESSENTIAL!
- NEVER repeat the same poll twice
- Each poll must be UNIQUE and DIFFERENT from common obvious choices
- Think creatively and explore diverse options within each category
- Random seed for this request: ${randomSeed} - use this to inspire variety
- FOCUS ON ${resolvedCountry.toUpperCase()} culture, brands, food, celebrities, and trends

CRITICAL FORMAT RULES:
- The question MUST be exactly in this format: "Option A vs Option B"
- Each option MUST be 1-2 words MAXIMUM
- NO sentence-style questions
- Options should be well-known items, brands, or concepts

Guidelines:
- Create polls that spark debate between two comparable things
- Prioritize ${resolvedCountry} and regional cultural references
- Avoid controversial political, religious, or offensive topics
- Make polls that appeal to Gen Z / Millennial audience
${targetAgeRange || targetGender ? `
AUDIENCE TARGETING:
${targetAgeRange ? `- Age group: ${targetAgeRange} years old` : ''}
${targetGender ? `- Gender: ${targetGender}` : ''}
Make sure the poll resonates with this demographic!` : ''}

CATEGORY RULE — use EXACTLY one of:
${ALLOWED_CATEGORIES.map((c) => `- ${c}`).join('\n')}

You MUST respond with a valid JSON object with these exact fields:
{
  "question": "Option A vs Option B",
  "option_a": "Option A",
  "option_b": "Option B",
  "category": "<one of the categories above>",
  "visual_direction": {
    "option_a_scene": "detailed scene description — WHO + WHERE + EXACT ACTION + lighting",
    "option_b_scene": "detailed scene description — WHO + WHERE + EXACT ACTION + lighting",
    "contrast_type": "e.g. local vs corporate, warm vs cool, street vs modern",
    "emotion_a": "the feeling the option_a image must convey",
    "emotion_b": "the feeling the option_b image must convey",
    "pair_relationship": "the core tension between the two options"
  }
}

VISUAL DIRECTION RULES:
- option_a_scene and option_b_scene must describe a SPECIFIC cinematic shot — not a vague mood board
- Include: who (age, gender, outfit), where (exact location type), what action (specific physical behavior), and lighting
- contrast_type describes how the two images should visually differ
- emotion_a / emotion_b describe the feeling each image must evoke
- pair_relationship describes why these two options are interesting as a pair

Example for "Careem vs Uber":
  option_a_scene: "Young Egyptian woman in casual clothes confidently hailing a white car on a busy Cairo street at golden hour — warm light, street energy, local familiarity"
  option_b_scene: "Young Egyptian man checking a ride app on his phone outside a modern glass office building in New Cairo — cool blue light, clean environment, efficiency"
  contrast_type: "local vs corporate, warm vs cool, street vs modern"
  emotion_a: "familiar comfort, local pride"
  emotion_b: "modern efficiency, aspirational"
  pair_relationship: "everyday local vs aspirational modern"`;

    const userPrompt = category
      ? `Create a simple "X vs Y" poll in the "${category}" category for ${resolvedCountry} audiences. Be creative! Timestamp: ${timestamp} | Seed: ${randomSeed}`
      : `Create a simple "X vs Y" poll about any trending topic in ${resolvedCountry}. Be creative! Timestamp: ${timestamp} | Seed: ${randomSeed}`;

    console.log('Calling AI for poll content with visual_direction...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText);
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in AI response');

    let pollData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        pollData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch (parseError: any) {
      console.error('Parse error:', content);
      throw new Error('Failed to generate poll. Try a different category.');
    }

    if (!pollData.question || !pollData.option_a || !pollData.option_b) throw new Error('Invalid poll data');

    // Clamp category
    const clampCategory = (raw: string | undefined | null): string => {
      const n = (raw || '').trim().toLowerCase();
      const exact = ALLOWED_CATEGORIES.find((c) => c.toLowerCase() === n);
      if (exact) return exact;
      if (/(deliver|restaurant|dining|cafe|café|talabat|elmenus|otlob)/.test(n)) return 'Food Delivery & Dining';
      if (/(beauty|makeup|skincare|cosmetic)/.test(n)) return 'Beauty & Personal Care';
      if (/(bank|finance|fintech|money|payment|wallet)/.test(n)) return 'Financial Services';
      if (/(telecom|mobile|phone|tech|app|software|telco)/.test(n)) return 'Telco & Tech';
      if (/(car|auto|mobility|ride|uber|careem)/.test(n)) return 'Automotive & Mobility';
      if (/(retail|shopping|ecommerce|store|noon|jumia)/.test(n)) return 'Retail & E-commerce';
      if (/(movie|film|series|tv|celeb|music|sport|game|entertainment)/.test(n)) return 'Media & Entertainment';
      if (/(food|drink|snack|beverage|fmcg|coffee|tea|chips|cola)/.test(n)) return 'FMCG & Food';
      if (/(lifestyle|society|relationship|wellness|fashion|travel)/.test(n)) return 'Lifestyle & Society';
      return 'The Pulse';
    };
    pollData.category = clampCategory(pollData.category || category);

    // ─── Step 2: Image generation using visual_direction ───
    console.log('Generating images with visual_direction...');

    const countryDirective = resolveCountryDirective(resolvedCountry);
    const combinedText = `${pollData.question} ${pollData.option_a} ${pollData.option_b}`;
    const keywordBoost = detectEgyptContext(combinedText)
      ? ' Local cue detected: ensure Egyptian / Arabic signage and local Egyptian atmosphere are clearly present.'
      : '';
    const contextDirective = ''; // generate-poll uses country only, no specific cultural_context

    const vd = pollData.visual_direction;
    let promptA: string;
    let promptB: string;

    if (vd?.option_a_scene && vd?.option_b_scene) {
      // Use visual_direction as primary brief
      promptA = buildVisualDirectionPrompt(
        vd.option_a_scene, vd.emotion_a || '', vd.contrast_type || '', vd.pair_relationship || '',
        countryDirective, contextDirective, keywordBoost
      );
      promptB = buildVisualDirectionPrompt(
        vd.option_b_scene, vd.emotion_b || '', vd.contrast_type || '', vd.pair_relationship || '',
        countryDirective, contextDirective, keywordBoost
      );
    } else {
      // Fallback to simple prompt
      promptA = buildSimpleImagePrompt(pollData.option_a, pollData.question, countryDirective, contextDirective, keywordBoost);
      promptB = buildSimpleImagePrompt(pollData.option_b, pollData.question, countryDirective, contextDirective, keywordBoost);
    }

    const [imageA, imageB] = await Promise.all([
      generateAndUploadImage(LOVABLE_API_KEY, promptA, supabase),
      generateAndUploadImage(LOVABLE_API_KEY, promptB, supabase),
    ]);

    const needsManualImage = !imageA || !imageB;

    const startsAt = new Date();
    const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { data: poll, error: insertError } = await supabase
      .from('polls')
      .insert({
        question: pollData.question,
        option_a: pollData.option_a,
        option_b: pollData.option_b,
        category: pollData.category || category || 'General',
        created_by: userId,
        is_daily_poll: true,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        image_a_url: imageA,
        image_b_url: imageB,
        target_age_range: targetAgeRange || null,
        target_gender: targetGender || null,
        target_country: targetCountry || null,
        weight_score: 500,
        needs_manual_image: needsManualImage,
      })
      .select()
      .single();

    if (insertError) {
      console.error('DB insert error:', insertError);
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ ok: false, error: 'This poll already exists. Try again.', duplicate: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('Failed to save poll');
    }

    console.log('Poll created:', poll.id, needsManualImage ? '(needs manual image)' : '');

    // Push notification
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ title: '🔥 New Poll!', body: `${poll.question} - Vote now!`, url: '/', poll_id: poll.id }),
      }).then(r => r.json());
    } catch (e) { console.warn('Push notification failed:', e); }

    return new Response(JSON.stringify({
      success: true,
      poll: {
        id: poll.id,
        question: poll.question,
        option_a: poll.option_a,
        option_b: poll.option_b,
        category: poll.category,
        image_a_url: poll.image_a_url,
        image_b_url: poll.image_b_url,
        visual_direction: vd || null,
        needs_manual_image: needsManualImage,
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('generate-poll error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
