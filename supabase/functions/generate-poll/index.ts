import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detect celebrity / public figure names
function isCelebrityName(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  const allCapitalized = words.every(w => /^[A-Z\u0600-\u06FF]/.test(w));
  if (!allCapitalized) return false;
  const productWords = /^(iphone|samsung|galaxy|coca|pepsi|nike|adidas|vodafone|orange|etisalat|noon|amazon|uber|careem|netflix|shahid|youtube|instagram|tiktok|facebook|twitter|whatsapp|spotify|apple|google|microsoft|toyota|bmw|mercedes|hyundai|kia)$/i;
  if (words.some(w => productWords.test(w))) return false;
  return true;
}

function getCelebrityImagePrompt(name: string, question: string): string {
  return `CELEBRITY POLL IMAGE — CINEMATIC MOVIE POSTER / STREAMING SCREEN STYLE

Create a dramatic, cinematic movie-poster-style image for "${name}" in the context of "${question}".

CONCEPT: Design a stylish, moody movie poster or streaming platform (like Netflix/Shahid) title card that prominently features the name "${name}" as the HERO TITLE TEXT.

MANDATORY ELEMENTS:
- The name "${name}" MUST appear as large, bold, elegant TITLE TEXT — like a movie title on a poster or a show title on a streaming app screen
- Cinematic dramatic lighting — dark background with spotlight effects, lens flares, or neon glow
- Film-grade color grading — deep blues, warm ambers, dramatic contrast
- A silhouette or abstract human figure in the background (NOT a real face — just a dramatic shadowy outline or artistic blur)
- Visual elements suggesting the entertainment industry: film grain, bokeh lights, stage lights, red carpet glow, or a theater/screen frame
- The overall feel should be PREMIUM and CINEMATIC — like an award-winning movie poster or a Shahid/Netflix original series card

STYLE: Dark cinematic photography, dramatic lighting, movie poster composition, 4:5 portrait, premium streaming platform aesthetic.

TEXT RULES: The name "${name}" MUST be rendered as stylish typography — think movie credits font, bold serif or elegant sans-serif, with cinematic effects (glow, shadow, metallic sheen).

STRICTLY FORBIDDEN: NO real human faces, NO photographs of actual people, NO logos of streaming platforms, NO brand names other than the person's name. The person's name IS the visual centerpiece.`;
}

// V4 Image prompt with visual_direction support
function buildImagePrompt(subject: string, question: string, visualDirection?: any): string {
  // If we have a visual_direction object, use it as the primary brief
  const sceneDirective = visualDirection
    ? `SCENE BRIEF: ${visualDirection.scene}. EMOTION: ${visualDirection.emotion}. CONTRAST TYPE: ${visualDirection.contrast_type || 'lifestyle contrast'}. PAIR RELATIONSHIP: ${visualDirection.pair_relationship || ''}.`
    : '';

  return `Cinematic lifestyle photograph that shows a Gen Z person performing the EXACT real-life behavior of: "${subject}". The behavior must be obvious in under 1 second; this is the user's "this is me" moment.

${sceneDirective}

IMAGE V4 RULES — ALL MANDATORY:
Rule 1: Real life scenes only. No abstract visuals, no icons, no AI-generated weird aesthetics.
Rule 2: Each image must represent THREE things simultaneously: a lifestyle, a feeling, and a status signal.
Rule 3: Strong visual contrast required with the paired option.
Rule 5: Add status signals — luxury environments when the option warrants it. Clean aspirational aesthetics always.
Rule 6: Real faces, real expressions, real human moments. No neutral stock behavior. No people looking at cameras.
Rule 7: MENA context mandatory — Egyptian or regional people, realistic Egyptian environments. Never default to Western/American/European settings.
Rule 8: Premium cinematic quality — warm tones, clean composition, DSLR-style photography. No logos, no text overlaid on images, no UI elements.
Rule 9: Human centered — people using or experiencing the option, not objects alone.
Rule 11: 1 second clarity test — the image must communicate the option meaning in under 1 second.

WHO (mandatory): ONE visible human subject aged 18–30, modern Gen Z appearance, casual trendy 2026 clothing, natural and expressive. Egyptian / MENA faces.

WHERE: realistic 2026 Egyptian environment — modern apartment, cafe, Cairo street, university, co-working, gym, Nile waterfront, mall, or social space. Culturally accurate.

ACTION (critical): the subject must be visibly DOING the behavior of "${subject}" — translate the option into a real-life usage scene.

STYLE: real DSLR / mirrorless photography, cinematic high-contrast lighting, close-up immersive framing, shallow depth of field, ONE clear subject, no clutter, 4:5 portrait, magazine-grade, TikTok / Instagram aesthetic.

STRICTLY FORBIDDEN: NO logos, NO brand names, NO wordmarks, NO typography, NO text of any kind inside the image, NO app interfaces, NO UI screenshots, NO phone-app mockups, NO collages, NO split visuals, NO posters, NO graphics, NO illustrations, NO 3D renders, NO abstract or symbolic visuals, NO watermarks, NO borders, NO alcohol imagery.`;
}

