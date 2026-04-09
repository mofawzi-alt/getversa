import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PollSpec {
  question: string;
  subtitle?: string;
  option_a: string;
  option_b: string;
  category: string;
  expiry_type: 'evergreen' | 'trending' | 'brand_battle';
  image_a_brief: string;
  image_b_brief: string;
}

async function generateAndUploadImage(apiKey: string, prompt: string, supabase: any): Promise<string | null> {
  console.log('Generating image for:', prompt.substring(0, 60));
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [{
          role: 'user',
          content: `Generate a stunning, ultra high resolution photorealistic photograph of: "${prompt}". 
Style: Real photograph, DSLR quality, 4:3 aspect ratio, no text, no watermarks, no logos overlay, no borders, magazine-quality, vibrant natural colors. Product shots should be clean and premium.`
        }],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      console.error('Image gen failed:', response.status);
      return null;
    }

    const data = await response.json();
    const imageDataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageDataUrl) return null;

    const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) return null;

    const imageType = base64Match[1];
    const base64Data = base64Match[2];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fileName = `ai-generated/${crypto.randomUUID()}.${imageType}`;
    const { error: uploadError } = await supabase.storage
      .from('poll-images')
      .upload(fileName, bytes, { contentType: `image/${imageType}`, upsert: false });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage.from('poll-images').getPublicUrl(fileName);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error generating image:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const { userId, polls: pollSpecs } = await req.json() as { userId: string; polls: PollSpec[] };
    if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').single();
    if (!adminRole) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const results: any[] = [];

    // Process polls sequentially (to avoid rate limits)
    for (let i = 0; i < pollSpecs.length; i++) {
      const spec = pollSpecs[i];
      console.log(`Processing poll ${i + 1}/${pollSpecs.length}: ${spec.question}`);

      // Generate both images in parallel
      const [imageA, imageB] = await Promise.all([
        generateAndUploadImage(LOVABLE_API_KEY, spec.image_a_brief, supabase),
        generateAndUploadImage(LOVABLE_API_KEY, spec.image_b_brief, supabase),
      ]);

      const { data: poll, error } = await supabase
        .from('polls')
        .insert({
          question: spec.question,
          subtitle: spec.subtitle || null,
          option_a: spec.option_a,
          option_b: spec.option_b,
          category: spec.category,
          expiry_type: spec.expiry_type,
          created_by: userId,
          is_daily_poll: true,
          is_active: true,
          image_a_url: imageA,
          image_b_url: imageB,
          weight_score: 500,
        })
        .select('id, question')
        .single();

      if (error) {
        console.error(`Failed to insert poll ${i + 1}:`, error);
        results.push({ index: i + 1, question: spec.question, success: false, error: error.message });
      } else {
        console.log(`Poll ${i + 1} created: ${poll.id}`);
        results.push({ index: i + 1, question: spec.question, success: true, id: poll.id, hasImageA: !!imageA, hasImageB: !!imageB });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Batch create error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
