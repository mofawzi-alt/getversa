import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const today = new Date().toISOString().split('T')[0];
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a trend analyst for a social polling app targeting audiences in EGYPT. Your job is to identify current trending topics in Egypt that would make great "This vs That" style polls.

Focus on what's trending in Egypt right now:
- Egyptian pop culture, celebrities, and influencers
- Egyptian TV shows, movies, and music (Mahraganat, Arabic pop, etc.)
- Egyptian food culture and restaurant trends
- Egyptian sports (Al Ahly vs Zamalek, Egyptian Premier League, Mohamed Salah, etc.)
- Egyptian social media trends and viral content
- Egyptian brands, fashion, and lifestyle trends
- Egyptian cities, travel destinations, and local debates
- Regional events and news relevant to Egypt

Return a JSON array of exactly 8 trending topic categories with suggested poll ideas. Each should be timely and relevant to Egypt.

Format:
{
  "topics": [
    {
      "category": "Category Name",
      "trending_reason": "Brief reason why this is trending in Egypt",
      "poll_ideas": ["Poll idea 1", "Poll idea 2"],
      "heat_score": 85
    }
  ]
}

heat_score is 1-100 indicating how hot/trending this topic is in Egypt.`
          },
          {
            role: 'user',
            content: `Generate 8 trending topic categories in EGYPT for ${today}. Consider:
- Egyptian pop culture & celebrities (actors, singers, influencers)
- Egyptian TV shows, series & movies (Ramadan series, cinema releases)
- Egyptian food & restaurants (koshari, shawarma, new restaurant openings)
- Egyptian football & sports (Al Ahly, Zamalek, Premier League, Mohamed Salah)
- Egyptian social media viral trends
- Egyptian brands & fashion
- Egyptian music (Mahraganat, Amr Diab, new releases)
- Cairo vs Alexandria debates, Egyptian lifestyle

Make them diverse and engaging for an Egyptian Gen Z / Millennial audience. Use Egyptian cultural references.`
          }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const rawText = await response.text();
    let aiData;
    try {
      aiData = JSON.parse(rawText);
    } catch {
      console.error('Failed to parse AI gateway response:', rawText.substring(0, 500));
      throw new Error('Invalid response from AI gateway');
    }

    const content = aiData.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Robust JSON extraction
    let trendingData;
    try {
      let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonStart = cleaned.search(/[\{\[]/);
      const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found');
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

      try {
        trendingData = JSON.parse(cleaned);
      } catch {
        cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/[\x00-\x1F\x7F]/g, '');
        try {
          trendingData = JSON.parse(cleaned);
        } catch {
          let braces = 0, brackets = 0;
          for (const c of cleaned) {
            if (c === '{') braces++; if (c === '}') braces--;
            if (c === '[') brackets++; if (c === ']') brackets--;
          }
          let repaired = cleaned;
          while (brackets > 0) { repaired += ']'; brackets--; }
          while (braces > 0) { repaired += '}'; braces--; }
          trendingData = JSON.parse(repaired);
        }
      }
    } catch (parseError) {
      console.error('Failed to parse trending content:', content.substring(0, 500));
      throw new Error('Failed to parse trending topics');
    }

    return new Response(JSON.stringify(trendingData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
