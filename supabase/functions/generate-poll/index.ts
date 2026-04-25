import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateAndUploadImage(apiKey: string, prompt: string, supabase: any): Promise<string | null> {
  console.log('Generating image for:', prompt);
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [
          {
            role: 'user',
            content: `Cinematic lifestyle photograph that REPRESENTS the real-life experience and feeling of: "${prompt}".

MANDATORY STYLE:
- Real DSLR/mirrorless photography (NOT illustration, 3D, render, or AI art)
- Cinematic high-contrast lighting, editorial mood
- Close-up immersive framing, ONE clear subject
- Shallow depth of field, blurred background
- Emotion-driven, candid real-life moment
- TikTok / Instagram social-media aesthetic
- 4:5 portrait, ultra sharp, magazine quality
- Use Egyptian / Middle Eastern environments and people when culturally relevant; avoid defaulting to Western-only visuals

STRICTLY FORBIDDEN:
- NO logos, NO brand names, NO wordmarks, NO typography
- NO text of any kind inside the image
- NO app interfaces, NO UI screenshots, NO phone mockups showing apps
- NO collages, NO split visuals, NO posters, NO graphics
- NO watermarks, NO borders

Show the EXPERIENCE — people, hands, environments, products in authentic use — not a label or a brand.`
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Image generation failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const imageDataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageDataUrl) {
      console.log('No image in response:', JSON.stringify(data));
      return null;
    }

    // Extract base64 data from data URL
    const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      console.error('Invalid image data format');
      return null;
    }

    const imageType = base64Match[1];
    const base64Data = base64Match[2];

    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to storage
    const fileName = `ai-generated/${crypto.randomUUID()}.${imageType}`;
    const { error: uploadError } = await supabase.storage
      .from('poll-images')
      .upload(fileName, bytes, {
        contentType: `image/${imageType}`,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('poll-images')
      .getPublicUrl(fileName);

    console.log('Image uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error generating/uploading image:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Parse request body first to get userId
    const { category, userId, targetAgeRange, targetGender, targetCountry } = await req.json();
    
    if (!userId) {
      console.error('Missing userId in request');
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Generating poll for category:', category, 'userId:', userId, 'targeting:', { targetAgeRange, targetGender, targetCountry });

    // Create service role client for admin verification
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user has admin role using service role (bypasses RLS)
    const { data: adminRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (roleError || !adminRole) {
      console.error('Admin role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Generate a random seed for variety
    const randomSeed = Math.floor(Math.random() * 1000000);
    const timestamp = Date.now();

    const ALLOWED_CATEGORIES = [
      'FMCG & Food',
      'Beauty & Personal Care',
      'Financial Services',
      'Media & Entertainment',
      'Retail & E-commerce',
      'Telco & Tech',
      'Food Delivery & Dining',
      'Automotive & Mobility',
      'Lifestyle & Society',
      'The Pulse',
    ];

    const systemPrompt = `You are an expert poll creator for a social voting app called VERSA, targeting audiences in EGYPT. 
Your job is to create simple "X vs Y" or "This or That" style comparison polls that resonate with Egyptian culture.

CRITICAL: VARIETY IS ESSENTIAL!
- NEVER repeat the same poll twice
- Each poll must be UNIQUE and DIFFERENT from common obvious choices
- Think creatively and explore diverse options within each category
- Random seed for this request: ${randomSeed} - use this to inspire variety
- FOCUS ON EGYPTIAN culture, brands, food, celebrities, and trends

CRITICAL FORMAT RULES:
- The question MUST be exactly in this format: "Option A vs Option B" (e.g., "Al Ahly vs Zamalek", "Koshari vs Foul")
- Each option MUST be 1-2 words MAXIMUM
- NO sentence-style questions like "Would you rather..." or "Which do you prefer..."
- NO long descriptions - just simple, punchy comparisons
- Options should be well-known items, brands, or concepts that Egyptians can easily compare

Examples of CORRECT format:
- "Al Ahly vs Zamalek"
- "Koshari vs Shawarma"
- "Cairo vs Alex"
- "Amr Diab vs Tamer Hosny"
- "Sobhy vs Gad"
- "Summer vs Winter"
- "iPhone vs Android"
- "Netflix vs Shahid"

Guidelines:
- Create polls that spark debate between two comparable things
- Prioritize Egyptian and Middle Eastern cultural references
- Include Egyptian brands, restaurants, celebrities, food, sports
- Avoid controversial political, religious, or offensive topics
- Make polls that appeal to Egyptian Gen Z / Millennial audience
- Consider trending topics in Egypt, Egyptian pop culture, and local debates
- BE CREATIVE - don't always pick the most obvious comparison!
${targetAgeRange || targetGender || targetCountry ? `
AUDIENCE TARGETING - Create a poll specifically tailored for:
${targetAgeRange ? `- Age group: ${targetAgeRange} years old` : ''}
${targetGender ? `- Gender: ${targetGender}` : ''}
${targetCountry ? `- Country/Region: ${targetCountry}` : ''}
Make sure the poll topic, references, and language resonate with this specific demographic!` : ''}

CRITICAL CATEGORY RULE:
The "category" field MUST be EXACTLY one of these 10 values (copy verbatim, no variations):
${ALLOWED_CATEGORIES.map((c) => `- ${c}`).join('\n')}

Category guide:
- FMCG & Food: packaged food, snacks, beverages (Coca-Cola, Chipsy, Cadbury, Galaxy)
- Beauty & Personal Care: makeup, skincare, shampoo, perfume
- Financial Services: banks, fintech, payments, wallets, business/startups
- Media & Entertainment: movies, series, music, sports, celebrities, gaming
- Retail & E-commerce: shopping, stores, marketplaces (Noon, Amazon, Jumia)
- Telco & Tech: telecom (Vodafone, Orange, Etisalat, WE), apps, gadgets, software
- Food Delivery & Dining: restaurants, cafes, delivery apps (Talabat, elmenus)
- Automotive & Mobility: cars, ride-hailing (Uber, Careem, Swvl), scooters
- Lifestyle & Society: relationships, wellness, style, fashion, personality, habits, travel
- The Pulse: trending cultural/political/news debates (Al Ahly vs Zamalek, Cairo vs Alex)

You MUST respond with a valid JSON object with these exact fields:
{
  "question": "Option A vs Option B",
  "option_a": "Option A",
  "option_b": "Option B",
  "category": "<one of the 10 categories above, exactly>"
}`;

    // Food category examples for variety
    const foodVariety = [
      "koshari, foul, taameya, shawarma, hawawshi, molokhia, fateer, konafa, basbousa, mahshi, kebab, kofta, feteer meshaltet, ful medames, roz bel laban",
      "sushi, ramen, pizza, pasta, burgers, tacos, dim sum, pad thai, biryani, steak, fried chicken, BBQ",
      "sahlab, karkade, sugarcane juice, qamar el din, boba tea, Turkish coffee, Nescafe, fresh mango juice, lemon mint"
    ];

    const userPrompt = category 
      ? `Create a simple "X vs Y" comparison poll in the "${category}" category that resonates with Egyptian audiences. 
         
IMPORTANT: Be creative and unique! Use Egyptian cultural references when possible.
${category.toLowerCase() === 'food' ? `Consider Egyptian food items like: ${foodVariety[Math.floor(Math.random() * foodVariety.length)]}` : ''}
Timestamp: ${timestamp} | Seed: ${randomSeed}
Remember: 1-2 words per option only, format as "X vs Y".`
      : `Create a simple "X vs Y" comparison poll about any trending topic in Egypt. Pick from categories like: Egyptian Food, Egyptian TV/Movies, Egyptian Music, Egyptian Football, Cairo Life, Egyptian Fashion, Gaming, Technology, Egyptian Brands, Lifestyle. 
         
IMPORTANT: Be creative and pick something that Egyptians would love to debate!
Timestamp: ${timestamp} | Seed: ${randomSeed}
Remember: 1-2 words per option only, format as "X vs Y".`;

    console.log('Calling Lovable AI Gateway for poll content...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    console.log('AI Response:', JSON.stringify(aiData));
    
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON from the response
    let pollData;
    try {
      // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        pollData = JSON.parse(jsonMatch[0]);
      } else {
        // AI refused or returned non-JSON - provide a helpful error message
        if (content.toLowerCase().includes('cannot') || content.toLowerCase().includes('refuse') || content.toLowerCase().includes('guidelines')) {
          console.error('AI declined to generate poll:', content);
          throw new Error('The AI cannot generate a poll for this category. Please try a different topic like Food, Sports, Entertainment, or Technology.');
        }
        throw new Error('No JSON found in response');
      }
    } catch (parseError: any) {
      console.error('Failed to parse AI response:', content);
      // Provide more helpful error message
      if (parseError.message.includes('cannot generate') || parseError.message.includes('different topic')) {
        throw parseError;
      }
      throw new Error('Failed to generate poll. Please try a different category.');
    }

    // Validate the poll data
    if (!pollData.question || !pollData.option_a || !pollData.option_b) {
      console.error('Invalid poll data:', pollData);
      throw new Error('Invalid poll data structure');
    }

    // Clamp category to allowed list (server-side enforcement)
    const clampCategory = (raw: string | undefined | null): string => {
      const n = (raw || '').trim().toLowerCase();
      const exact = ALLOWED_CATEGORIES.find((c) => c.toLowerCase() === n);
      if (exact) return exact;
      if (/(deliver|restaurant|dining|cafe|café|talabat|elmenus|otlob)/.test(n)) return 'Food Delivery & Dining';
      if (/(beauty|makeup|skincare|cosmetic|shampoo|perfume|hair)/.test(n)) return 'Beauty & Personal Care';
      if (/(bank|finance|fintech|money|budget|crypto|payment|wallet|loan|business|startup)/.test(n)) return 'Financial Services';
      if (/(telecom|mobile|phone|network|internet|wifi|tech|app|software|gadget|telco)/.test(n)) return 'Telco & Tech';
      if (/(car|auto|vehicle|mobility|ride|uber|careem|swvl|motorcycle|scooter)/.test(n)) return 'Automotive & Mobility';
      if (/(retail|shopping|ecommerce|e-commerce|store|brand|noon|jumia|amazon)/.test(n)) return 'Retail & E-commerce';
      if (/(movie|film|series|tv|show|celeb|music|song|artist|sport|football|game|gaming|entertainment)/.test(n)) return 'Media & Entertainment';
      if (/(food|drink|snack|beverage|fmcg|coffee|tea|chips|cola|juice|chocolate)/.test(n)) return 'FMCG & Food';
      if (/(lifestyle|society|relationship|dating|wellness|habit|style|fashion|design|personality|travel)/.test(n)) return 'Lifestyle & Society';
      return 'The Pulse';
    };
    pollData.category = clampCategory(pollData.category || category);

    // Generate images for both options in parallel and upload to storage
    console.log('Generating images for poll options...');
    const [imageA, imageB] = await Promise.all([
      generateAndUploadImage(LOVABLE_API_KEY, pollData.option_a, supabase),
      generateAndUploadImage(LOVABLE_API_KEY, pollData.option_b, supabase),
    ]);

    console.log('Image A generated:', !!imageA);
    console.log('Image B generated:', !!imageB);

    const startsAt = new Date();
    const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

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
      console.error('Database insert error:', insertError);
      // If duplicate, return a friendly message instead of crashing
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ 
          ok: false,
          error: 'This poll already exists. Try generating again.',
          duplicate: true 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('Failed to save poll to database');
    }

    console.log('Poll created successfully with images:', poll.id);

    // Send push notifications for new poll
    try {
      const notificationResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          title: '🔥 New Poll!',
          body: `${poll.question} - Vote now!`,
          url: '/',
          poll_id: poll.id,
        }),
      });
      
      const notifResult = await notificationResponse.json();
      console.log('Push notification result:', notifResult);
    } catch (notifError) {
      console.error('Failed to send push notifications:', notifError);
      // Don't fail the whole request if notifications fail
    }

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
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-poll function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
