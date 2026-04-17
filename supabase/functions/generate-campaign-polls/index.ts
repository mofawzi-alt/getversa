// Generate campaign poll drafts using Lovable AI Gateway
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { brand, goal, count } = await req.json();
    if (!brand || !goal) {
      return new Response(JSON.stringify({ error: 'brand and goal required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const n = Math.max(3, Math.min(10, Number(count) || 5));
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `You write binary A vs B poll questions for a Gen Z opinion app called Versa.
Rules:
- Questions are short, punchy, conversational. Max 80 chars.
- Options are 1-4 words. Concrete, not abstract.
- Avoid neutral/middle answers. Force a real choice.
- Cover different angles of the brief (perception, behavior, preference, loyalty, identity).`;

    const userPrompt = `Brand: ${brand}
Goal: ${goal}
Generate ${n} distinct binary polls.`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'emit_polls',
            description: 'Return the generated polls.',
            parameters: {
              type: 'object',
              properties: {
                polls: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string' },
                      option_a: { type: 'string' },
                      option_b: { type: 'string' },
                    },
                    required: ['question', 'option_a', 'option_b'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['polls'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'emit_polls' } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please retry shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Add funds in Lovable workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await resp.text();
      console.error('AI error', resp.status, t);
      throw new Error('AI gateway error');
    }

    const data = await resp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    let parsed: { polls: { question: string; option_a: string; option_b: string }[] } | null = null;
    if (typeof args === 'string') {
      try { parsed = JSON.parse(args); } catch { /* fallthrough */ }
    } else if (args) {
      parsed = args;
    }
    if (!parsed?.polls?.length) throw new Error('No polls returned by AI');

    return new Response(JSON.stringify({ polls: parsed.polls }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-campaign-polls error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
