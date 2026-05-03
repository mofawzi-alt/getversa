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

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL_FAST = "google/gemini-2.5-flash-lite"; // extraction + factual fallback
const MODEL_SMART = "google/gemini-2.5-flash";     // verdict writing (medium + complex) — fast + high quality

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
    description: "Classify a user question about Egyptian opinion polls and extract structured filter criteria.",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: `Classify the user's intent EXACTLY as one of:
- "preference": asks which option people prefer / pick / choose / lean toward / love more / vote for. e.g. "iPhone or Samsung?", "Do Egyptians prefer Coke or Pepsi?", "Which fast food brand wins with 18-24?"
- "factual": asks for a number, fact, definition, news, market data, technical info — anything Versa polls cannot answer. e.g. "iPhone market size?", "Who founded Apple?", "When did Vodafone enter Egypt?"
- "offscope": rude, harmful, nonsensical, code-help, math homework, personal life advice unrelated to consumer preferences.`,
        },
        keywords: { type: "array", items: { type: "string" }, description: "Key topical terms (lowercase)." },
        entities: { type: "array", items: { type: "string" }, description: "Named brands, products, people, or places explicitly mentioned (canonical form, lowercase). Include common synonyms inline, e.g. 'iphone' not 'apple iphone 15 pro'. For 'iPhone vs Samsung' return ['iphone','samsung']. For 'iPhone market size' return ['iphone']." },
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
      required: ["intent", "keywords", "entities", "route"],
    },
  },
};

// Brand/entity synonyms — extend as the catalogue grows.
// Each canonical key maps to a list of substrings we'll look for in poll text.
const ENTITY_SYNONYMS: Record<string, string[]> = {
  iphone: ["iphone", "apple"],
  samsung: ["samsung", "galaxy"],
  coke: ["coke", "coca", "cola"],
  pepsi: ["pepsi"],
  vodafone: ["vodafone"],
  orange: ["orange"],
  etisalat: ["etisalat"],
  we: ["we telecom", "we mobile"],
  talabat: ["talabat"],
  elmenus: ["elmenus"],
  uber: ["uber"],
  careem: ["careem"],
  costa: ["costa"],
  cilantro: ["cilantro"],
  starbucks: ["starbucks"],
  carrefour: ["carrefour"],
  spinneys: ["spinneys"],
  ahly: ["ahly", "ahli"],
  zamalek: ["zamalek"],
  apartment: ["apartment", "apt", "flat", "home"],
  apt: ["apartment", "apt", "flat", "home"],
};

function expandEntityVariants(entity: string): string[] {
  const e = entity.toLowerCase().trim();
  if (!e) return [];
  const direct = ENTITY_SYNONYMS[e];
  if (direct) return direct;
  // Look up by partial match (e.g. "iphone 15 pro" → iphone synonyms)
  for (const [key, synonyms] of Object.entries(ENTITY_SYNONYMS)) {
    if (e.includes(key)) return synonyms;
  }
  return [e];
}

async function callAI(apiKey: string, model: string, payload: any) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, ...payload }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  return resp;
}

