import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLLS = [
  {order:1,question:"iPhone or Samsung?",option_a:"iPhone",option_b:"Samsung",tags:["Brand Loyalty","Digital Behavior"],category:"Tech",prompt_a:"Official Apple iPhone product photograph, clean studio shot, dark moody background, premium lighting, centered composition, ultra sharp, photorealistic, magazine quality, vertical 9:16, no text, no watermark",prompt_b:"Official Samsung Galaxy smartphone product photograph, clean studio shot, dark moody background, premium lighting, centered composition, ultra sharp, photorealistic, magazine quality, vertical 9:16, no text, no watermark"},
  {order:2,question:"Ahly or Zamalek?",option_a:"Ahly",option_b:"Zamalek",tags:["Cultural Identity"],category:"Sports",prompt_a:"Al Ahly SC red football jersey hanging in a premium Egyptian stadium setting, dramatic stadium lights, red color theme, professional sports photography, vertical 9:16, ultra sharp, no text, no watermark, no logos overlaid",prompt_b:"Zamalek SC white football jersey hanging in a premium Egyptian stadium setting, dramatic stadium lights, white color theme, professional sports photography, vertical 9:16, ultra sharp, no text, no watermark, no logos overlaid"},
  {order:3,question:"Delivery or cook at home?",option_a:"Delivery",option_b:"Cook at home",tags:["Lifestyle Aspiration","Social Values"],category:"Lifestyle",prompt_a:"Premium food delivery insulated bag and takeout containers on a dark moody table, warm cinematic lighting, professional food photography, vertical 9:16, ultra sharp, no text, no watermark",prompt_b:"Beautiful modern home kitchen with someone preparing a fresh meal, warm golden hour lighting, ingredients on counter, cinematic photography, vertical 9:16, ultra sharp, no text, no watermark"},
  {order:4,question:"Cairo or Dubai to live?",option_a:"Cairo",option_b:"Dubai",tags:["Lifestyle Aspiration","Cultural Identity"],category:"Lifestyle",prompt_a:"Cairo skyline at night featuring the Nile River, Cairo Tower, and bridge lights, twinkling city lights, deep blue sky, cinematic photography, vertical 9:16, ultra sharp, no text, no watermark",prompt_b:"Dubai skyline at night featuring Burj Khalifa, Dubai Marina, golden city lights, deep blue sky, cinematic photography, vertical 9:16, ultra sharp, no text, no watermark"},
  {order:5,question:"Pepsi or Coke?",option_a:"Pepsi",option_b:"Coke",tags:["Brand Loyalty"],category:"Brands",prompt_a:"Ice cold Pepsi can centered on dark background, condensation droplets, dramatic blue rim lighting, premium product photography, vertical 9:16, ultra sharp, no text overlay, no watermark",prompt_b:"Ice cold Coca-Cola can centered on dark background, condensation droplets, dramatic red rim lighting, premium product photography, vertical 9:16, ultra sharp, no text overlay, no watermark"},
  {order:6,question:"Save or invest?",option_a:"Save",option_b:"Invest",tags:["Financial Identity"],category:"Money",prompt_a:"Stack of gold coins and Egyptian pound notes neatly arranged on dark surface, warm premium lighting, financial photography, vertical 9:16, ultra sharp, no text, no watermark",prompt_b:"Rising green stock chart with gold bars in foreground, upward trend line, dark premium financial background, cinematic lighting, vertical 9:16, ultra sharp, no text, no watermark"},
  {order:7,question:"Startup or corporate job?",option_a:"Startup",option_b:"Corporate",tags:["Career Ambition","Financial Identity"],category:"Work",prompt_a:"Young entrepreneur working on laptop in modern coworking space, exposed brick walls, plants, energetic warm lighting, cinematic photography, vertical 9:16, ultra sharp, no text, no watermark",prompt_b:"Premium glass corporate office tower exterior at dusk, professional structured architecture, dramatic blue hour lighting, cinematic photography, vertical 9:16, ultra sharp, no text, no watermark"},
  {order:8,question:"Big wedding or intimate?",option_a:"Big wedding",option_b:"Intimate",tags:["Social Values"],category:"Lifestyle",prompt_a:"Grand Egyptian wedding ballroom with sparkling chandeliers, large crowd celebrating, golden warm lighting, luxurious decor, cinematic photography, vertical 9:16, ultra sharp, no text, no watermark",prompt_b:"Small intimate outdoor garden wedding at golden hour, close friends gathered around couple, string lights, romantic warm lighting, cinematic photography, vertical 9:16, ultra sharp, no text, no watermark"},
  {order:9,question:"WhatsApp or Telegram?",option_a:"WhatsApp",option_b:"Telegram",tags:["Digital Behavior"],category:"Apps",prompt_a:"Smartphone screen showing WhatsApp green chat interface on dark background, premium product shot, clean composition, vertical 9:16, ultra sharp, photorealistic, no extra text, no watermark",prompt_b:"Smartphone screen showing Telegram blue chat interface on dark background, premium product shot, clean composition, vertical 9:16, ultra sharp, photorealistic, no extra text, no watermark"},
  {order:10,question:"Koshary or pasta?",option_a:"Koshary",option_b:"Pasta",tags:["Cultural Identity"],category:"Food",prompt_a:"Traditional Egyptian koshary in beautiful bowl with rice lentils pasta crispy onions and tomato sauce, rich textures, warm street food photography, dark wooden table, vertical 9:16, ultra sharp, no text, no watermark",prompt_b:"Elegant Italian pasta dish on white plate with herbs and parmesan, fine dining presentation, warm restaurant lighting, dark moody background, vertical 9:16, ultra sharp, no text, no watermark"},
  {order:11,question:"Compound or city apartment?",option_a:"Compound",option_b:"City apartment",tags:["Lifestyle Aspiration"],category:"Lifestyle",prompt_a:"Aerial view of premium Egyptian gated compound with swimming pools, lush greenery, modern villas, golden hour lighting, architectural photography, vertical 9:16, ultra sharp, no text, no watermark",prompt_b:"High floor Cairo city apartment interior with floor to ceiling windows showing Nile River and city skyline at night, modern luxury interior, cinematic photography, vertical 9:16, ultra sharp, no text, no watermark"},
  {order:12,question:"Netflix or Shahid?",option_a:"Netflix",option_b:"Shahid",tags:["Brand Loyalty","Digital Behavior"],category:"Apps",prompt_a:"TV screen displaying Netflix red interface on dark living room background, premium product shot, cinematic atmosphere, vertical 9:16, ultra sharp, photorealistic, no extra text, no watermark",prompt_b:"TV screen displaying Shahid streaming interface on dark living room background, Arabic content posters visible, premium product shot, cinematic atmosphere, vertical 9:16, ultra sharp, photorealistic, no extra text, no watermark"},
  {order:13,question:"Work from home or office?",option_a:"Work from home",option_b:"Office",tags:["Career Ambition","Social Values"],category:"Work",prompt_a:"Clean premium home office setup with wooden desk, laptop, plants, books, warm afternoon lighting through window, cozy professional, cinematic photography, vertical 9:16, ultra sharp, no text, no watermark",prompt_b:"Modern open plan corporate office with glass walls, professionals working, clean minimalist design, bright daylight, cinematic photography, vertical 9:16, ultra sharp, no text, no watermark"},
  {order:14,question:"Noon or Amazon Egypt?",option_a:"Noon",option_b:"Amazon",tags:["Brand Loyalty"],category:"Brands",prompt_a:"Yellow Noon delivery box with branded packaging on dark wooden surface, premium product photography, dramatic lighting, vertical 9:16, ultra sharp, no extra text overlay, no watermark",prompt_b:"Amazon brown delivery box with smile arrow on dark wooden surface, premium product photography, dramatic lighting, vertical 9:16, ultra sharp, no extra text overlay, no watermark"},
  {order:15,question:"Starbucks or local cafe?",option_a:"Starbucks",option_b:"Local cafe",tags:["Cultural Identity","Brand Loyalty"],category:"Food",prompt_a:"Starbucks coffee cup with green logo clearly visible on dark wooden table, steam rising, premium product photography, warm lighting, vertical 9:16, ultra sharp, no extra text, no watermark",prompt_b:"Beautiful authentic Egyptian local cafe interior with traditional decor, brass coffee pots, warm amber lighting, characterful atmosphere, cinematic photography, vertical 9:16, ultra sharp, no text, no watermark"},
  {order:16,question:"TikTok or Instagram?",option_a:"TikTok",option_b:"Instagram",tags:["Digital Behavior"],category:"Apps",prompt_a:"Smartphone screen showing TikTok app interface with vertical video on dark background, premium product shot, clean composition, vertical 9:16, ultra sharp, photorealistic, no extra text, no watermark",prompt_b:"Smartphone screen showing Instagram app interface with photo grid on dark background, premium product shot, clean composition, vertical 9:16, ultra sharp, photorealistic, no extra text, no watermark"},
  {order:17,question:"Cash or card?",option_a:"Cash",option_b:"Card",tags:["Financial Identity"],category:"Money",prompt_a:"Egyptian pound notes fanned out close up on dark surface, premium currency photography, warm dramatic lighting, vertical 9:16, ultra sharp, no extra text, no watermark",prompt_b:"Premium black credit card on dark minimalist surface, sleek metallic finish, dramatic side lighting, luxury product photography, vertical 9:16, ultra sharp, no extra text, no watermark"},
  {order:18,question:"Sahel or Sharm?",option_a:"Sahel",option_b:"Sharm",tags:["Cultural Identity","Lifestyle Aspiration"],category:"Travel",prompt_a:"North Coast Sahel Egypt beach with Mediterranean turquoise water, white sand, beach umbrellas, summer paradise, golden afternoon lighting, travel photography, vertical 9:16, ultra sharp, no text, no watermark",prompt_b:"Sharm El Sheikh Red Sea crystal clear blue water with coral reef visible, luxury resort beach, palm trees, sunny tropical paradise, travel photography, vertical 9:16, ultra sharp, no text, no watermark"},
  {order:19,question:"Rent or buy apartment?",option_a:"Rent",option_b:"Buy",tags:["Financial Identity","Lifestyle Aspiration"],category:"Money",prompt_a:"Hand holding modern apartment keys with rental agreement papers on table, warm welcoming lighting, lifestyle photography, vertical 9:16, ultra sharp, no extra text, no watermark",prompt_b:"Premium modern apartment building exterior at golden hour, ownership pride, architectural photography, dramatic lighting, vertical 9:16, ultra sharp, no extra text, no watermark"},
  {order:20,question:"Egypt or abroad for work?",option_a:"Egypt",option_b:"Abroad",tags:["Career Ambition","Cultural Identity"],category:"Work",prompt_a:"Cairo skyline with Egyptian pyramids and Nile in distance at sunset, pride identity home, golden warm lighting, cinematic photography, vertical 9:16, ultra sharp, no text, no watermark",prompt_b:"International airport departure gate with airplane visible through window at dusk, ambition opportunity, dramatic blue hour lighting, cinematic travel photography, vertical 9:16, ultra sharp, no text, no watermark"}
];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24).replace(/^_|_$/g, '') || 'img';
}

