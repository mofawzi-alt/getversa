import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { poll_id, campaign_id } = await req.json();
    if (!poll_id && !campaign_id) {
      return new Response(JSON.stringify({ error: "poll_id or campaign_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch poll data
    let pollIds: string[] = [];
    let campaignName = "";

    if (campaign_id) {
      const { data: cp } = await supabase
        .from("campaign_polls")
        .select("poll_id")
        .eq("campaign_id", campaign_id);
      pollIds = (cp || []).map((r: any) => r.poll_id);

      const { data: camp } = await supabase
        .from("poll_campaigns")
        .select("name, brand_name")
        .eq("id", campaign_id)
        .single();
      campaignName = camp?.name || "";
    } else {
      pollIds = [poll_id];
    }

    if (pollIds.length === 0) {
      return new Response(JSON.stringify({ error: "No polls found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch polls with vote data
    const { data: polls } = await supabase
      .from("polls")
      .select("id, question, option_a, option_b, category, votes_a, votes_b, created_at, subtitle")
      .in("id", pollIds);

    if (!polls || polls.length === 0) {
      return new Response(JSON.stringify({ error: "Polls not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch demographic vote breakdowns
    const { data: votes } = await supabase
      .from("votes")
      .select("poll_id, choice, voter_gender, voter_age_range, voter_city, voter_country, created_at")
      .in("poll_id", pollIds)
      .order("created_at", { ascending: true })
      .limit(5000);

    // Build analysis context per poll
    const pollAnalyses = polls.map((poll: any) => {
      const pollVotes = (votes || []).filter((v: any) => v.poll_id === poll.id);
      const totalVotes = (poll.votes_a || 0) + (poll.votes_b || 0);
      const pctA = totalVotes > 0 ? Math.round(((poll.votes_a || 0) / totalVotes) * 100) : 50;
      const pctB = 100 - pctA;

      // Gender breakdown
      const genderBreakdown: Record<string, { a: number; b: number }> = {};
      const ageBreakdown: Record<string, { a: number; b: number }> = {};

      pollVotes.forEach((v: any) => {
        const gender = v.voter_gender || "unknown";
        const age = v.voter_age_range || "unknown";
        if (!genderBreakdown[gender]) genderBreakdown[gender] = { a: 0, b: 0 };
        if (!ageBreakdown[age]) ageBreakdown[age] = { a: 0, b: 0 };

        if (v.choice === "A") {
          genderBreakdown[gender].a++;
          ageBreakdown[age].a++;
        } else {
          genderBreakdown[gender].b++;
          ageBreakdown[age].b++;
        }
      });

      // Trend over time (group by day)
      const dailyVotes: Record<string, { a: number; b: number }> = {};
      pollVotes.forEach((v: any) => {
        const day = v.created_at?.substring(0, 10) || "unknown";
        if (!dailyVotes[day]) dailyVotes[day] = { a: 0, b: 0 };
        if (v.choice === "A") dailyVotes[day].a++;
        else dailyVotes[day].b++;
      });

      return {
        question: poll.question,
        optionA: poll.option_a,
        optionB: poll.option_b,
        category: poll.category,
        subtitle: poll.subtitle,
        totalVotes,
        pctA,
        pctB,
        winner: pctA >= pctB ? "A" : "B",
        genderBreakdown,
        ageBreakdown,
        dailyTrend: dailyVotes,
        createdAt: poll.created_at,
      };
    });

    // Generate AI analysis
    const systemPrompt = `You are a Decision Intelligence analyst for VERSA, a Gen Z cultural polling platform. You produce professional B2B insight reports that brands and agencies pay for.

Your output MUST be valid JSON with this exact structure:
{
  "executive_summary": "2-3 sentence strategic overview",
  "concept_score": <number 0-100, a normalized index of how polarizing/engaging the concept is>,
  "drivers_of_choice": [
    {"driver": "name", "impact": "high|medium|low", "explanation": "1-2 sentences", "supporting_data": "specific stat"}
  ],
  "audience_segments": [
    {"segment_name": "business-friendly name", "versa_archetype": "original name if applicable", "size_pct": <number>, "preference": "A or B", "preference_strength": "strong|moderate|slight", "description": "behavioral insight", "brand_implication": "what this means for brands"}
  ],
  "trend_momentum": {
    "direction": "growing_A|growing_B|stable|volatile",
    "velocity": "fast|moderate|slow",
    "insight": "1-2 sentences on trajectory"
  },
  "brand_recommendations": [
    {"recommendation": "actionable advice", "priority": "high|medium|low", "target_segment": "which segment", "rationale": "why"}
  ],
  "personality_segments": [
    {"versa_type": "e.g. Maverick", "business_label": "e.g. Early Adopters", "pct_of_voters": <number>, "key_behavior": "description", "brand_opportunity": "how to reach them"}
  ],
  "methodology_note": "Brief note on sample size and confidence"
}

CRITICAL RULES:
- Translate VERSA personality clusters into business-friendly segments: Maverick → Early Adopters, Curator → Quality Seekers, Rebel → Trendsetters, Classic → Mainstream Loyalists, etc.
- concept_score: 90+ = highly polarizing/viral, 70-89 = strong engagement, 50-69 = moderate, <50 = low
- All numbers must be realistic and consistent
- Recommendations must be specific and actionable for brand managers
- Keep language professional but accessible — this is for CMOs, not data scientists
- Never use alcohol references in any recommendations`;

    const userPrompt = campaign_id
      ? `Analyze this brand campaign "${campaignName}" with ${pollAnalyses.length} polls:\n\n${JSON.stringify(pollAnalyses, null, 2)}`
      : `Analyze this single poll:\n\n${JSON.stringify(pollAnalyses[0], null, 2)}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_decision_intelligence",
              description: "Generate a complete Decision Intelligence report",
              parameters: {
                type: "object",
                properties: {
                  executive_summary: { type: "string" },
                  concept_score: { type: "number" },
                  drivers_of_choice: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        driver: { type: "string" },
                        impact: { type: "string", enum: ["high", "medium", "low"] },
                        explanation: { type: "string" },
                        supporting_data: { type: "string" },
                      },
                      required: ["driver", "impact", "explanation", "supporting_data"],
                    },
                  },
                  audience_segments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        segment_name: { type: "string" },
                        versa_archetype: { type: "string" },
                        size_pct: { type: "number" },
                        preference: { type: "string" },
                        preference_strength: { type: "string", enum: ["strong", "moderate", "slight"] },
                        description: { type: "string" },
                        brand_implication: { type: "string" },
                      },
                      required: ["segment_name", "size_pct", "preference", "description", "brand_implication"],
                    },
                  },
                  trend_momentum: {
                    type: "object",
                    properties: {
                      direction: { type: "string" },
                      velocity: { type: "string" },
                      insight: { type: "string" },
                    },
                    required: ["direction", "velocity", "insight"],
                  },
                  brand_recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        recommendation: { type: "string" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        target_segment: { type: "string" },
                        rationale: { type: "string" },
                      },
                      required: ["recommendation", "priority", "target_segment", "rationale"],
                    },
                  },
                  personality_segments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        versa_type: { type: "string" },
                        business_label: { type: "string" },
                        pct_of_voters: { type: "number" },
                        key_behavior: { type: "string" },
                        brand_opportunity: { type: "string" },
                      },
                      required: ["versa_type", "business_label", "pct_of_voters", "key_behavior", "brand_opportunity"],
                    },
                  },
                  methodology_note: { type: "string" },
                },
                required: [
                  "executive_summary",
                  "concept_score",
                  "drivers_of_choice",
                  "audience_segments",
                  "trend_momentum",
                  "brand_recommendations",
                  "personality_segments",
                  "methodology_note",
                ],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_decision_intelligence" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted, please add funds" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    let analysis;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      analysis = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse AI response:", e, JSON.stringify(aiData));
      throw new Error("Failed to parse AI analysis");
    }

    // Determine winner/loser for the primary poll
    const primaryPoll = pollAnalyses[0];
    const totalVotes = primaryPoll.totalVotes;

    // Store the report
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
        total_votes: totalVotes,
        drivers_of_choice: analysis.drivers_of_choice,
        audience_segments: analysis.audience_segments,
        trend_momentum: analysis.trend_momentum,
        brand_recommendations: analysis.brand_recommendations,
        personality_segments: analysis.personality_segments,
        executive_summary: analysis.executive_summary,
        methodology_note: analysis.methodology_note,
        report_status: "complete",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save report");
    }

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("DI generation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
