import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateAndUploadImage(apiKey: string, prompt: string, supabase: any): Promise<string | null> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [{ role: 'user', content: `Generate a premium photorealistic product photograph: "${prompt}". Ultra sharp, DSLR quality, 4:3 ratio, no text/watermarks/logos overlaid, magazine quality.` }],
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
    const { userId, pollId, imageABrief, imageBBrief } = await req.json();
    
    // Verify admin
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').single();
    if (!role) return new Response(JSON.stringify({ error: 'Admin required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const [imageA, imageB] = await Promise.all([
      generateAndUploadImage(LOVABLE_API_KEY, imageABrief, supabase),
      generateAndUploadImage(LOVABLE_API_KEY, imageBBrief, supabase),
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
