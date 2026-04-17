import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { campaignId } = await req.json();
    if (!campaignId || typeof campaignId !== 'string') {
      return new Response(JSON.stringify({ error: 'campaignId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Auth check + fetch campaign meta
    const { data: campaign, error: campErr } = await supabase
      .from('poll_campaigns')
      .select('id, name, brand_name, description')
      .eq('id', campaignId)
      .maybeSingle();

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found or no access' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pull analytics + demographics via RPC (auth applied)
    const [{ data: results }, { data: demos }] = await Promise.all([
      supabase.rpc('get_campaign_analytics', { p_campaign_id: campaignId }),
      supabase.rpc('get_campaign_demographics', { p_campaign_id: campaignId }),
    ]);

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ insights: 'No vote data yet. Insights will appear once polls collect responses.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compact summary for the model
    const totalVotes = results.reduce((s: number, r: any) => s + Number(r.total_votes || 0), 0);
    const pollsSummary = results.map((r: any, i: number) => ({
      n: i + 1,
      q: r.question,
      a: r.option_a,
      b: r.option_b,
      pct_a: r.percent_a,
      pct_b: r.percent_b,
      votes: r.total_votes,
    }));

    // Compress demographics into top buckets
    const demoBuckets: Record<string, Record<string, { A: number; B: number }>> = {};
    (demos || []).forEach((row: any) => {
      const t = row.segment_type;
      const v = row.segment_value || 'unknown';
      if (!demoBuckets[t]) demoBuckets[t] = {};
      if (!demoBuckets[t][v]) demoBuckets[t][v] = { A: 0, B: 0 };
      demoBuckets[t][v][row.choice as 'A' | 'B'] += Number(row.vote_count);
    });

    const demoSummary: Record<string, Array<{ segment: string; pct_a: number; total: number }>> = {};
    Object.entries(demoBuckets).forEach(([type, segs]) => {
      demoSummary[type] = Object.entries(segs)
        .map(([seg, c]) => {
          const total = c.A + c.B;
          return {
            segment: seg,
            pct_a: total ? Math.round((c.A / total) * 100) : 0,
            total,
          };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);
    });

    const systemPrompt = `You are a senior brand strategist writing concise insight reports for the Versa polling platform. Write in confident, plain English. Avoid hedging. No emojis. Output strict markdown only.`;

    const userPrompt = `Generate an executive insights summary for this campaign.

Campaign: "${campaign.name}"${campaign.brand_name ? ` · ${campaign.brand_name}` : ''}
${campaign.description ? `Brief: ${campaign.description}\n` : ''}
Total responses: ${totalVotes.toLocaleString()}
Polls (${results.length}):
${JSON.stringify(pollsSummary, null, 2)}

Demographic snapshot (top segments, % chose Option A):
${JSON.stringify(demoSummary, null, 2)}

Write the report with these markdown sections (keep each section short and specific):

## Headline
One sentence capturing the single most important takeaway.

## Key Findings
3–5 bullets. Reference exact percentages and which option won.

## Audience Surprises
2–3 bullets calling out unexpected demographic splits (age, gender, or city deviating from the overall result).

## Recommended Next Moves
3 concrete, actionable suggestions for the brand based on the data.

Keep the entire output under 350 words.`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Add funds in Lovable Cloud settings.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errText = await aiResp.text();
      console.error('AI gateway error:', aiResp.status, errText);
      return new Response(JSON.stringify({ error: 'AI generation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResp.json();
    const insights = aiData.choices?.[0]?.message?.content ?? 'No insight generated.';

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-campaign-insights error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