async function genImage(apiKey: string, prompt: string): Promise<Uint8Array | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3.1-flash-image-preview',
          messages: [{ role: 'user', content: prompt }],
          modalities: ['image', 'text'],
        }),
      });
      if (!r.ok) {
        console.log(`gen attempt ${attempt} fail:`, r.status, await r.text().catch(() => ''));
        continue;
      }
      const d = await r.json();
      const url = d.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!url) continue;
      const m = url.match(/^data:image\/\w+;base64,(.+)$/);
      if (!m) continue;
      const bin = atob(m[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch (e) {
      console.log(`gen exception attempt ${attempt}:`, String(e));
    }
  }
  return null;
}

async function processPoll(supabase: any, apiKey: string, p: any, adminUserId: string) {
  // Skip if onboarding slot already filled with a working poll
  const { data: existing } = await supabase
    .from('onboarding_polls')
    .select('poll_id, polls!inner(image_a_url, image_b_url)')
    .eq('display_order', p.order)
    .maybeSingle();
  if (existing && existing.polls?.image_a_url && existing.polls?.image_b_url) {
    return { order: p.order, status: 'already_done', poll_id: existing.poll_id };
  }

  // Generate both images in parallel
  const [imgA, imgB] = await Promise.all([genImage(apiKey, p.prompt_a), genImage(apiKey, p.prompt_b)]);
  if (!imgA || !imgB) return { order: p.order, status: 'image_failed' };

  const pathA = `onboarding/${String(p.order).padStart(2, '0')}_a_${slug(p.option_a)}.png`;
  const pathB = `onboarding/${String(p.order).padStart(2, '0')}_b_${slug(p.option_b)}.png`;
  const [uA, uB] = await Promise.all([
    supabase.storage.from('poll-images').upload(pathA, imgA, { contentType: 'image/png', upsert: true }),
    supabase.storage.from('poll-images').upload(pathB, imgB, { contentType: 'image/png', upsert: true }),
  ]);
  if (uA.error || uB.error) return { order: p.order, status: 'upload_failed', err: uA.error?.message || uB.error?.message };

  const urlA = supabase.storage.from('poll-images').getPublicUrl(pathA).data.publicUrl;
  const urlB = supabase.storage.from('poll-images').getPublicUrl(pathB).data.publicUrl;

  let pollId: string;
  if (existing) {
    // Reuse existing poll row, just update content
    pollId = existing.poll_id;
    const { error } = await supabase.from('polls').update({
      question: p.question, option_a: p.option_a, option_b: p.option_b,
      image_a_url: urlA, image_b_url: urlB,
      tags: p.tags, category: p.category, is_active: true,
    }).eq('id', pollId);
    if (error) return { order: p.order, status: 'update_failed', err: error.message };
  } else {
    const { data: created, error } = await supabase.from('polls').insert({
      question: p.question, option_a: p.option_a, option_b: p.option_b,
      image_a_url: urlA, image_b_url: urlB,
      tags: p.tags, category: p.category,
      is_active: true, expiry_type: 'evergreen',
      created_by: adminUserId, weight_score: 600,
    }).select('id').single();
    if (error || !created) return { order: p.order, status: 'insert_failed', err: error?.message };
    pollId = created.id;

    const { error: linkErr } = await supabase.from('onboarding_polls').insert({
      poll_id: pollId, display_order: p.order,
    });
    if (linkErr) return { order: p.order, status: 'link_failed', err: linkErr.message };
  }
  return { order: p.order, status: 'ok', poll_id: pollId };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const apiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const body = await req.json().catch(() => ({}));
    const onlyOrders: number[] | null = Array.isArray(body.orders) ? body.orders : null;
    const adminUserId: string = body.adminUserId;
    if (!adminUserId) {
      return new Response(JSON.stringify({ error: 'adminUserId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const target = onlyOrders ? POLLS.filter(p => onlyOrders.includes(p.order)) : POLLS;
    const results: any[] = [];
    // Process 3 at a time for stability
    for (let i = 0; i < target.length; i += 3) {
      const batch = target.slice(i, i + 3);
      const r = await Promise.all(batch.map(p => processPoll(supabase, apiKey, p, adminUserId).catch(e => ({ order: p.order, status: 'error', err: String(e) }))));
      results.push(...r);
    }
    return new Response(JSON.stringify({ results, summary: { total: target.length, ok: results.filter(r => r.status === 'ok' || r.status === 'already_done').length } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
