import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORY_MAP: Record<string, string[]> = {
  "brands": ["Retail & E-commerce", "FMCG & Food"],
  "business & startups": ["Financial Services"],
  "fintech & money": ["Financial Services"],
  "style & design": ["Beauty & Personal Care", "Lifestyle & Society"],
  "entertainment": ["Media & Entertainment"],
  "sports": ["Media & Entertainment"],
  "wellness & habits": ["Lifestyle & Society"],
  "the pulse": ["The Pulse"],
  "beauty": ["Beauty & Personal Care"],
  "food & drinks": ["FMCG & Food", "Food Delivery & Dining"],
  "lifestyle": ["Lifestyle & Society"],
  "personality": ["Lifestyle & Society"],
  "relationships": ["Lifestyle & Society"],
  "telecom": ["Telco & Tech"],
};
const KNOWN_CATEGORIES = Object.keys(CATEGORY_MAP);

const FILTER_TOOL = {
  type: "function",
  function: {
    name: "extract_poll_filters",
    description: "Extract structured filter criteria from a natural language question about polls.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Key topical terms to fuzzy-search (lowercase, single words preferred).",
        },
        category: {
          type: "string",
          enum: [...KNOWN_CATEGORIES, "any"],
        },
        gender: { type: "string", enum: ["male", "female", "any"] },
        age_range: { type: "string", enum: ["under_18", "18-24", "25-34", "35-44", "45+", "any"] },
        controversial: { type: "boolean" },
        intent_summary: { type: "string", description: "One-sentence rephrasing of intent." },
      },
      required: ["keywords", "category", "intent_summary"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");
    const AI_URL = "https://api.groq.com/openai/v1/chat/completions";
    const AI_MODEL = "llama-3.3-70b-versatile";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { question, mode = "decide", viewer } = body as {
      question?: string;
      mode?: "decide" | "research";
      viewer?: { age_range?: string; city?: string; gender?: string };
    };

    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Please ask a fuller question." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Extract filters
    const extractResp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: `You translate natural language questions about Egyptian opinion polls into structured filters. Categories: ${KNOWN_CATEGORIES.join(", ")}. Be conservative — only set demographic filters when explicitly mentioned.`,
          },
          { role: "user", content: question },
        ],
        tools: [FILTER_TOOL],
        tool_choice: { type: "function", function: { name: "extract_poll_filters" } },
      }),
    });

    if (!extractResp.ok) {
      if (extractResp.status === 429) return new Response(JSON.stringify({ error: "Too many requests, try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (extractResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI extraction failed: ${extractResp.status}`);
    }

    const extractData = await extractResp.json();
    const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No filter extracted");

    const filters = JSON.parse(toolCall.function.arguments);
    const { keywords = [], category, gender, age_range, controversial, intent_summary } = filters;

    // 2. Query polls
    const buildQuery = (useCategory: boolean, useKeywords: boolean) => {
      let q = supabase
        .from("polls")
        .select("id, question, subtitle, option_a, option_b, image_a_url, image_b_url, category, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(80);

      if (useCategory && category && category !== "any") {
        const dbCats = CATEGORY_MAP[category.toLowerCase()] || [];
        if (dbCats.length > 0) q = q.in("category", dbCats);
      }
      if (useKeywords && keywords.length > 0) {
        const orFilters: string[] = [];
        for (const kw of keywords.slice(0, 5)) {
          const safe = kw.replace(/[%,()]/g, "").trim();
          if (safe.length < 2) continue;
          orFilters.push(`question.ilike.%${safe}%`);
          orFilters.push(`option_a.ilike.%${safe}%`);
          orFilters.push(`option_b.ilike.%${safe}%`);
          orFilters.push(`subtitle.ilike.%${safe}%`);
          orFilters.push(`category.ilike.%${safe}%`);
        }
        if (orFilters.length > 0) q = q.or(orFilters.join(","));
      }
      return q;
    };

    let polls: any[] = [];
    const attempts: Array<[boolean, boolean]> = [[true, true], [false, true], [true, false], [false, false]];
    for (const [useCat, useKw] of attempts) {
      const { data, error } = await buildQuery(useCat, useKw);
      if (error) throw error;
      if (data && data.length > 0) { polls = data; break; }
    }

    // 3. Fetch vote stats for ALL matched polls (needed for verdict + research)
    const ids = polls.map((p) => p.id);
    const statsMap = new Map<string, {
      a: number; b: number; total: number;
      viewerAge: { a: number; b: number; total: number };
      viewerCity: { a: number; b: number; total: number };
      genderM: { a: number; b: number; total: number };
      genderF: { a: number; b: number; total: number };
    }>();

    if (ids.length > 0) {
      const { data: votes } = await supabase
        .from("votes")
        .select("poll_id, choice, voter_gender, voter_age_range, voter_city")
        .in("poll_id", ids);

      votes?.forEach((v: any) => {
        const s = statsMap.get(v.poll_id) || {
          a: 0, b: 0, total: 0,
          viewerAge: { a: 0, b: 0, total: 0 },
          viewerCity: { a: 0, b: 0, total: 0 },
          genderM: { a: 0, b: 0, total: 0 },
          genderF: { a: 0, b: 0, total: 0 },
        };
        const isA = v.choice === "A" || v.choice === "a";
        const isB = v.choice === "B" || v.choice === "b";
        if (isA) s.a++; else if (isB) s.b++;
        s.total++;

        if (viewer?.age_range && v.voter_age_range === viewer.age_range) {
          if (isA) s.viewerAge.a++; else if (isB) s.viewerAge.b++;
          s.viewerAge.total++;
        }
        if (viewer?.city && v.voter_city && v.voter_city.toLowerCase() === viewer.city.toLowerCase()) {
          if (isA) s.viewerCity.a++; else if (isB) s.viewerCity.b++;
          s.viewerCity.total++;
        }
        if (v.voter_gender === "male") {
          if (isA) s.genderM.a++; else if (isB) s.genderM.b++;
          s.genderM.total++;
        } else if (v.voter_gender === "female") {
          if (isA) s.genderF.a++; else if (isB) s.genderF.b++;
          s.genderF.total++;
        }
        statsMap.set(v.poll_id, s);
      });
    }

    // Apply demographic / controversial filtering & sort
    let matchedPolls = polls.map((p) => {
      const s = statsMap.get(p.id) || { a: 0, b: 0, total: 0, viewerAge: { a: 0, b: 0, total: 0 }, viewerCity: { a: 0, b: 0, total: 0 }, genderM: { a: 0, b: 0, total: 0 }, genderF: { a: 0, b: 0, total: 0 } };
      const split = s.total > 0 ? s.a / s.total : 0.5;
      const controversyScore = 1 - Math.abs(split - 0.5) * 2;
      return { ...p, _stats: s, _controversyScore: controversyScore };
    });

    if (controversial) {
      matchedPolls = matchedPolls.filter((p: any) => p._stats.total >= 5).sort((a: any, b: any) => b._controversyScore - a._controversyScore);
    } else {
      matchedPolls.sort((a: any, b: any) => b._stats.total - a._stats.total);
    }

    matchedPolls = matchedPolls.slice(0, mode === "decide" ? 3 : 12);

    // 4. Build verdict (decide) or summary (research)
    let summary = intent_summary || "Here's what I found.";
    let verdict: any = null;
    let low_data = false;

    // Low-data guardrail: avoid fabricating answers when matched polls are too sparse
    const topVotes = matchedPolls[0]?._stats?.total ?? 0;
    const totalMatchedVotes = matchedPolls.reduce((acc: number, p: any) => acc + (p._stats?.total || 0), 0);
    const MIN_TOP_VOTES = mode === "decide" ? 10 : 8;
    const MIN_TOTAL_VOTES = mode === "decide" ? 10 : 15;
    const insufficientData =
      matchedPolls.length === 0 ||
      topVotes < MIN_TOP_VOTES ||
      totalMatchedVotes < MIN_TOTAL_VOTES;

    if (insufficientData) {
      low_data = true;
      // Ask AI for 2 short rephrasing suggestions framed as A vs B
      let suggestions: string[] = [];
      try {
        const sugResp = await fetch(AI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [
              { role: "system", content: 'You rewrite vague or yes/no questions into 2 short Egyptian-context binary "X or Y?" comparison questions that an opinion poll could answer. Return ONLY a JSON array of 2 strings, no prose. Each under 8 words. Example input: "Is Dubai good?" → ["Dubai or Sharm for vacation?","Travel abroad or staycation?"]' },
              { role: "user", content: question },
            ],
          }),
        });
        if (sugResp.ok) {
          const sd = await sugResp.json();
          const raw = sd.choices?.[0]?.message?.content?.trim() || "[]";
          const match = raw.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed)) suggestions = parsed.filter((s: any) => typeof s === "string").slice(0, 2);
          }
        }
      } catch (_) { /* non-fatal */ }

      const baseMsg = matchedPolls.length === 0
        ? `No polls match "${question}" yet.`
        : `Not enough Versa votes yet to answer this confidently (only ${totalMatchedVotes} related votes).`;
      const tip = ' Try rephrasing as a clear "X or Y?" comparison.';
      summary = baseMsg + tip;

      return new Response(
        JSON.stringify({
          summary,
          verdict: null,
          filters,
          polls: [],
          count: 0,
          mode,
          low_data: true,
          suggestions,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (matchedPolls.length === 0) {
      summary = `No polls match "${question}" yet. Try a brand name (e.g. "Coca-Cola", "Vodafone"), a topic ("football", "fashion"), or browse by category.`;
    } else if (mode === "decide") {
      const top = matchedPolls[0];
      const s = top._stats;
      const pctA = s.total > 0 ? Math.round((s.a / s.total) * 100) : 50;
      const pctB = 100 - pctA;
      const winnerSide = pctA >= pctB ? "A" : "B";
      const winnerLabel = winnerSide === "A" ? top.option_a : top.option_b;
      const winnerPct = Math.max(pctA, pctB);

      let viewerLine: string | null = null;
      if (viewer?.age_range && s.viewerAge.total >= 3) {
        const vPctA = Math.round((s.viewerAge.a / s.viewerAge.total) * 100);
        const vPct = winnerSide === "A" ? vPctA : 100 - vPctA;
        viewerLine = `${vPct}% of ${viewer.age_range} agree`;
      }

      // Short reasoning blurb
      const reasonResp = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: "You write ONE punchy sentence (max 18 words) explaining why Egyptians lean a certain way on a poll. No preamble, no quotes. Direct and confident." },
            { role: "user", content: `Question: "${top.question}"\nWinner: ${winnerLabel} (${winnerPct}%)\nLoser: ${winnerSide === "A" ? top.option_b : top.option_a} (${100 - winnerPct}%)\nSample size: ${s.total}\n\nWhy did people pick ${winnerLabel}? One sentence.` },
          ],
        }),
      });
      let reason = "";
      if (reasonResp.ok) {
        const rd = await reasonResp.json();
        reason = rd.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") || "";
      }

      verdict = {
        poll_id: top.id,
        question: top.question,
        option_a: top.option_a, option_b: top.option_b,
        image_a_url: top.image_a_url, image_b_url: top.image_b_url,
        winner_side: winnerSide,
        winner_label: winnerLabel,
        winner_pct: winnerPct,
        loser_pct: 100 - winnerPct,
        total_votes: s.total,
        reason,
        viewer_line: viewerLine,
      };
      summary = `${winnerPct}% of Egyptians pick ${winnerLabel}.`;
    } else {
      // research summary
      const sampleText = matchedPolls.slice(0, 8).map((p: any) => {
        const s = p._stats;
        const pctA = s.total > 0 ? Math.round((s.a / s.total) * 100) : 50;
        return `- "${p.question}" → ${p.option_a} ${pctA}% vs ${p.option_b} ${100 - pctA}% (n=${s.total})`;
      }).join("\n");
      const sumResp = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: "You write a 2-3 sentence research-style insight summary. Lead with the strongest concrete number. No bullet points. No mention of 'Gen Z' or generations. Direct and citation-worthy." },
            { role: "user", content: `User's research question: "${question}"\n\nMatched polls with results:\n${sampleText}\n\nWrite 2-3 sentences leading with the most striking stat.` },
          ],
        }),
      });
      if (sumResp.ok) {
        const sd = await sumResp.json();
        summary = sd.choices?.[0]?.message?.content?.trim() || summary;
      }
    }

    // Build research-friendly poll cards (with stats)
    const enrichedPolls = matchedPolls.map((p: any) => {
      const s = p._stats;
      const pctA = s.total > 0 ? Math.round((s.a / s.total) * 100) : 50;
      const pctB = 100 - pctA;
      // Viewer-personalized lines (respecting normal user privacy)
      let viewer_age_line: string | null = null;
      if (viewer?.age_range && s.viewerAge.total >= 3) {
        const vA = Math.round((s.viewerAge.a / s.viewerAge.total) * 100);
        viewer_age_line = `${viewer.age_range}: ${p.option_a} ${vA}% / ${p.option_b} ${100 - vA}% (n=${s.viewerAge.total})`;
      }
      let viewer_city_line: string | null = null;
      if (viewer?.city && s.viewerCity.total >= 3) {
        const vA = Math.round((s.viewerCity.a / s.viewerCity.total) * 100);
        viewer_city_line = `${viewer.city}: ${p.option_a} ${vA}% / ${p.option_b} ${100 - vA}% (n=${s.viewerCity.total})`;
      }
      // Counterintuitive gender teaser only (matches existing privacy rule)
      let gender_teaser: string | null = null;
      if (s.genderM.total >= 5 && s.genderF.total >= 5) {
        const mA = s.genderM.a / s.genderM.total;
        const fA = s.genderF.a / s.genderF.total;
        const mWinSide = mA >= 0.5 ? "A" : "B";
        const fWinSide = fA >= 0.5 ? "A" : "B";
        if (mWinSide !== fWinSide) {
          const mPct = Math.round(Math.max(mA, 1 - mA) * 100);
          const fPct = Math.round(Math.max(fA, 1 - fA) * 100);
          gender_teaser = `Men lean ${mWinSide === "A" ? p.option_a : p.option_b} (${mPct}%), women lean ${fWinSide === "A" ? p.option_a : p.option_b} (${fPct}%)`;
        }
      }
      return {
        id: p.id, question: p.question, subtitle: p.subtitle,
        option_a: p.option_a, option_b: p.option_b,
        image_a_url: p.image_a_url, image_b_url: p.image_b_url,
        category: p.category,
        percent_a: pctA, percent_b: pctB, total_votes: s.total,
        viewer_age_line, viewer_city_line, gender_teaser,
      };
    });

    return new Response(
      JSON.stringify({ summary, verdict, filters, polls: enrichedPolls, count: enrichedPolls.length, mode }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ask-versa error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
