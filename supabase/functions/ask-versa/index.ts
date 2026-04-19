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
  "tech": ["Telco & Tech"],
  "technology": ["Telco & Tech"],
};
const KNOWN_CATEGORIES = Object.keys(CATEGORY_MAP);

const AI_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_FAST = "llama-3.1-8b-instant";        // simple route
const MODEL_SMART = "llama-3.3-70b-versatile";    // medium + complex routes

const ROUTE_COSTS = { simple: 1, medium: 3, complex: 8 } as const;
const ROUTE_MODEL: Record<string, string> = {
  simple: MODEL_FAST,
  medium: MODEL_SMART,
  complex: MODEL_SMART,
};

const MIN_VOTES_GUARDRAIL = 50; // total votes across matched polls

const FILTER_TOOL = {
  type: "function",
  function: {
    name: "extract_poll_filters",
    description: "Extract structured filter criteria + complexity route from a natural language question about polls.",
    parameters: {
      type: "object",
      properties: {
        keywords: { type: "array", items: { type: "string" }, description: "Key topical terms (lowercase)." },
        entities: { type: "array", items: { type: "string" }, description: "Named products, brands, people, or places explicitly mentioned." },
        category: { type: "string", description: `One of: ${KNOWN_CATEGORIES.join(", ")}, or "any".` },
        gender: { type: "string", description: 'One of: male, female, any.' },
        age_range: { type: "string", description: 'One of: under_18, 18-24, 25-34, 35-44, 45+, any.' },
        controversial: { type: "boolean" },
        intent_summary: { type: "string", description: "One-sentence rephrasing of intent." },
        route: {
          type: "string",
          description: "simple = single poll/brand fact lookup; medium = one demographic OR one category summary; complex = synthesis across multiple polls/demographics or brand intelligence. Must be exactly 'simple', 'medium', or 'complex'.",
        },
      },
      required: ["keywords", "category", "intent_summary", "route"],
    },
  },
};

