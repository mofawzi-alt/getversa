import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Part 8 thresholds
const THRESHOLDS = {
  BASIC_RESULTS: 1,
  DEMOGRAPHIC_BREAKDOWN: 30,
  FULL_DI: 100,
  TREND_MOMENTUM_DAYS: 14,
  HIGH_CONFIDENCE: 500,
  REPORT_EXPORT: 100,
};

// Part 3 archetype → business segment mapping
const ARCHETYPE_MAP: Record<string, string> = {
  "The Ambitious Egyptian": "Early Adopters & Premium-Willing",
  "The Proud Local": "Price-Sensitive & Brand-Traditional",
  "The Urban Pragmatist": "Value Seekers",
  "The Gen Z Disruptor": "Trend-First & Platform-Native",
  "The Established Professional": "Status-Driven & Experience-Focused",
  "The Cultural Hybrid": "Dual-Market: Local + Global Responsive",
  // Legacy MBTI mappings
  "Maverick": "Early Adopters",
  "Curator": "Quality Seekers",
  "Rebel": "Trendsetters",
  "Classic": "Mainstream Loyalists",
  "The Architect": "Strategic Planners",
  "The Analyst": "Research-Driven Buyers",
  "The Commander": "Premium Brand Loyalists",
  "The Spark": "Experience Hunters",
  "The Ambassador": "Social Influencers",
  "The Dynamo": "Impulse-Driven Consumers",
};

function determineConfidence(realVotes: number, demographicCoverage: number): { level: string; explanation: string } {
  if (realVotes >= THRESHOLDS.HIGH_CONFIDENCE && demographicCoverage >= 0.8) {
    return { level: "high", explanation: `${realVotes} real votes with strong demographic representation across all key segments.` };
  }
  if (realVotes >= THRESHOLDS.FULL_DI && demographicCoverage >= 0.5) {
    return { level: "medium", explanation: `${realVotes} real votes with most demographic segments represented. More votes will sharpen this insight.` };
  }
  return { level: "low", explanation: `${realVotes} real votes — below the threshold for full Decision Intelligence. Results are directional only.` };
}

