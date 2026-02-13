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

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON from the response
    let trendingData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        trendingData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('Failed to parse:', content);
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