async function readJsonSafely(resp: Response) {
  const text = await resp.text().catch(() => "");
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    // ---- Language detection: Arabic vs English ----
    // Any Arabic Unicode char in the question → respond in Egyptian Arabic (عامية).
    const isArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(question);
    const arabicInstruction = isArabic
      ? "\n\nIMPORTANT: The user wrote in Arabic. Reply in Egyptian Arabic (عامية مصرية) — conversational, natural Cairo street tone. NOT Modern Standard Arabic. Keep brand names in their original form (iPhone, Talabat, Vodafone, etc.). Numbers and percentages in Arabic numerals are fine."
      : "";

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

    // Generic follow-up detection: short imperative-style asks like
    // "show me the polls", "more polls", "show polls to vote on", "any polls?"
    // These have no standalone topical content — they refer to the previous user question.
    // We rewrite them to include the prior topic so extraction + matching stay on-topic.
    const lastUserTurn = [...trimmedHistory].reverse().find((h) => h.role === "user");
    const looksLikeGenericFollowup = (() => {
      const q = question.toLowerCase().trim();
      if (q.length > 80) return false;
      return /^(show|give|bring|list|find|any|more|other|related|what about|polls?|votes?|versa)/.test(q)
        && /(poll|vote|data|result|opinion|think|prefer|versa)/.test(q);
    })();
    let effectiveQuestion = question;
    if (looksLikeGenericFollowup && lastUserTurn) {
      effectiveQuestion = `${question} (about: ${lastUserTurn.content})`;
      console.log("Generic follow-up detected — rewrote with prior context:", effectiveQuestion);
    }

    // ---- 1. Extract filters + classify route (always uses fast model) ----
    let extractResp: Response | null = null;
    try {
      extractResp = await callAI(LOVABLE_API_KEY, MODEL_FAST, {
        messages: [
          {
            role: "system",
            content: `You classify questions for an Egyptian opinion-poll app called Versa, then extract filters.

Step 1 — INTENT (mandatory, exact value):
- "preference": user is asking which option people PREFER, PICK, CHOOSE, LEAN toward, LOVE more, vote for, or "X or Y?". This is what Versa's polls answer.
- "factual": user wants a number, fact, definition, market size, news, history, technical info, formula, or anything Versa votes cannot answer (e.g. "iPhone market size?", "Who founded Vodafone?", "When did Talabat launch?").
- "offscope": anything Versa shouldn't answer at all — rude, harmful, hate speech, illegal, code-writing requests ("write me python code"), math homework ("solve 2x+5=11"), personal advice unrelated to consumer choices ("should I dump my partner"), medical/legal advice, gibberish. When in doubt between factual and offscope, prefer factual.

Step 2 — ENTITIES: every brand/product/person/place explicitly named, in canonical lowercase form. "iPhone vs Samsung" → ["iphone","samsung"]. "iPhone market size" → ["iphone"]. "How divided are Egyptians on Ahly vs Zamalek" → ["ahly","zamalek"]. NEVER hallucinate entities not in the question.

Step 3 — Other filters (only set demographics when the question explicitly mentions them) and "route" complexity:
- simple: single poll/brand fact lookup
- medium: one demographic filter OR one category summary
- complex: synthesis across multiple polls/demographics

Categories: ${KNOWN_CATEGORIES.join(", ")}.
If conversation history is provided, the new question may be a FOLLOW-UP — infer underlying topic and merge entities from prior turns.`,
        },
        ...historyMessages,
        { role: "user", content: effectiveQuestion },
        ],
        tools: [FILTER_TOOL],
        tool_choice: { type: "function", function: { name: "extract_poll_filters" } },
      });
    } catch (e) {
      console.error("AI extract failed before response", e);
    }

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

    // Helper: retry without tool calling (uses JSON mode — far more reliable than Groq tool schema)
    const jsonModeRetry = async (): Promise<any | null> => {
      try {
        const retryResp = await callAI(LOVABLE_API_KEY, MODEL_FAST, {
          messages: [
            {
              role: "system",
              content: `Reply with ONLY a single JSON object (no prose, no markdown). Keys:
{"intent": "preference"|"factual"|"offscope", "keywords": ["..."], "entities": ["..."], "category": "any" or one of (${KNOWN_CATEGORIES.join(", ")}), "route": "simple"|"medium"|"complex", "controversial": false, "intent_summary": "..."}
Rules:
- keywords/entities MUST be JSON arrays of lowercase strings (NEVER a single string).
- "preference" = user asks which option people prefer (Versa polls answer this).
- "factual" = needs a number/fact/news Versa votes can't answer.
- "offscope" = harmful, code, math homework, gibberish.`,
            },
            ...historyMessages,
            { role: "user", content: effectiveQuestion },
          ],
          response_format: { type: "json_object" },
        });
        if (!retryResp.ok) {
          await retryResp.text().catch(() => "");
          return null;
        }
        const rd = await readJsonSafely(retryResp);
        if (!rd) return null;
        const content = rd.choices?.[0]?.message?.content || "";
        try { return JSON.parse(content); } catch { return recoverFiltersFromText(content); }
      } catch (e) {
        console.error("JSON-mode retry failed", e);
        return null;
      }
    };

    if (!extractResp || !extractResp.ok) {
      if (!extractResp) {
        filters = { keywords: question.toLowerCase().split(/\s+/).filter((w) => w.length >= 3).slice(0, 6), route: "simple", category: "any", intent: "preference" };
        console.log("AI extract unavailable — using minimal filters fallback");
      }
      if (!extractResp) {
        // Skip response-body recovery when fetch failed or timed out.
      } else {
      const errBody = await extractResp.text().catch(() => "");
      console.error(`Groq extract failed ${extractResp.status}:`, errBody);
      if (extractResp.status === 429) return new Response(JSON.stringify({ error: "Too many requests, try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (extractResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      if (extractResp.status === 400) {
        try {
          const errJson = JSON.parse(errBody);
          const failedGen = errJson?.error?.failed_generation || errJson?.error?.message || "";
          filters = recoverFiltersFromText(failedGen);
          if (filters) console.log("Recovered filters from 400 error body");
        } catch { /* ignore */ }
      }
      }

      if (!filters) {
        filters = await jsonModeRetry();
        if (filters) console.log("Recovered filters via JSON-mode retry");
      }

      if (!filters) {
        filters = { keywords: question.toLowerCase().split(/\s+/).filter((w) => w.length >= 3).slice(0, 6), route: "simple", category: "any", intent: "preference" };
        console.log("Synthesized minimal filters fallback");
      }
    } else {
      const extractData = await readJsonSafely(extractResp) || {};
      const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        try { filters = JSON.parse(toolCall.function.arguments); } catch { /* fall through */ }
      }
      if (!filters) {
        const content = extractData.choices?.[0]?.message?.content || "";
        filters = recoverFiltersFromText(content);
      }
      if (!filters) {
        filters = await jsonModeRetry();
      }
      if (!filters) {
        filters = { keywords: question.toLowerCase().split(/\s+/).filter((w) => w.length >= 3).slice(0, 6), route: "simple", category: "any", intent: "preference" };
        console.log("No filter extracted — using question synthesis fallback");
      }
    }
    const normalizeTerm = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s&+-]/g, " ").replace(/\s+/g, " ").trim();
    const STOP_TERMS = new Set(["which", "what", "who", "last", "longer", "better", "best", "more", "less", "with", "without", "than", "vs", "or", "and"]);
    const normalizeList = (value: unknown, minLength = 2): string[] => {
      const rawItems = Array.isArray(value)
        ? value
        : typeof value === "string"
          ? value.split(/,|\n|\||\/|\bvs\b|\bor\b|\band\b/gi)
          : [];

      return Array.from(new Set(rawItems
        .map((item) => normalizeTerm(String(item || "")))
        .flatMap((item) => item.split(/\s+/))
        .map((item) => item.trim())
        .filter((item) => item.length >= minLength && !STOP_TERMS.has(item))));
    };
    const normalizeOptionalString = (value: unknown) => typeof value === "string" ? value.trim() : "";
    const normalizeBoolean = (value: unknown) => {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return value.trim().toLowerCase() === "true";
      return false;
    };

    const keywords = normalizeList(filters?.keywords, 3);
    const rawEntities = normalizeList(filters?.entities, 2);
    const category = normalizeOptionalString(filters?.category).toLowerCase();
    const gender = normalizeOptionalString(filters?.gender).toLowerCase();
    const age_range = normalizeOptionalString(filters?.age_range).toLowerCase();
    const controversial = normalizeBoolean(filters?.controversial);
    const intent_summary = normalizeOptionalString(filters?.intent_summary);
    const route = normalizeOptionalString(filters?.route).toLowerCase();
    const rawIntent = normalizeOptionalString(filters?.intent).toLowerCase();

    let intent = (["preference", "factual", "offscope"].includes(rawIntent)
      ? rawIntent
      : "preference") as "preference" | "factual" | "offscope";

    // Research-mode override: in research mode, opinion/comparison/lifestyle/attitude questions
    // are exactly what Versa polls answer ("Cairo vs Alexandria lifestyle", "How do students feel about X").
    // Only treat as factual when the question is clearly a hard lookup (year/date/market size/who-founded).
    if (mode === "research" && intent === "factual") {
      const q = question.toLowerCase();
      const hardLookup = /\b(when did|what year|how many|market size|market share|revenue|founded by|who founded|population of|gdp|currency|capital of|ceo of|headquarters)\b/.test(q);
      const opinionShape = /\b(vs|versus|or |feel|think|prefer|love|like|hate|differences?|lifestyle|attitudes?|opinions?|divided|split|culture|trend|popular|wins?|better)\b/.test(q);
      if (!hardLookup || opinionShape) {
        intent = "preference";
      }
    }
    const safeRoute = (["simple", "medium", "complex"].includes(route) ? route : "simple") as "simple" | "medium" | "complex";
    const cost = ROUTE_COSTS[safeRoute];
    const model = ROUTE_MODEL[safeRoute];

    const cleanedEntities: string[] = Array.from(new Set(rawEntities.filter((e) => e.length >= 2 && !STOP_TERMS.has(e))));
    const requiredEntityVariants = cleanedEntities.map((e) => expandEntityVariants(e));
    const topicalTerms = Array.from(new Set([...cleanedEntities, ...keywords]
      .map((term: string) => normalizeTerm(String(term || "")))
      .filter((term: string) => term.length >= 3 && !STOP_TERMS.has(term))));
    const categoryBuckets = category && category !== "any" ? (CATEGORY_MAP[category] || []) : [];

    // ---- 1a. Self-referential guard: questions about Versa the app itself ----
    // Detect "what is versa", "how does versa work", "who made versa", "is versa free", etc.
    // Returns a clear product explanation, no charge, no DB hit.
    {
      const q = question.toLowerCase().trim();
      // Match English "versa" or Arabic spellings (ڤيرسا / فيرسا / ڤرسا)
      const mentionsVersa = /\bversa\b/.test(q) || /(ڤيرسا|فيرسا|ڤرسا|ڤيرزا|فيرزا)/.test(question);
      const aboutShape = /\b(what(?:'?s| is)?|whats|whts|wat|wht|who(?:'?s| is| made| owns| built| created)|how(?: do(?:es)?| can)|why|is|are|does|tell me about|explain|describe|about)\b/.test(q)
        || /(إيه|ايه|ما هي|ما هو|مين|إزاي|ازاي|عن|يعني|بتعمل|بيعمل|بتشتغل|بيشتغل|التطبيق|الأبلكيشن|الابلكيشن)/.test(question);
      // Short bare queries like "versa", "versa?", "what is this app"
      const bareSelf = /^(versa\??|what(?:'s| is)? (?:this|the) app\??|what does this app do\??|how does this app work\??|about (?:this )?app\??)$/i.test(q)
        || /^(ڤيرسا|فيرسا|ڤرسا)\??$/.test(question.trim());
      if (bareSelf || (mentionsVersa && aboutShape)) {
        const summary = isArabic
          ? "ڤيرسا هي محرك آراء مصر.\n\nكل يوم، المصريين بيختاروا بين حاجتين — براندات، أكل، لايف ستايل، فلوس، ثقافة. كل اختيار ده داتا سلوكية حقيقية متسجلة بالسن والجنس والمدينة.\n\nكل ما تصوّت أكتر، ڤيرسا بتعرف أكتر إيه اللي مصر بتفضّله فعلاً — مش اللي الناس بتقول إنها بتفضّله، لأ، اللي بيختاروه بجد.\n\nاسألني أي حاجة عن رأي مصر. هقولك الداتا بتقول إيه."
          : "Versa is Egypt's opinion engine.\n\nEvery day, Egyptians swipe to choose between two things — brands, food, lifestyle, money, culture. Every choice is real behavioral data tagged by age, gender, and city.\n\nThe more you vote, the more Versa learns what Egypt actually prefers — not what people say they prefer, but what they actually choose.\n\nAsk me anything about what Egypt thinks. I'll tell you what the data says.";
        let queryId: string | null = null;
        if (userId) {
          const { data: inserted } = await supabase.from("ask_versa_queries").insert({
            user_id: userId, question, mode, route: safeRoute,
            credits_charged: 0, answered: true, low_data: true,
            model_used: null, total_votes_considered: 0, matched_poll_count: 0,
            category_hint: null,
          }).select("id").maybeSingle();
          queryId = inserted?.id ?? null;
        }
        return new Response(JSON.stringify({
          stage: "about",
          summary,
          notice: "About Versa",
          credits_balance: userBalance,
          route: safeRoute,
          mode,
          query_id: queryId,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ---- 1b. Off-scope or factual short-circuit (no charge, no DB hit) ----
    if (intent === "offscope") {
      let queryId: string | null = null;
      if (userId) {
        const { data: inserted } = await supabase.from("ask_versa_queries").insert({
          user_id: userId, question, mode, route: safeRoute,
          credits_charged: 0, answered: false, low_data: true,
          model_used: model, total_votes_considered: 0, matched_poll_count: 0,
          category_hint: category && category !== "any" ? category : null,
        }).select("id").maybeSingle();
        queryId = inserted?.id ?? null;
      }
      return new Response(JSON.stringify({
        stage: "offscope",
        summary: isArabic
          ? "ڤيرسا متخصصة في أسئلة تفضيلات المستهلك — حاجات المصريين بيصوّتوا عليها زي البراندات، الأكل، اللايف ستايل، أو العلاقات. جرّب سؤال زي \"كوكا ولا بيبسي؟\" أو \"الطلبة رأيهم إيه في التعليم أونلاين؟\"."
          : "Versa is built for consumer preference questions — things people in Egypt vote on, like brands, food, lifestyle, or relationships. Try a question like \"Coke or Pepsi?\" or \"What do students think about online learning?\".",
        credits_balance: userBalance,
        route: safeRoute,
        mode,
        query_id: queryId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (intent === "factual") {
      // Honest general-knowledge answer, clearly labeled. No vote data, no charge.
      let factualAnswer = "I can answer this from general knowledge, but it's not from Versa votes.";
      try {
        const factResp = await callAI(LOVABLE_API_KEY, MODEL_FAST, {
          messages: [
            { role: "system", content: "You answer factual questions in 2-3 short sentences. Be direct, accurate, and cite a rough year if possible. If you don't know, say so. Never invent statistics." + arabicInstruction },
            { role: "user", content: question },
          ],
        });
        if (factResp.ok) {
          const fd = await readJsonSafely(factResp) || {};
          factualAnswer = fd.choices?.[0]?.message?.content?.trim() || factualAnswer;
        }
      } catch (e) {
        console.error("factual answer failed", e);
      }

      let queryId: string | null = null;
      if (userId) {
        const { data: inserted } = await supabase.from("ask_versa_queries").insert({
          user_id: userId, question, mode, route: safeRoute,
          credits_charged: 0, answered: true, low_data: true,
          model_used: MODEL_FAST, total_votes_considered: 0, matched_poll_count: 0,
          category_hint: category && category !== "any" ? category : null,
        }).select("id").maybeSingle();
        queryId = inserted?.id ?? null;
      }

      return new Response(JSON.stringify({
        stage: "factual",
        summary: factualAnswer,
        notice: "General knowledge — not from Versa votes.",
        credits_balance: userBalance,
        route: safeRoute,
        mode,
        query_id: queryId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


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

    // Generate stem variants so "rent" matches "renting", "rents", "rented".
    const expandStemVariants = (term: string): string[] => {
      const t = term.toLowerCase().trim();
      if (t.length < 3) return [t];
      const variants = new Set<string>([t]);
      // Plural / -s
      if (!t.endsWith("s")) variants.add(t + "s"); else variants.add(t.replace(/s$/, ""));
      // -ing / -ed (only for verb-like terms)
      if (t.length >= 4 && !t.endsWith("ing") && !t.endsWith("ed")) {
        variants.add(t + "ing");
        variants.add(t + "ed");
        if (t.endsWith("e")) {
          variants.add(t.slice(0, -1) + "ing");
          variants.add(t + "d");
        }
      }
      return Array.from(variants);
    };

    const topicalTermVariants = topicalTerms.map((t) => expandStemVariants(t));

    const getPollTopicalHitCount = (poll: any) => {
      if (topicalTermVariants.length === 0) return 0;
      const haystack = normalizeTerm([poll.question, poll.subtitle, poll.option_a, poll.option_b, poll.category].filter(Boolean).join(" "));
      return topicalTermVariants.reduce((count, variants) => count + (variants.some((v) => haystack.includes(v)) ? 1 : 0), 0);
    };

    // Entity gate: with 2+ entities require all (e.g. "iphone vs samsung" → both must appear).
    // With a single entity, also require it (avoids false matches like "apt" matching everything),
    // BUT we will softly relax this later if it produces zero polls.
    const pollMatchesAllEntities = (poll: any) => {
      if (requiredEntityVariants.length === 0) return true;
      const haystack = normalizeTerm([poll.question, poll.subtitle, poll.option_a, poll.option_b].filter(Boolean).join(" "));
      return requiredEntityVariants.every((variants) => variants.some((v) => haystack.includes(v)));
    };

    const enrichedPollList = polls.map((p) => {
      const rawStats = statsMap.get(p.id) || { a: 0, b: 0, total: 0, viewerAge: { a: 0, b: 0, total: 0 }, viewerCity: { a: 0, b: 0, total: 0 }, genderM: { a: 0, b: 0, total: 0 }, genderF: { a: 0, b: 0, total: 0 } };
      const realTotal = rawStats.total;
      const baselineActive = realTotal < sunsetThreshold;
      const baseA = baselineActive ? (p.baseline_votes_a || 0) : 0;
      const baseB = baselineActive ? (p.baseline_votes_b || 0) : 0;
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
      const entityMatch = pollMatchesAllEntities(p);
      return { ...p, _stats: s, _controversyScore: controversyScore, _topicalHits: topicalHits, _entityMatch: entityMatch };
    });

    // VAGUE-QUESTION GUARD (decide mode): no specific A vs B → ask a clarifier instead of guessing.
    // Triggers when the user has 0 entities AND ≤1 generic topical term (e.g. "best place to eat",
    // "what should I wear tonight", "where to go out"). Research mode is more permissive.
    const looksVague = mode === "decide"
      && requiredEntityVariants.length === 0
      && topicalTerms.length <= 1;

    if (looksVague) {
      // Ask Lovable AI for 3 concrete A-vs-B reframings of the user's broad question.
      let clarifications: Array<{ label: string; question: string }> = [];
      try {
        const clarResp = await callAI(LOVABLE_API_KEY, MODEL_FAST, {
          messages: [
            {
              role: "system",
              content: `You turn a vague Egyptian-consumer question into 3 specific A-vs-B choices Versa can answer from polls.
Rules:
- Each clarifier MUST be a concrete pair of two named options Egyptians would actually choose between.
- Use brands, places, or lifestyle behaviours common in Egypt (Cairo/Alexandria/Sahel/Sahel context welcome).
- Keep each rewritten question under 9 words, ending with "?".
- "label" = short 2-4 word chip text. "question" = full rephrased question to send back.
Examples:
  "best place to eat" → [
    {"label":"Street food vs fine dining","question":"Street food or fine dining?"},
    {"label":"Talabat vs Elmenus","question":"Talabat or Elmenus tonight?"},
    {"label":"Eat out vs cook home","question":"Eat out or cook at home?"}
  ]
  "what should I wear" → [
    {"label":"Denim vs leather","question":"Denim jacket or leather jacket?"},
    {"label":"Modest vs trendy","question":"Modest aesthetic or trendy aesthetic?"},
    {"label":"Sneakers vs loafers","question":"Sneakers or loafers for going out?"}
  ]` + arabicInstruction + (isArabic ? "\nWrite both label and question in Egyptian Arabic (عامية). Brand names stay in their original form." : ""),
            },
            { role: "user", content: question },
          ],
          response_format: { type: "json_object" },
        });
        if (clarResp.ok) {
          const cd = await readJsonSafely(clarResp) || {};
          const raw = cd.choices?.[0]?.message?.content || "";
          try {
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.clarifications) ? parsed.clarifications : (Array.isArray(parsed?.options) ? parsed.options : []));
            clarifications = arr
              .filter((c: any) => c && typeof c.label === "string" && typeof c.question === "string")
              .slice(0, 3);
          } catch { /* fall through */ }
        }
      } catch (e) {
        console.error("clarifier generation failed", e);
      }

      // Fallback chips if the AI call failed.
      if (clarifications.length === 0) {
        clarifications = isArabic
          ? [
              { label: "كوكا ولا بيبسي", question: "كوكا ولا بيبسي؟" },
              { label: "طلبات ولا المنيوز", question: "طلبات ولا المنيوز الليلة؟" },
              { label: "القاهرة ولا الساحل", question: "القاهرة ولا الساحل الويك إند ده؟" },
            ]
          : [
              { label: "Coke vs Pepsi", question: "Coke or Pepsi?" },
              { label: "Talabat vs Elmenus", question: "Talabat or Elmenus tonight?" },
              { label: "Cairo vs Sahel", question: "Cairo or Sahel this weekend?" },
            ];
      }

      let queryId: string | null = null;
      if (userId) {
        const { data: inserted } = await supabase.from("ask_versa_queries").insert({
          user_id: userId, question, mode, route: safeRoute,
          credits_charged: 0, answered: false, low_data: true,
          model_used: MODEL_FAST, total_votes_considered: 0, matched_poll_count: 0,
          category_hint: category && category !== "any" ? category : null,
        }).select("id").maybeSingle();
        queryId = inserted?.id ?? null;
      }

      return new Response(JSON.stringify({
        stage: "clarify",
        summary: "That's a broad one — pick a specific match-up so I can pull a clear verdict from real votes:",
        clarifications,
        credits_balance: userBalance,
        route: safeRoute,
        mode,
        query_id: queryId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let matchedPolls = enrichedPollList.filter((p: any) => {
      if (!p._entityMatch) return false;
      // Without entities, require at least one topical hit OR a category match.
      if (topicalTerms.length === 0) {
        if (categoryBuckets.length === 0) return false;
        return categoryBuckets.includes(p.category);
      }
      return p._topicalHits >= 1;
    });

    // Soft relax: if entity gate killed everything but topical terms find polls,
    // accept those (e.g. "rent or buy apt" — the entity 'apt' may not literally appear in poll text).
    if (matchedPolls.length === 0 && topicalTerms.length > 0) {
      const topicalOnly = enrichedPollList.filter((p: any) => p._topicalHits >= 1);
      if (topicalOnly.length > 0) {
        console.log(`Entity gate killed all ${requiredEntityVariants.length} entities — falling back to ${topicalOnly.length} topical matches`);
        matchedPolls = topicalOnly;
      }
    }

    // Final relax: if still empty and we have a category, fall back to category matches.
    if (matchedPolls.length === 0 && categoryBuckets.length > 0) {
      const catOnly = enrichedPollList.filter((p: any) => categoryBuckets.includes(p.category));
      if (catOnly.length > 0) {
        console.log(`Topical gate killed everything — falling back to ${catOnly.length} category matches`);
        matchedPolls = catOnly;
      }
    }

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

      // Tier 2: same-category fallback (both decide and research). When no matched polls
      // exist (e.g. "safest ride app" finds nothing under transport entities), still surface
      // a few related polls so users have something to vote on.
      if (suggestedPolls.length < 3 && categoryBuckets.length > 0) {
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
          if (seen.has(p.id) || votedIds.has(p.id)) continue;
          // In decide mode require a topical hit so suggestions stay on-topic
          // (avoids showing random category polls when the user asked about a specific brand).
          if (mode === "decide" && topicalTerms.length > 0 && getPollTopicalHitCount(p) === 0) continue;
          suggestedPolls.push(mapPoll(p));
          seen.add(p.id);
        }
      }

      // Tier 3: keyword-only recent polls — last resort so guardrail is never empty
      // when the user has clear topical terms (e.g. "ride app" → search recent polls
      // mentioning ride/uber/careem even without a category match).
      if (suggestedPolls.length === 0 && topicalTerms.length > 0) {
        const orFilters: string[] = [];
        for (const term of topicalTerms.slice(0, 5)) {
          orFilters.push(`question.ilike.%${term}%`);
          orFilters.push(`option_a.ilike.%${term}%`);
          orFilters.push(`option_b.ilike.%${term}%`);
        }
        if (orFilters.length > 0) {
          const { data: kwPolls } = await supabase
            .from("polls")
            .select("id, question, option_a, option_b, image_a_url, image_b_url, category")
            .eq("is_active", true)
            .or(orFilters.join(","))
            .order("created_at", { ascending: false })
            .limit(10);
          const seen = new Set(suggestedPolls.map((p) => p.id));
          for (const p of kwPolls || []) {
            if (suggestedPolls.length >= 3) break;
            if (seen.has(p.id) || votedIds.has(p.id)) continue;
            suggestedPolls.push(mapPoll(p));
            seen.add(p.id);
          }
        }
      }

      const summary = matchedPolls.length > 0
        ? `Versa found polls on this topic, but there still isn't enough vote data yet. Vote on these polls to help build the answer — and earn credits while you do.`
        : suggestedPolls.length > 0
          ? `Versa doesn't have enough data on this topic yet. Vote on these related polls to help build it — and earn credits while you do.`
          : `Versa doesn't have any polls on this topic yet. Try a different question, or vote on polls in the feed to help build new topics.`;

      // Log (no charge)
      let queryId: string | null = null;
      if (userId) {
        const { data: inserted } = await supabase.from("ask_versa_queries").insert({
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
        }).select("id").maybeSingle();
        queryId = inserted?.id ?? null;
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
          query_id: queryId,
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

      const reasonResp = await callAI(LOVABLE_API_KEY, model, {
        messages: [
          { role: "system", content: "You write ONE punchy sentence (max 18 words) explaining why Egyptians lean a certain way on a poll. No preamble, no quotes. Direct and confident." + arabicInstruction },
          { role: "user", content: `Question: "${top.question}"\nWinner: ${winnerLabel} (${winnerPct}%)\nLoser: ${winnerSide === "A" ? top.option_b : top.option_a} (${100 - winnerPct}%)\nSample size: ${s.total}\n\nWhy did people pick ${winnerLabel}? One sentence.` },
        ],
      });
      let reason = "";
      if (reasonResp.ok) {
        const rd = await readJsonSafely(reasonResp) || {};
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
      summary = isArabic
        ? `${winnerPct}% من المصريين بيختاروا ${winnerLabel}.`
        : `${winnerPct}% of Egyptians pick ${winnerLabel}.`;
    } else {
      const sampleText = matchedPolls.slice(0, 8).map((p: any) => {
        const s = p._stats;
        const pctA = s.total > 0 ? Math.round((s.a / s.total) * 100) : 50;
        return `- "${p.question}" → ${p.option_a} ${pctA}% vs ${p.option_b} ${100 - pctA}% (n=${s.total})`;
      }).join("\n");
      const sumResp = await callAI(LOVABLE_API_KEY, model, {
        messages: [
          { role: "system", content: "You write a 2-3 sentence research-style insight summary. Lead with the strongest concrete number. No bullet points. No mention of 'Gen Z' or generations. Direct and citation-worthy." + arabicInstruction },
          { role: "user", content: `User's research question: "${question}"\n\nMatched polls with results:\n${sampleText}\n\nWrite 2-3 sentences leading with the most striking stat.` },
        ],
      });
      if (sumResp.ok) {
        const sd = await readJsonSafely(sumResp) || {};
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
    return new Response(JSON.stringify({
      error: "Ask Versa is taking too long. Please try again.",
      fallback: true,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