function determineMarginStrength(winnerPct: number, loserPct: number): string {
  const margin = winnerPct - loserPct;
  if (margin < 5) return "divided"; // "Egypt is divided"
  if (margin < 10) return "contested";
  if (margin < 20) return "moderate";
  return "landslide";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { poll_id, campaign_id } = await req.json();
    if (!poll_id && !campaign_id) {
      return new Response(JSON.stringify({ error: "poll_id or campaign_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    let pollIds: string[] = [];
    let campaignName = "";

    if (campaign_id) {
      const { data: cp } = await supabase.from("campaign_polls").select("poll_id").eq("campaign_id", campaign_id);
      pollIds = (cp || []).map((r: any) => r.poll_id);
      const { data: camp } = await supabase.from("poll_campaigns").select("name, brand_name").eq("id", campaign_id).single();
      campaignName = camp?.name || "";
    } else {
      pollIds = [poll_id];
    }

    if (pollIds.length === 0) {
      return new Response(JSON.stringify({ error: "No polls found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: polls, error: pollError } = await supabase
      .from("polls")
      .select("id, question, option_a, option_b, category, created_at, subtitle, baseline_votes_a, baseline_votes_b")
      .in("id", pollIds);

    if (pollError || !polls || polls.length === 0) {
      console.error("Poll fetch error:", pollError);
      return new Response(JSON.stringify({ error: "Polls not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch votes with decision time (session_duration_ms)
    const { data: votes } = await supabase
      .from("votes")
      .select("poll_id, choice, voter_gender, voter_age_range, voter_city, voter_country, created_at, session_duration_ms")
      .in("poll_id", pollIds)
      .order("created_at", { ascending: true })
      .limit(5000);

    // Build analysis per poll
    const pollAnalyses = polls.map((poll: any) => {
      const pollVotes = (votes || []).filter((v: any) => v.poll_id === poll.id);
      const votesA = pollVotes.filter((v: any) => v.choice === 'A').length;
      const votesB = pollVotes.filter((v: any) => v.choice === 'B').length;
      const baselineA = poll.baseline_votes_a || 0;
      const baselineB = poll.baseline_votes_b || 0;
      const totalVotes = votesA + votesB + baselineA + baselineB;
      const realVotesA = votesA;
      const realVotesB = votesB;
      const totalRealVotes = realVotesA + realVotesB;
      const pctA = totalRealVotes > 0 ? Math.round((realVotesA / totalRealVotes) * 100) : 50;
      const pctB = 100 - pctA;

      // Decision time analysis
      const decisionTimes = pollVotes
        .filter((v: any) => v.session_duration_ms && v.session_duration_ms > 0 && v.session_duration_ms < 30000)
        .map((v: any) => ({ choice: v.choice, ms: v.session_duration_ms }));
      const avgDecisionTimeMs = decisionTimes.length > 0
        ? Math.round(decisionTimes.reduce((s: number, v: any) => s + v.ms, 0) / decisionTimes.length)
        : null;
      const avgDecisionTimeA = decisionTimes.filter((v: any) => v.choice === 'A').length > 0
        ? Math.round(decisionTimes.filter((v: any) => v.choice === 'A').reduce((s: number, v: any) => s + v.ms, 0) / decisionTimes.filter((v: any) => v.choice === 'A').length)
        : null;
      const avgDecisionTimeB = decisionTimes.filter((v: any) => v.choice === 'B').length > 0
        ? Math.round(decisionTimes.filter((v: any) => v.choice === 'B').reduce((s: number, v: any) => s + v.ms, 0) / decisionTimes.filter((v: any) => v.choice === 'B').length)
        : null;

      // Demographic breakdowns
      const genderBreakdown: Record<string, { a: number; b: number }> = {};
      const ageBreakdown: Record<string, { a: number; b: number }> = {};
      const cityBreakdown: Record<string, { a: number; b: number }> = {};

      pollVotes.forEach((v: any) => {
        const gender = v.voter_gender || "unknown";
        const age = v.voter_age_range || "unknown";
        const city = v.voter_city || "unknown";
        if (!genderBreakdown[gender]) genderBreakdown[gender] = { a: 0, b: 0 };
        if (!ageBreakdown[age]) ageBreakdown[age] = { a: 0, b: 0 };
        if (!cityBreakdown[city]) cityBreakdown[city] = { a: 0, b: 0 };
        if (v.choice === "A") { genderBreakdown[gender].a++; ageBreakdown[age].a++; cityBreakdown[city].a++; }
        else { genderBreakdown[gender].b++; ageBreakdown[age].b++; cityBreakdown[city].b++; }
      });

      // Trend (group by day)
      const dailyVotes: Record<string, { a: number; b: number }> = {};
      pollVotes.forEach((v: any) => {
        const day = v.created_at?.substring(0, 10) || "unknown";
        if (!dailyVotes[day]) dailyVotes[day] = { a: 0, b: 0 };
        if (v.choice === "A") dailyVotes[day].a++; else dailyVotes[day].b++;
      });

      // Demographic coverage score (0–1)
      const knownGenders = Object.keys(genderBreakdown).filter(k => k !== 'unknown').length;
      const knownAges = Object.keys(ageBreakdown).filter(k => k !== 'unknown').length;
      const demographicCoverage = Math.min(1, (knownGenders / 2 + knownAges / 4) / 2);

      // Days active
      const createdDate = new Date(poll.created_at);
      const daysActive = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        question: poll.question,
        optionA: poll.option_a,
        optionB: poll.option_b,
        category: poll.category,
        subtitle: poll.subtitle,
        totalVotes,
        totalRealVotes,
        baselineA: poll.baseline_a || 0,
        baselineB: poll.baseline_b || 0,
        pctA, pctB,
        winner: pctA >= pctB ? "A" : "B",
        marginStrength: determineMarginStrength(Math.max(pctA, pctB), Math.min(pctA, pctB)),
        genderBreakdown, ageBreakdown, cityBreakdown,
        dailyTrend: dailyVotes,
        avgDecisionTimeMs, avgDecisionTimeA, avgDecisionTimeB,
        demographicCoverage,
        daysActive,
        createdAt: poll.created_at,
      };
    });

    const primaryPoll = pollAnalyses[0];
    const confidence = determineConfidence(primaryPoll.totalRealVotes, primaryPoll.demographicCoverage);

    // Check DI threshold
    if (primaryPoll.totalRealVotes < THRESHOLDS.FULL_DI) {
      // Below threshold — store basic report with status
      const { data: report } = await supabase
        .from("decision_intelligence_reports")
        .insert({
          poll_id: poll_id || null,
          campaign_id: campaign_id || null,
          concept_score: 0,
          winner_option: primaryPoll.winner === "A" ? primaryPoll.optionA : primaryPoll.optionB,
          loser_option: primaryPoll.winner === "A" ? primaryPoll.optionB : primaryPoll.optionA,
          winner_pct: Math.max(primaryPoll.pctA, primaryPoll.pctB),
          loser_pct: Math.min(primaryPoll.pctA, primaryPoll.pctB),
          total_votes: primaryPoll.totalVotes,
          real_vote_count: primaryPoll.totalRealVotes,
          confidence_level: confidence.level,
          report_status: "below_threshold",
          executive_summary: `This poll has ${primaryPoll.totalRealVotes} real votes out of the ${THRESHOLDS.FULL_DI} required for full Decision Intelligence analysis. Basic results are shown. Continue collecting votes to unlock the full insight report.`,
          methodology_note: confidence.explanation,
        })
        .select().single();

      return new Response(JSON.stringify({
        report,
        threshold_info: {
          current: primaryPoll.totalRealVotes,
          required: THRESHOLDS.FULL_DI,
          message: `Decision Intelligence unlocks at ${THRESHOLDS.FULL_DI} real votes. This poll currently has ${primaryPoll.totalRealVotes} real votes.`,
        }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate AI analysis — full 8 components
    const systemPrompt = `You are a Decision Intelligence analyst for VERSA, a Gen Z cultural polling platform in Egypt. You produce professional B2B insight reports that brands pay $5,000-15,000 per campaign to access.

Your output MUST be valid JSON with this exact structure:
{
  "executive_summary": "2-3 sentence strategic overview of the key finding and its business significance",
  "concept_score": <number 0-100>,
  "drivers_of_choice": [
    {"driver": "name", "impact": "high|medium|low", "explanation": "MUST reference specific demographic, percentage, and decision time data", "supporting_data": "specific stat from the data"}
  ],
  "audience_segments": [
    {"segment_name": "business-friendly name", "versa_archetype": "archetype if applicable", "size_pct": <number>, "preference": "A or B", "preference_strength": "strong|moderate|slight", "description": "behavioral insight from data", "brand_implication": "what this means for brands"}
  ],
  "trend_momentum": {
    "direction": "growing_A|growing_B|stable|volatile",
    "velocity": "fast|moderate|slow",
    "insight": "data-backed trajectory analysis"
  },
  "brand_recommendations": [
    {"recommendation": "specific actionable advice", "priority": "high|medium|low", "target_segment": "which segment", "rationale": "data-backed reason"}
  ],
  "personality_segments": [
    {"versa_type": "archetype name", "business_label": "business segment", "pct_of_voters": <number>, "key_behavior": "data-backed description", "brand_opportunity": "how to reach them"}
  ],
  "business_application": {
    "product": "specific product direction supported by data",
    "marketing": "specific message, channel, and demographic to prioritize",
    "pricing": "what the preference split suggests about price sensitivity"
  },
  "methodology_note": "total real votes, date range, demographic breakdown, confidence level statement, and: 'Versa captures revealed behavioral preference — what users actually choose in under 2 seconds — not stated survey preference. This distinction produces systematically different and more accurate results than traditional panel-based research.'"
}

CRITICAL RULES:
1. DRIVERS: Every driver statement MUST reference a specific demographic, a specific percentage difference, and where available a decision time signal. Format: "Users aged X chose [option] at Y% vs overall Z% — decision time averaged N seconds indicating instinctive/deliberated preference"
2. NEVER output generic insight like "Users prefer this because they value convenience" — this is inference without data
3. NEVER output "This suggests that Egyptian consumers are trend-conscious" — generic and unsupported
4. Translate personality archetypes to business segments: ${Object.entries(ARCHETYPE_MAP).map(([k,v]) => `${k} → ${v}`).join(', ')}
5. concept_score: weighted index of vote split, volume, consistency, demographic agreement. 90+ = viral, 70-89 = strong, 40-69 = moderate, <40 = contested
6. Margin labels: >20% = landslide, 10-20% = moderate, 5-10% = contested, <5% = "Egypt is divided"
7. If decision time < 1.5s = instinctive preference (strong brand pull). If > 3s = deliberated preference (considered purchase)
8. Trend momentum: only provide direction if poll active > 14 days, otherwise state "Trend data builds after 14 days"
9. Every recommendation must reference specific data points from the poll
10. Never use alcohol references
11. Confidence: ${confidence.level} — ${confidence.explanation}`;

    const userPrompt = campaign_id
      ? `Analyze brand campaign "${campaignName}" with ${pollAnalyses.length} polls:\n\n${JSON.stringify(pollAnalyses, null, 2)}`
      : `Analyze this poll:\n\n${JSON.stringify(pollAnalyses[0], null, 2)}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_decision_intelligence",
            description: "Generate a complete Decision Intelligence report with all 8 components",
            parameters: {
              type: "object",
              properties: {
                executive_summary: { type: "string" },
                concept_score: { type: "number" },
                drivers_of_choice: { type: "array", items: { type: "object", properties: { driver: { type: "string" }, impact: { type: "string" }, explanation: { type: "string" }, supporting_data: { type: "string" } }, required: ["driver", "impact", "explanation", "supporting_data"] } },
                audience_segments: { type: "array", items: { type: "object", properties: { segment_name: { type: "string" }, versa_archetype: { type: "string" }, size_pct: { type: "number" }, preference: { type: "string" }, preference_strength: { type: "string" }, description: { type: "string" }, brand_implication: { type: "string" } }, required: ["segment_name", "size_pct", "preference", "description", "brand_implication"] } },
                trend_momentum: { type: "object", properties: { direction: { type: "string" }, velocity: { type: "string" }, insight: { type: "string" } }, required: ["direction", "velocity", "insight"] },
                brand_recommendations: { type: "array", items: { type: "object", properties: { recommendation: { type: "string" }, priority: { type: "string" }, target_segment: { type: "string" }, rationale: { type: "string" } }, required: ["recommendation", "priority", "target_segment", "rationale"] } },
                personality_segments: { type: "array", items: { type: "object", properties: { versa_type: { type: "string" }, business_label: { type: "string" }, pct_of_voters: { type: "number" }, key_behavior: { type: "string" }, brand_opportunity: { type: "string" } }, required: ["versa_type", "business_label", "pct_of_voters", "key_behavior", "brand_opportunity"] } },
                business_application: { type: "object", properties: { product: { type: "string" }, marketing: { type: "string" }, pricing: { type: "string" } }, required: ["product", "marketing", "pricing"] },
                methodology_note: { type: "string" },
              },
              required: ["executive_summary", "concept_score", "drivers_of_choice", "audience_segments", "trend_momentum", "brand_recommendations", "personality_segments", "business_application", "methodology_note"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_decision_intelligence" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again later" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    let analysis;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      analysis = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      // Fallback: try content
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { analysis = JSON.parse(jsonMatch[0]); } catch { throw new Error("Failed to parse AI analysis"); }
      } else {
        throw new Error("Failed to parse AI analysis");
      }
    }

    const { data: report, error: insertError } = await supabase
      .from("decision_intelligence_reports")
      .insert({
        poll_id: poll_id || null,
        campaign_id: campaign_id || null,
        concept_score: analysis.concept_score,
        winner_option: primaryPoll.winner === "A" ? primaryPoll.optionA : primaryPoll.optionB,
        loser_option: primaryPoll.winner === "A" ? primaryPoll.optionB : primaryPoll.optionA,
        winner_pct: Math.max(primaryPoll.pctA, primaryPoll.pctB),
        loser_pct: Math.min(primaryPoll.pctA, primaryPoll.pctB),
        total_votes: primaryPoll.totalVotes,
        real_vote_count: primaryPoll.totalRealVotes,
        confidence_level: confidence.level,
        avg_decision_time_ms: primaryPoll.avgDecisionTimeMs,
        drivers_of_choice: analysis.drivers_of_choice,
        audience_segments: analysis.audience_segments,
        trend_momentum: analysis.trend_momentum,
        brand_recommendations: analysis.brand_recommendations,
        personality_segments: analysis.personality_segments,
        business_application: analysis.business_application || {},
        executive_summary: analysis.executive_summary,
        methodology_note: analysis.methodology_note,
        report_status: "complete",
      })
      .select().single();

    if (insertError) throw new Error("Failed to save report");

    return new Response(JSON.stringify({ report }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("DI generation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
