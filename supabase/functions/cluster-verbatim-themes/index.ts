// Cluster qualitative verbatim feedback into themes using Lovable AI
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerbatimRow {
  poll_id: string;
  question: string;
  choice: string;
  option_label: string;
  feedback: string;
  voter_gender: string | null;
  voter_age_range: string | null;
  voter_city: string | null;
}

interface Theme {
  theme_label: string;
  theme_summary: string;
  supporting_quote_count: number;
  sample_quotes: Array<{ quote: string; choice: string; demo: string }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'campaign_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
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

    // Verify caller is admin
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: roleData } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch verbatim feedback for this campaign
    const { data: verbatims, error: vErr } = await admin.rpc('get_campaign_verbatims', {
      p_campaign_id: campaign_id,
      p_limit_per_poll: 100,
    });
    if (vErr) throw vErr;

    const rows = (verbatims || []) as VerbatimRow[];
    if (rows.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Need at least 3 verbatim responses to cluster themes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build a compact prompt
    const sample = rows.slice(0, 200).map((r, i) => {
      const demo = [r.voter_gender, r.voter_age_range, r.voter_city].filter(Boolean).join(', ');
      return `${i + 1}. [${r.option_label}] (${demo || 'unknown'}) "${r.feedback.slice(0, 200)}"`;
    }).join('\n');

    const systemPrompt = `You are a qualitative research analyst. Cluster verbatim consumer feedback into 3-6 distinct themes. For each theme, return JSON with: theme_label (3-5 words, punchy), theme_summary (1-2 sentences explaining what people are saying), supporting_quote_count (how many of the responses fit this theme), and sample_quotes (2-3 representative quotes verbatim, each with the quote text, choice option, and demographic). Output ONLY valid JSON: { "themes": [...] }.`;

    const userPrompt = `Analyze these ${rows.length} verbatim responses and cluster them into themes:\n\n${sample}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI gateway error', aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: 'AI clustering failed', detail: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData?.choices?.[0]?.message?.content ?? '{}';

    let parsed: { themes: Theme[] } = { themes: [] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      console.error('JSON parse failed', e, content);
      return new Response(
        JSON.stringify({ error: 'AI returned invalid JSON' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const themes = parsed.themes || [];
    const runId = crypto.randomUUID();

    // Replace previous themes
    await admin.from('campaign_verbatim_themes').delete().eq('campaign_id', campaign_id);

    if (themes.length > 0) {
      const insertRows = themes.map((t) => ({
        campaign_id,
        generation_run_id: runId,
        theme_label: t.theme_label?.slice(0, 80) || 'Untitled theme',
        theme_summary: t.theme_summary?.slice(0, 500) || '',
        supporting_quote_count: t.supporting_quote_count || 0,
        sample_quotes: t.sample_quotes || [],
      }));
      const { error: insErr } = await admin.from('campaign_verbatim_themes').insert(insertRows);
      if (insErr) throw insErr;
    }

    return new Response(
      JSON.stringify({ success: true, themes_count: themes.length, run_id: runId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('cluster-verbatim-themes error', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
