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
            content: `Generate a stunning, ultra high resolution photorealistic photograph of: "${prompt}". 
            
Style requirements:
- Must look like a real photograph taken with a high-end DSLR or mirrorless camera
- Ultra sharp focus, fine detail, rich textures throughout
- Natural cinematic lighting with realistic shadows and highlights
- Lifestyle or editorial photography style, magazine-quality
- Real world setting, authentic environment
- 4:5 portrait aspect ratio
- NO illustrations, NO cartoons, NO digital art, NO graphics, NO AI artifacts
- NO text, NO watermarks, NO logos, NO borders
- Vibrant but natural color grading
- Shallow depth of field for subject emphasis

The image should look like it was shot by a top-tier professional photographer for a luxury lifestyle brand or Vogue editorial. Ultra high resolution.`
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

    const systemPrompt = `You are an expert poll creator for a social voting app called VERSA. 
Your job is to create simple "X vs Y" or "This or That" style comparison polls.

CRITICAL: VARIETY IS ESSENTIAL!
- NEVER repeat the same poll twice
- Each poll must be UNIQUE and DIFFERENT from common obvious choices
- Think creatively and explore diverse options within each category
- Random seed for this request: ${randomSeed} - use this to inspire variety

CRITICAL FORMAT RULES:
- The question MUST be exactly in this format: "Option A vs Option B" (e.g., "BMW vs Mercedes", "Pizza vs Pasta")
- Each option MUST be 1-2 words MAXIMUM
- NO sentence-style questions like "Would you rather..." or "Which do you prefer..."
- NO long descriptions - just simple, punchy comparisons
- Options should be well-known items, brands, or concepts that people can easily compare

Examples of CORRECT format:
- "iPhone vs Android"
- "Coffee vs Tea"
- "Netflix vs YouTube"
- "Summer vs Winter"
- "Nike vs Adidas"
- "Friends vs Suits"
- "Beach vs Mountains"

Guidelines:
- Create polls that spark debate between two comparable things
- Avoid controversial political, religious, or offensive topics
- Make polls that appeal to a broad audience
- Consider trending topics, pop culture, brands, food, travel, entertainment
- BE CREATIVE - don't always pick the most obvious comparison!
${targetAgeRange || targetGender || targetCountry ? `
AUDIENCE TARGETING - Create a poll specifically tailored for:
${targetAgeRange ? `- Age group: ${targetAgeRange} years old` : ''}
${targetGender ? `- Gender: ${targetGender}` : ''}
${targetCountry ? `- Country/Region: ${targetCountry}` : ''}
Make sure the poll topic, references, and language resonate with this specific demographic!` : ''}

You MUST respond with a valid JSON object with these exact fields:
{
  "question": "Option A vs Option B",
  "option_a": "Option A",
  "option_b": "Option B", 
  "category": "Category name"
}`;

    // Food category examples for variety
    const foodVariety = [
      "sushi, ramen, dim sum, pho, pad thai, bibimbap, curry, tacos, burritos, pizza, pasta, risotto, steak, burgers, hot dogs, fried chicken, BBQ ribs, lobster, crab, shrimp, salmon, oysters, caviar, foie gras",
      "ice cream, gelato, frozen yogurt, sorbet, cheesecake, tiramisu, crème brûlée, macarons, croissants, donuts, waffles, pancakes, french toast, bagels, muffins",
      "smoothies, milkshakes, boba tea, matcha, espresso, cappuccino, latte, cold brew, kombucha, fresh juice"
    ];

    const userPrompt = category 
      ? `Create a simple "X vs Y" comparison poll in the "${category}" category. 
         
IMPORTANT: Be creative and unique! Don't pick the most obvious choices.
${category.toLowerCase() === 'food' ? `Consider items like: ${foodVariety[Math.floor(Math.random() * foodVariety.length)]}` : ''}
Timestamp: ${timestamp} | Seed: ${randomSeed}
Remember: 1-2 words per option only, format as "X vs Y".`
      : `Create a simple "X vs Y" comparison poll about any trending topic. Pick from categories like: Food, Movies, Music, Sports, Travel, Technology, Fashion, Gaming, Lifestyle, Entertainment. 
         
IMPORTANT: Be creative and pick something unexpected!
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
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
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
