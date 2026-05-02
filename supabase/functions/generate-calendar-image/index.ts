import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// ─── Shared Versa Image Pipeline v3 ───

const EGYPT_KEYWORDS = [
  "كشري","شاورما","فول","طعمية","كباب","مشويات",
  "sahel","gouna","cairo","alexandria","zamalek","maadi","new cairo","ain sokhna","hurghada",
  "vodafone","orange","etisalat","talabat","elmenus","noon","carrefour","juhayna","edita",
  "ramadan","رمضان","eid","عيد",
];

function detectEgyptContext(text: string): boolean {
  if (!text) return false;
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(text)) return true;
  const lower = text.toLowerCase();
  return EGYPT_KEYWORDS.some((kw) => lower.includes(kw));
}

const COUNTRY_DIRECTIVES: Record<string, string> = {
  egypt: "Setting: contemporary Cairo or Egyptian city. Cast: Egyptian / North African faces, Gen Z. Arabic signage, local streets, Egyptian lifestyle atmosphere.",
  uae: "Setting: contemporary Dubai or Abu Dhabi. Cast: mixed Arab and South Asian faces, cosmopolitan MENA. Modern Gulf architecture, clean urban environment.",
  "united arab emirates": "Setting: contemporary Dubai or Abu Dhabi. Cast: mixed Arab and South Asian faces, cosmopolitan MENA. Modern Gulf architecture, clean urban environment.",
  "saudi arabia": "Setting: contemporary Riyadh or Jeddah. Cast: Saudi Arab faces, modest fashion, Gen Z. Modern Saudi urban environment, Vision 2030 aesthetic.",
  ksa: "Setting: contemporary Riyadh or Jeddah. Cast: Saudi Arab faces, modest fashion, Gen Z. Modern Saudi urban environment, Vision 2030 aesthetic.",
  kuwait: "Setting: contemporary Kuwait City. Cast: Kuwaiti Arab faces, Gulf aesthetic, Gen Z. Modern Gulf urban environment.",
  jordan: "Setting: contemporary Amman. Cast: Jordanian / Levantine Arab faces, Gen Z. Modern Amman urban atmosphere.",
  lebanon: "Setting: contemporary Beirut. Cast: Lebanese / Levantine faces, cosmopolitan, Gen Z. Beirut urban lifestyle atmosphere.",
  morocco: "Setting: contemporary Casablanca or Rabat. Cast: Moroccan / North African faces, Gen Z. Modern Moroccan urban environment.",
  mena: "Setting: contemporary Middle East and North Africa. Cast: Arab faces, diverse MENA nationalities, Gen Z. Modern urban MENA environment. No Western-coded settings.",
  gcc: "Setting: contemporary Gulf region. Cast: Arab Gulf faces, cosmopolitan mix, Gen Z. Modern Gulf urban environment, clean and premium aesthetic.",
  global: "Setting: neutral cosmopolitan urban environment. Cast: diverse international Gen Z. No specific national markers.",
};

const CONTEXT_DIRECTIVES: Record<string, string> = {
  "Cairo street": " Scene: a contemporary Cairo street — local architecture, Egyptian pedestrians, Arabic signage, authentic urban atmosphere.",
  "Sahel beach": " Scene: North Coast (Sahel) Egypt — Mediterranean beach, white compound aesthetic, Egyptian Gen Z in summer mode.",
  "Egyptian home": " Scene: a modern Egyptian home interior — local decor cues, family or friends, warm natural light.",
  "Egyptian office": " Scene: a contemporary Cairo office or co-working space — Egyptian professionals, modern but locally rooted.",
  "Egyptian café": " Scene: a Cairo specialty café or ahwa — Egyptian Gen Z, local atmosphere, occasional Arabic signage in background.",
  "Egyptian university campus": " Scene: a modern Egyptian university campus — lecture halls, outdoor quads, Gen Z students in casual 2026 fashion, backpacks, study groups.",
  "Egyptian mall or shopping center": " Scene: inside a modern Egyptian mall — escalators, bright storefronts, Arabic signage, Gen Z shoppers browsing.",
  "Egyptian gym or outdoor public space": " Scene: a modern Egyptian gym or outdoor park — fitness equipment, athletic wear, Gen Z working out or jogging in an Egyptian neighbourhood.",
  "Nile view or Cairo waterfront": " Scene: Cairo Nile corniche or waterfront — river view, feluccas in background, golden hour, aspirational Egyptian lifestyle.",
  "Egyptian wedding venue or celebration": " Scene: an Egyptian wedding or celebration hall — festive lights, colourful decorations, joyful Gen Z guests in semi-formal Egyptian style.",
  "New Cairo compound or premium residential": " Scene: a modern New Cairo gated compound — clean streets, manicured gardens, premium villas, aspirational Egyptian residential lifestyle.",
  "Generic global": "",
};