async function generateAndUploadImage(apiKey: string, prompt: string, supabase: any): Promise<string | null> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      console.error('Image generation failed:', response.status);
      return null;
    }

    const data = await response.json();
    const imageDataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageDataUrl) return null;

    const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) return null;

    const binaryString = atob(base64Match[2]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fileName = `ai-generated/${crypto.randomUUID()}.${base64Match[1]}`;
    const { error: uploadError } = await supabase.storage
      .from('poll-images')
      .upload(fileName, bytes, { contentType: `image/${base64Match[1]}`, upsert: false });

    if (uploadError) return null;

    return supabase.storage.from('poll-images').getPublicUrl(fileName).data.publicUrl;
  } catch {
    return null;
  }
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

    const mappedCategory = category === 'Media' ? 'Media & Entertainment' : category;
    const { data: existingPolls } = await supabase
      .from('polls').select('question').eq('category', mappedCategory || '')
      .order('created_at', { ascending: false }).limit(50);

    const existingQuestions = (existingPolls || []).map((p: any) => p.question);
    const avoidList = existingQuestions.length > 0
      ? `\n\nCRITICAL — AVOID DUPLICATES:\n${existingQuestions.map((q: string) => `- ${q}`).join('\n')}\nYou MUST create something DIFFERENT!`
      : '';

    const systemPrompt = `You are an expert poll creator for VERSA, a Gen Z cultural polling app targeting Egypt.

## POLL FORMAT RULE (MANDATORY)
Every poll option MUST follow this structure: [CHOICE] — [MEANING]
The meaning is a short emotional/psychological descriptor that primes identity.

Examples:
- "Crypto — high risk, high reward"
- "Luxury mall — polished brands and status"
- "Instapay — instant, cashless, modern"
- "Cash — trusted, tangible, in control"
- "Gym — discipline and gains"
- "Home workout — comfort and flexibility"

## POLL QUALITY RULES
Each poll MUST reveal at least TWO of:
- Spending behavior
- Lifestyle preference
- Psychological trait
- Brand tendency

Each poll MUST trigger at least ONE of:
- Identity: "this says something about who I am"
- Aspiration: "this is what I want to become"
- Tension: "I genuinely don't know which side I'm on"
- Curiosity: "I want to know what everyone else chose"

NEVER generate:
- Generic wording with no emotional charge
- Survey-style phrasing ("which do you prefer")
- Political topics or government criticism
- Complex multi-part questions
- Questions with obvious correct answers
- Anything related to alcohol

## QUESTION FORMAT
The question MUST be: "Option A vs Option B" (e.g., "Crypto vs Gold", "Gym vs Home workout")

## VISUAL DIRECTION (MANDATORY)
You MUST also output a visual_direction object for image generation:

{
  "question": "Option A vs Option B",
  "option_a": "Choice A — meaning",
  "option_b": "Choice B — meaning",
  "category": "<category>",
  "visual_direction": {
    "option_a_scene": "WHO + WHERE + EXACT ACTION + lighting and mood",
    "option_b_scene": "WHO + WHERE + EXACT ACTION + lighting and mood",
    "contrast_type": "e.g. local comfort vs global aspiration",
    "emotion_a": "the feeling option A image must convey",
    "emotion_b": "the feeling option B image must convey",
    "pair_relationship": "the core tension between the two options"
  }
}

${avoidList}

## CATEGORY RULE
Category MUST be EXACTLY one of: ${ALLOWED_CATEGORIES.join(', ')}

Category guide:
- FMCG & Food: packaged food, snacks, beverages
- Beauty & Personal Care: makeup, skincare, perfume
- Financial Services: banks, fintech, payments, wallets, crypto, business
- Media & Entertainment: movies, series, music, sports, celebrities, gaming
- Retail & E-commerce: shopping, stores, marketplaces
- Telco & Tech: telecom, apps, gadgets, software
- Food Delivery & Dining: restaurants, cafes, delivery apps
- Automotive & Mobility: cars, ride-hailing, scooters
- Lifestyle & Society: relationships, wellness, style, fashion, personality, habits, travel
- The Pulse: trending cultural debates

${targetAgeRange || targetGender || targetCountry ? `
AUDIENCE TARGETING:
${targetAgeRange ? `- Age: ${targetAgeRange}` : ''}
${targetGender ? `- Gender: ${targetGender}` : ''}
${targetCountry ? `- Country: ${targetCountry}` : ''}` : ''}

FOCUS ON EGYPTIAN culture, brands, food, and trends.
Random seed: ${randomSeed}

Respond with a VALID JSON object only.`;

    const userPrompt = category 
      ? `Create an identity-triggering poll in "${category}" for Egyptian Gen Z. Seed: ${randomSeed}. Timestamp: ${timestamp}.`
      : `Create an identity-triggering poll about any trending Egyptian topic. Seed: ${randomSeed}. Timestamp: ${timestamp}.`;

    const MAX_ATTEMPTS = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const attemptSeed = randomSeed + attempt * 123456;
      const attemptPrompt = attempt === 0 ? userPrompt
        : userPrompt + `\nATTEMPT ${attempt + 1}: Previous was duplicate. New seed: ${attemptSeed}`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: attemptPrompt }
          ],
          temperature: Math.min(0.9 + attempt * 0.1, 1.2),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        if (response.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        throw new Error(`AI Gateway error: ${response.status}`);
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
          if (content.toLowerCase().includes('cannot') || content.toLowerCase().includes('refuse')) {
            throw new Error('The AI cannot generate a poll for this category. Try a different topic.');
          }
          throw new Error('No JSON found in response');
        }
      } catch (parseError: any) {
        if (parseError.message.includes('cannot generate') || parseError.message.includes('different topic')) throw parseError;
        throw new Error('Failed to generate poll. Please try a different category.');
      }

      if (!pollData.question || !pollData.option_a || !pollData.option_b) throw new Error('Invalid poll data structure');

      // Clamp category
      const clampCategory = (raw: string | undefined | null): string => {
        const n = (raw || '').trim().toLowerCase();
        const exact = ALLOWED_CATEGORIES.find((c) => c.toLowerCase() === n);
        if (exact) return exact;
        if (/(deliver|restaurant|dining|cafe|café|talabat|elmenus)/.test(n)) return 'Food Delivery & Dining';
        if (/(beauty|makeup|skincare|cosmetic|perfume)/.test(n)) return 'Beauty & Personal Care';
        if (/(bank|finance|fintech|money|crypto|payment|wallet)/.test(n)) return 'Financial Services';
        if (/(telecom|mobile|phone|network|internet|tech|app|gadget)/.test(n)) return 'Telco & Tech';
        if (/(car|auto|mobility|ride|uber|careem)/.test(n)) return 'Automotive & Mobility';
        if (/(retail|shopping|ecommerce|store|brand|noon)/.test(n)) return 'Retail & E-commerce';
        if (/(movie|film|series|tv|celeb|music|sport|football|game|entertainment)/.test(n)) return 'Media & Entertainment';
        if (/(food|drink|snack|beverage|fmcg|coffee|tea|chips)/.test(n)) return 'FMCG & Food';
        if (/(lifestyle|society|relationship|wellness|fashion|personality|travel)/.test(n)) return 'Lifestyle & Society';
        return 'The Pulse';
      };
      pollData.category = clampCategory(pollData.category || category);

      // Generate images using visual_direction if available
      const vd = pollData.visual_direction;
      const bothCelebs = isCelebrityName(pollData.option_a) && isCelebrityName(pollData.option_b);

      let promptA: string, promptB: string;
      if (bothCelebs) {
        promptA = getCelebrityImagePrompt(pollData.option_a, pollData.question);
        promptB = getCelebrityImagePrompt(pollData.option_b, pollData.question);
      } else if (vd) {
        promptA = buildImagePrompt(pollData.option_a, pollData.question, {
          scene: vd.option_a_scene,
          emotion: vd.emotion_a,
          contrast_type: vd.contrast_type,
          pair_relationship: vd.pair_relationship,
        });
        promptB = buildImagePrompt(pollData.option_b, pollData.question, {
          scene: vd.option_b_scene,
          emotion: vd.emotion_b,
          contrast_type: vd.contrast_type,
          pair_relationship: vd.pair_relationship,
        });
      } else {
        promptA = buildImagePrompt(pollData.option_a, pollData.question);
        promptB = buildImagePrompt(pollData.option_b, pollData.question);
      }

      const [imageA, imageB] = await Promise.all([
        generateAndUploadImage(LOVABLE_API_KEY, promptA, supabase),
        generateAndUploadImage(LOVABLE_API_KEY, promptB, supabase),
      ]);

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
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          lastError = insertError;
          continue;
        }
        throw new Error('Failed to save poll to database');
      }

      // Send push notification
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
          body: JSON.stringify({ title: '🔥 New Poll!', body: `${poll.question} - Vote now!`, url: '/', poll_id: poll.id }),
        });
      } catch { /* non-critical */ }

      return new Response(JSON.stringify({
        success: true,
        poll: { id: poll.id, question: poll.question, option_a: poll.option_a, option_b: poll.option_b, category: poll.category, image_a_url: poll.image_a_url, image_b_url: poll.image_b_url }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: false, error: 'Could not generate a unique poll after multiple attempts. Try a different category.', duplicate: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
