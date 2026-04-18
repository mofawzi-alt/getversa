import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AI-facing simple labels mapped to actual DB category values
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
          description: "Key topical terms to fuzzy-search in poll question/options (e.g. 'ramadan', 'coca-cola', 'football'). Lowercase, single words preferred.",
        },
        category: {
          type: "string",
          enum: [...KNOWN_CATEGORIES, "any"],
          description: "Best-matching Versa category, or 'any' if unclear.",
        },
        gender: {
          type: "string",
          enum: ["male", "female", "any"],
          description: "Voter gender filter — only set if user explicitly mentions men/women.",
        },
        age_range: {
          type: "string",
          enum: ["under_18", "18-24", "25-34", "35-44", "45+", "any"],
          description: "Voter age range filter — only set if user mentions an age group.",
        },
        controversial: {
          type: "boolean",
          description: "True if user asks for split/controversial/divisive polls (close to 50/50).",
        },
        intent_summary: {
          type: "string",
          description: "One-sentence rephrasing of what the user is looking for.",
        },
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

    const { question } = await req.json();
    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Please ask a fuller question." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Extract filters via tool calling
    const extractResp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: `You translate natural language questions about Egyptian Gen Z opinion polls into structured filters. Categories available: ${KNOWN_CATEGORIES.join(", ")}. Be conservative — only set demographic filters when explicitly asked.`,
          },
          { role: "user", content: question },
        ],
        tools: [FILTER_TOOL],
        tool_choice: { type: "function", function: { name: "extract_poll_filters" } },
      }),
    });

    if (!extractResp.ok) {
      if (extractResp.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests, try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (extractResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI extraction failed: ${extractResp.status}`);
    }

    const extractData = await extractResp.json();
    const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No filter extracted");

    const filters = JSON.parse(toolCall.function.arguments);
    const { keywords = [], category, gender, age_range, controversial, intent_summary } = filters;

    // 2. Query polls — try progressively looser filters until we get results
    const buildQuery = (useCategory: boolean, useKeywords: boolean) => {
      let q = supabase
        .from("polls")
        .select("id, question, subtitle, option_a, option_b, image_a_url, image_b_url, category, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(60);

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

    // Try strict (category + keywords) → keywords only → category only → recent fallback
    let polls: any[] = [];
    const attempts: Array<[boolean, boolean]> = [[true, true], [false, true], [true, false], [false, false]];
    for (const [useCat, useKw] of attempts) {
      const { data, error } = await buildQuery(useCat, useKw);
      if (error) throw error;
      if (data && data.length > 0) { polls = data; break; }
    }

    let matchedPolls = polls;

    // 3. If demographic filter set, score polls by vote splits matching the filter
    if ((gender && gender !== "any") || (age_range && age_range !== "any") || controversial) {
      const ids = matchedPolls.map((p) => p.id);
      if (ids.length > 0) {
        let voteQ = supabase.from("votes").select("poll_id, choice, voter_gender, voter_age_range").in("poll_id", ids);
        const { data: votes } = await voteQ;
        const stats = new Map<string, { a: number; b: number; total: number }>();
        votes?.forEach((v: any) => {
          if (gender && gender !== "any" && v.voter_gender !== gender) return;
          if (age_range && age_range !== "any" && v.voter_age_range !== age_range) return;
          const s = stats.get(v.poll_id) || { a: 0, b: 0, total: 0 };
          if (v.choice === "a") s.a++; else if (v.choice === "b") s.b++;
          s.total++;
          stats.set(v.poll_id, s);
        });
        matchedPolls = matchedPolls
          .map((p) => {
            const s = stats.get(p.id) || { a: 0, b: 0, total: 0 };
            const split = s.total > 0 ? s.a / s.total : 0.5;
            const controversyScore = 1 - Math.abs(split - 0.5) * 2; // 1 when 50/50
            return { ...p, _stats: s, _controversyScore: controversyScore };
          })
          .filter((p: any) => p._stats.total >= 3)
          .sort((a: any, b: any) =>
            controversial ? b._controversyScore - a._controversyScore : b._stats.total - a._stats.total
          );
      }
    }

    matchedPolls = matchedPolls.slice(0, 12);

    // 4. AI summary of findings
    let summary = intent_summary || "Here's what I found.";
    if (matchedPolls.length > 0) {
      const sampleText = matchedPolls
        .slice(0, 8)
        .map((p: any) => `- "${p.question}" (${p.option_a} vs ${p.option_b})`)
        .join("\n");
      const sumResp = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            {
              role: "system",
              content: "You write 1-2 punchy sentences summarizing what these Egyptian Gen Z polls reveal. No bullet points. Direct, confident, culturally aware.",
            },
            {
              role: "user",
              content: `User asked: "${question}"\n\nMatched polls:\n${sampleText}\n\nWrite a 1-2 sentence insight summary.`,
            },
          ],
        }),
      });
      if (sumResp.ok) {
        const sd = await sumResp.json();
        summary = sd.choices?.[0]?.message?.content?.trim() || summary;
      }
    } else {
      summary = `No polls match "${question}" yet. Try a brand name (e.g. "Coca-Cola", "Vodafone"), a topic ("football", "fashion"), or browse by category.`;
    }

    return new Response(
      JSON.stringify({
        summary,
        filters,
        polls: matchedPolls.map(({ _stats, _controversyScore, ...p }: any) => p),
        count: matchedPolls.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ask-versa error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