const PAIR_BALANCE_RULE = "This image will appear side by side with a paired image on a split poll card. Generate with awareness of visual pairing — match brightness level approximately, use complementary not clashing color temperatures, ensure compositional weight is balanced so both images feel like they belong in the same visual world. The two images must not visually clash when placed next to each other.";

const ONE_SECOND_CLARITY_RULE = "The image must communicate the option meaning in under 1 second to a viewer who has never seen the prompt. Generate only the exact physical action or scene described — never an approximate, symbolic, or loosely related scene. If the intended action is not immediately and obviously visible — the image fails. Regenerate until the action is unmistakable.";

function buildImagePrompt(subject: string, question: string, category: string, countryDirective: string, contextDirective: string, keywordBoost: string): string {
  return `Generate an image (do not reply with text). Cinematic lifestyle photograph, DSLR, candid, magazine-grade. NO logos, brands, text, UI, posters, graphics, illustrations. Subject: ${subject}. Visual context: ${category || "lifestyle"}. Question: "${question}". WHO: ONE visible human aged 18–30, Gen Z, modern casual 2026 clothing, natural expression. ${countryDirective}${contextDirective}${keywordBoost} ${PAIR_BALANCE_RULE} ${ONE_SECOND_CLARITY_RULE} Never default to Western, American, or European settings.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { calendar_id, option } = await req.json();
    if (!calendar_id || !["A", "B", "both"].includes(option)) {
      return new Response(JSON.stringify({ error: "calendar_id and option (A|B|both) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Validate caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: corsHeaders });

    const { data: row, error: fetchErr } = await supabase
      .from("poll_calendar")
      .select("id,question,option_a,option_b,category,cultural_context,target_country")
      .eq("id", calendar_id)
      .single();
    if (fetchErr || !row) throw fetchErr || new Error("not found");

    const resolvedContext: string = (row.cultural_context && row.cultural_context.trim()) || "";
    const resolvedCountry: string = (row.target_country || "").trim();

    const targets: ("A" | "B")[] = option === "both" ? ["A", "B"] : [option as "A" | "B"];
    const updates: Record<string, string> = {};

    const countryDirective = COUNTRY_DIRECTIVES[resolvedCountry.toLowerCase()] || COUNTRY_DIRECTIVES.mena;

    for (const opt of targets) {
      const optionText = opt === "A" ? row.option_a : row.option_b;
      const combined = `${row.question || ""} ${optionText} ${row.category || ""}`;
      const contextDirective = resolvedContext ? (CONTEXT_DIRECTIVES[resolvedContext] || "") : "";
      const keywordBoost = detectEgyptContext(combined)
        ? " Local cue detected: ensure Egyptian / Arabic signage and local Egyptian atmosphere are clearly present."
        : "";
      const prompt = buildImagePrompt(optionText, row.question, row.category || "lifestyle", countryDirective, contextDirective, keywordBoost);

      const models = ["google/gemini-3-pro-image-preview", "google/gemini-3.1-flash-image-preview", "google/gemini-2.5-flash-image"];
      let dataUrl: string | undefined;
      let lastErr = "";
      for (let attempt = 0; attempt < 3 && !dataUrl; attempt++) {
        const model = models[Math.min(attempt, models.length - 1)];
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], modalities: ["image", "text"] }),
        });
        if (!aiRes.ok) {
          const t = await aiRes.text();
          lastErr = `AI gen ${aiRes.status}: ${t.slice(0, 200)}`;
          console.warn(`Attempt ${attempt + 1} failed for option ${opt}: ${lastErr}`);
          if (aiRes.status === 402) {
            return new Response(JSON.stringify({ error: "AI_PAYMENT_REQUIRED", message: "AI credits exhausted. Add funds or upload manually." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (aiRes.status === 429) {
            return new Response(JSON.stringify({ error: "AI_RATE_LIMITED", message: "Rate limited. Wait and retry or use Upload." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (aiRes.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
          throw new Error(lastErr);
        }
        const aiJson = await aiRes.json();
        dataUrl = aiJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!dataUrl) {
          lastErr = `No image in response`;
          console.warn(`Attempt ${attempt + 1} for option ${opt}: ${lastErr}`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (!dataUrl) throw new Error(`AI returned no image after 3 attempts. ${lastErr}`);

      const base64 = dataUrl.split(",")[1];
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const path = `${calendar_id}/${opt}-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("poll-calendar-images")
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("poll-calendar-images").getPublicUrl(path);
      updates[opt === "A" ? "ai_image_a_preview" : "ai_image_b_preview"] = pub.publicUrl;
    }

    const { error: updErr } = await supabase
      .from("poll_calendar")
      .update({ ...updates, status: "image_pending" })
      .eq("id", calendar_id);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, ...updates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-calendar-image error", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