async function callGroq(apiKey: string, model: string, payload: any) {
  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, ...payload }),
  });
  return resp;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      question,
      mode = "decide",
      viewer,
      history,
      stage = "preview", // "preview" or "confirm"
    } = body as {
      question?: string;
      mode?: "decide" | "research";
      viewer?: { age_range?: string; city?: string; gender?: string };
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      stage?: "preview" | "confirm";
    };

    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Please ask a fuller question." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identify caller
    const authHeader = req.headers.get("Authorization") || "";
    let userId: string | null = null;
    let userBalance = 0;
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id ?? null;
      if (userId) {
        const { data: u } = await supabase.from("users").select("ask_credits").eq("id", userId).maybeSingle();
        userBalance = u?.ask_credits ?? 0;
      }
    }

    // Trim history
    const trimmedHistory = Array.isArray(history) ? history.slice(-6) : [];
    const historyMessages = trimmedHistory.map((h) => ({
      role: h.role,
      content: String(h.content || "").slice(0, 500),
    }));

    // ---- 1. Extract filters + classify route (always uses fast model) ----
    const extractResp = await callGroq(GROQ_API_KEY, MODEL_FAST, {
      messages: [
        {
          role: "system",
          content: `You translate natural language questions about Egyptian opinion polls into structured filters AND classify complexity. Categories: ${KNOWN_CATEGORIES.join(", ")}. Be conservative — only set demographic filters when explicitly mentioned. Classify "route":
- simple: single poll/brand fact lookup, one entity, asking for one number ("Who won iPhone vs Samsung?", "% chose Coke?")
- medium: one demographic filter OR one category summary ("How did women vote on money polls?", "What does Cairo think about tech?")
- complex: synthesis across multiple polls/demographics, cross-category, brand intelligence ("What does data say about Gen Z financial behavior?", "Compare Cairo vs Alex on lifestyle")
If conversation history is provided, the new question may be a FOLLOW-UP — infer the underlying topic and merge with the new ask.`,
        },
        ...historyMessages,
        { role: "user", content: question },
      ],
      tools: [FILTER_TOOL],
      tool_choice: { type: "function", function: { name: "extract_poll_filters" } },
    });

    // Helper: extract JSON args from a Groq tool_use_failed body or message content
    const recoverFiltersFromText = (text: string): any | null => {
      if (!text) return null;
      // Try every {...} block, prefer ones containing "keywords" or "route"
      const matches = text.match(/\{[\s\S]*?\}/g) || [];
      for (const m of matches.reverse()) {
        try {
          const parsed = JSON.parse(m);
          if (parsed && typeof parsed === "object" && ("keywords" in parsed || "route" in parsed || "category" in parsed)) {
            return parsed;
          }
        } catch { /* keep looking */ }
      }
      return null;
    };

    let filters: any = null;

    if (!extractResp.ok) {
      const errBody = await extractResp.text().catch(() => "");
      console.error(`Groq extract failed ${extractResp.status}:`, errBody);
      if (extractResp.status === 429) return new Response(JSON.stringify({ error: "Too many requests, try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (extractResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Recover from tool_use_failed: model wrote JSON as text inside failed_generation
      if (extractResp.status === 400 && errBody.includes("tool_use_failed")) {
        try {
          const errJson = JSON.parse(errBody);
          const failedGen = errJson?.error?.failed_generation || "";
          filters = recoverFiltersFromText(failedGen);
          if (filters) console.log("Recovered filters from failed_generation");
        } catch { /* ignore */ }
      }

      if (!filters) {
        throw new Error(`AI extraction failed: ${extractResp.status} - ${errBody.slice(0, 200)}`);
      }
    } else {
      const extractData = await extractResp.json();
      const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        try { filters = JSON.parse(toolCall.function.arguments); } catch { /* fall through */ }
      }
      // Fallback: model returned JSON as plain content
      if (!filters) {
        const content = extractData.choices?.[0]?.message?.content || "";
        filters = recoverFiltersFromText(content);
      }
      if (!filters) throw new Error("No filter extracted");
    }
    const {
      keywords = [],
      category,
      gender,
      age_range,
      controversial,
      intent_summary,
      route = "simple",
      entities = [],
    } = filters;
    const safeRoute = (["simple", "medium", "complex"].includes(route) ? route : "simple") as "simple" | "medium" | "complex";
    const cost = ROUTE_COSTS[safeRoute];
    const model = ROUTE_MODEL[safeRoute];

    const normalizeTerm = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s&+-]/g, " ").replace(/\s+/g, " ").trim();
    const STOP_TERMS = new Set(["which", "what", "who", "last", "longer", "better", "best", "more", "less", "with", "without", "than", "vs", "or", "and"]);
    const topicalTerms = Array.from(new Set([...(Array.isArray(entities) ? entities : []), ...keywords]
      .map((term: string) => normalizeTerm(String(term || "")))
      .filter((term: string) => term.length >= 3 && !STOP_TERMS.has(term))));
    const categoryBuckets = category && category !== "any" ? (CATEGORY_MAP[category.toLowerCase()] || []) : [];

    // ---- 2. Query polls ----
    const buildQuery = (useCategory: boolean, useKeywords: boolean) => {
      let q = supabase
        .from("polls")
        .select("id, question, subtitle, option_a, option_b, image_a_url, image_b_url, category, created_at, baseline_votes_a, baseline_votes_b")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(80);

      if (useCategory) {
        if (categoryBuckets.length === 0) return null;
        q = q.in("category", categoryBuckets);
      }

      if (useKeywords) {
        const orFilters: string[] = [];
        for (const term of topicalTerms.slice(0, 5)) {
          orFilters.push(`question.ilike.%${term}%`);
          orFilters.push(`option_a.ilike.%${term}%`);
          orFilters.push(`option_b.ilike.%${term}%`);
          orFilters.push(`subtitle.ilike.%${term}%`);
        }
        if (orFilters.length === 0) return null;
        q = q.or(orFilters.join(","));
      }

      return q;
    };

    let polls: any[] = [];
    const attempts: Array<[boolean, boolean]> = mode === "decide"
      ? [[true, true], [false, true]]
      : [[true, true], [false, true], [true, false]];
    for (const [useCat, useKw] of attempts) {
      const queryBuilder = buildQuery(useCat, useKw);
      if (!queryBuilder) continue;
      const { data, error } = await queryBuilder;
      if (error) throw error;
      if (data && data.length > 0) { polls = data; break; }
    }

    // ---- Fetch sunset threshold (default 50) ----
    let sunsetThreshold = 50;
    {
      const { data: ss } = await supabase.from("seeding_settings").select("baseline_sunset_threshold").limit(1).maybeSingle();
      if (ss?.baseline_sunset_threshold) sunsetThreshold = ss.baseline_sunset_threshold;
    }

    // ---- 3. Vote stats ----
    const ids = polls.map((p) => p.id);
    const statsMap = new Map<string, any>();
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

    const getPollTopicalHitCount = (poll: any) => {
      if (topicalTerms.length === 0) return 0;
      const haystack = normalizeTerm([poll.question, poll.subtitle, poll.option_a, poll.option_b].filter(Boolean).join(" "));
      return topicalTerms.reduce((count, term) => count + (haystack.includes(term) ? 1 : 0), 0);
    };

    let matchedPolls = polls
      .map((p) => {
        const rawStats = statsMap.get(p.id) || { a: 0, b: 0, total: 0, viewerAge: { a: 0, b: 0, total: 0 }, viewerCity: { a: 0, b: 0, total: 0 }, genderM: { a: 0, b: 0, total: 0 }, genderF: { a: 0, b: 0, total: 0 } };
        const realTotal = rawStats.total;
        const baselineActive = realTotal < sunsetThreshold;
        const baseA = baselineActive ? (p.baseline_votes_a || 0) : 0;
        const baseB = baselineActive ? (p.baseline_votes_b || 0) : 0;
        // Merge baselines into top-line a/b/total only (demographic splits stay 100% real)
        const s = {
          ...rawStats,
          a: rawStats.a + baseA,
          b: rawStats.b + baseB,
          total: rawStats.total + baseA + baseB,
          realTotal,
          baselineActive,
        };
        const split = s.total > 0 ? s.a / s.total : 0.5;
        const controversyScore = 1 - Math.abs(split - 0.5) * 2;
        const topicalHits = getPollTopicalHitCount(p);
        return { ...p, _stats: s, _controversyScore: controversyScore, _topicalHits: topicalHits };
      })
      .filter((p: any) => {
        if (topicalTerms.length === 0) return categoryBuckets.length === 0 || categoryBuckets.includes(p.category);
        // Require at least 1 topical hit. Decide mode used to require 2, but brand
        // synonyms (e.g. "coke" vs "Coca-Cola") often only match one side.
        return p._topicalHits >= 1;
      });

    if (controversial) {
      matchedPolls = matchedPolls.filter((p: any) => p._stats.total >= 5).sort((a: any, b: any) => (b._topicalHits - a._topicalHits) || (b._controversyScore - a._controversyScore));
    } else {
      matchedPolls.sort((a: any, b: any) => (b._topicalHits - a._topicalHits) || (b._stats.total - a._stats.total));
    }

    matchedPolls = matchedPolls.slice(0, mode === "decide" ? 3 : 12);
    const totalVotes = matchedPolls.reduce((acc: number, p: any) => acc + (p._stats?.total || 0), 0);
    const totalRealVotes = matchedPolls.reduce((acc: number, p: any) => acc + (p._stats?.realTotal || 0), 0);
    const anyBaselineActive = matchedPolls.some((p: any) => p._stats?.baselineActive);

    // ---- 4. Zero-data guardrail (50 votes) ----
    if (matchedPolls.length === 0 || totalVotes < MIN_VOTES_GUARDRAIL) {
      // Only suggest TOPICALLY RELEVANT polls (matched by keyword/category).
      // Don't fall back to random recent polls — that creates a confusing UX
      // where someone asks "iPhone vs Samsung" and gets cosmetics suggestions.
      let suggestedPolls: any[] = [];

      let votedIds = new Set<string>();
      if (userId) {
        const { data: votedRows } = await supabase
          .from("votes")
          .select("poll_id")
          .eq("user_id", userId);
        votedIds = new Set((votedRows || []).map((v: any) => v.poll_id));
      }

      const mapPoll = (p: any) => ({
        id: p.id,
        question: p.question,
        option_a: p.option_a,
        option_b: p.option_b,
        image_a_url: p.image_a_url,
        image_b_url: p.image_b_url,
        category: p.category,
      });

      // Tier 1: matched polls (keyword/category hits)
      if (matchedPolls.length > 0) {
        suggestedPolls = matchedPolls
          .filter((p: any) => !votedIds.has(p.id))
          .slice(0, 3)
          .map(mapPoll);
        // If user voted on all matched, still re-show them so they see what data exists.
        if (suggestedPolls.length === 0) {
          suggestedPolls = matchedPolls.slice(0, 3).map(mapPoll);
        }
      }

      // Tier 2: same-category fallback only for broader research asks.
      // For decide-mode brand/product questions, category-only suggestions feel irrelevant.
      if (mode === "research" && suggestedPolls.length < 3 && categoryBuckets.length > 0) {
        const { data: catPolls } = await supabase
          .from("polls")
          .select("id, question, option_a, option_b, image_a_url, image_b_url, category")
          .eq("is_active", true)
          .in("category", categoryBuckets)
          .order("created_at", { ascending: false })
          .limit(20);
        const seen = new Set(suggestedPolls.map((p) => p.id));
        for (const p of catPolls || []) {
          if (suggestedPolls.length >= 3) break;
          const topicalHits = getPollTopicalHitCount(p);
          if (seen.has(p.id) || votedIds.has(p.id) || topicalTerms.length > 0 && topicalHits === 0) continue;
          suggestedPolls.push(mapPoll(p));
          seen.add(p.id);
        }
      }

      const summary = matchedPolls.length > 0
        ? `Versa found polls on this topic, but there still isn't enough vote data yet. Vote on these polls to help build the answer — and earn credits while you do.`
        : suggestedPolls.length > 0
          ? `Versa doesn't have enough data on this topic yet. Vote on these related polls to help build it — and earn credits while you do.`
          : `Versa doesn't have any polls on this topic yet. Try a different question, or vote on polls in the feed to help build new topics.`;

      // Log (no charge)
      if (userId) {
        await supabase.from("ask_versa_queries").insert({
          user_id: userId,
          question,
          mode,
          route: safeRoute,
          credits_charged: 0,
          answered: false,
          low_data: true,
          model_used: model,
          total_votes_considered: totalVotes,
          matched_poll_count: matchedPolls.length,
          category_hint: category && category !== "any" ? category : null,
        });
      }

      return new Response(
        JSON.stringify({
          stage: "guardrail",
          summary,
          low_data: true,
          credits_balance: userBalance,
          suggested_polls: suggestedPolls,
          route: safeRoute,
          mode,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- 5. PREVIEW stage: return cost + teaser, no charge ----
    if (stage === "preview") {
      // Build a quick teaser from the top poll without LLM call (cheap)
      const top = matchedPolls[0];
      const s = top._stats;
      const pctA = s.total > 0 ? Math.round((s.a / s.total) * 100) : 50;
      const pctB = 100 - pctA;
      const winnerLabel = pctA >= pctB ? top.option_a : top.option_b;
      const winnerPct = Math.max(pctA, pctB);
      const teaser = mode === "decide"
        ? `${winnerPct}% of Egyptians lean toward ${winnerLabel}…`
        : `Across ${matchedPolls.length} related polls and ${totalVotes} votes, here's what the data says…`;

      return new Response(
        JSON.stringify({
          stage: "preview",
          route: safeRoute,
          cost,
          credits_balance: userBalance,
          can_afford: userBalance >= cost,
          teaser,
          matched_poll_count: matchedPolls.length,
          total_votes: totalVotes,
          real_votes: totalRealVotes,
          baseline_active: anyBaselineActive,
          mode,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- 6. CONFIRM stage: charge credits, then build full answer ----
    if (!userId) {
      return new Response(JSON.stringify({ error: "Sign in to use Ask Versa." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: spendData, error: spendErr } = await supabase.rpc("spend_ask_credits", {
      p_user_id: userId,
      p_amount: cost,
    });
    if (spendErr) throw spendErr;
    if (!spendData?.success) {
      return new Response(JSON.stringify({
        error: "Not enough credits.",
        credits_balance: spendData?.balance ?? 0,
        cost,
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const newBalance = spendData.balance;

    // Build verdict / research using selected model
    let summary = intent_summary || "Here's what I found.";
    let verdict: any = null;

    if (mode === "decide") {
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

      const reasonResp = await callGroq(GROQ_API_KEY, model, {
        messages: [
          { role: "system", content: "You write ONE punchy sentence (max 18 words) explaining why Egyptians lean a certain way on a poll. No preamble, no quotes. Direct and confident." },
          { role: "user", content: `Question: "${top.question}"\nWinner: ${winnerLabel} (${winnerPct}%)\nLoser: ${winnerSide === "A" ? top.option_b : top.option_a} (${100 - winnerPct}%)\nSample size: ${s.total}\n\nWhy did people pick ${winnerLabel}? One sentence.` },
        ],
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
        real_votes: s.realTotal,
        baseline_active: !!s.baselineActive,
        reason,
        viewer_line: viewerLine,
      };
      summary = `${winnerPct}% of Egyptians pick ${winnerLabel}.`;
    } else {
      const sampleText = matchedPolls.slice(0, 8).map((p: any) => {
        const s = p._stats;
        const pctA = s.total > 0 ? Math.round((s.a / s.total) * 100) : 50;
        return `- "${p.question}" → ${p.option_a} ${pctA}% vs ${p.option_b} ${100 - pctA}% (n=${s.total})`;
      }).join("\n");
      const sumResp = await callGroq(GROQ_API_KEY, model, {
        messages: [
          { role: "system", content: "You write a 2-3 sentence research-style insight summary. Lead with the strongest concrete number. No bullet points. No mention of 'Gen Z' or generations. Direct and citation-worthy." },
          { role: "user", content: `User's research question: "${question}"\n\nMatched polls with results:\n${sampleText}\n\nWrite 2-3 sentences leading with the most striking stat.` },
        ],
      });
      if (sumResp.ok) {
        const sd = await sumResp.json();
        summary = sd.choices?.[0]?.message?.content?.trim() || summary;
      }
    }

    // Enriched poll cards
    const enrichedPolls = matchedPolls.map((p: any) => {
      const s = p._stats;
      const pctA = s.total > 0 ? Math.round((s.a / s.total) * 100) : 50;
      const pctB = 100 - pctA;
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
        real_votes: s.realTotal,
        baseline_active: !!s.baselineActive,
        viewer_age_line, viewer_city_line, gender_teaser,
      };
    });

    // Log answered query
    await supabase.from("ask_versa_queries").insert({
      user_id: userId,
      question,
      mode,
      route: safeRoute,
      credits_charged: cost,
      answered: true,
      low_data: false,
      model_used: model,
      total_votes_considered: totalVotes,
      matched_poll_count: matchedPolls.length,
      category_hint: category && category !== "any" ? category : null,
    });

    return new Response(
      JSON.stringify({
        stage: "answer",
        summary,
        verdict,
        filters,
        polls: enrichedPolls,
        count: enrichedPolls.length,
        mode,
        route: safeRoute,
        credits_charged: cost,
        credits_balance: newBalance,
        total_votes: totalVotes,
        real_votes: totalRealVotes,
        baseline_active: anyBaselineActive,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ask-versa error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
