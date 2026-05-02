// Generates an AI image preview for a poll calendar entry option (A or B).
// Returns a public URL stored in the poll-calendar-images bucket.
// Admin must approve the preview by copying it into image_a_url / image_b_url.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const EGYPT_KEYWORDS = [
  "كشري", "شاورما", "فول", "طعمية", "كباب", "مشويات",
  "sahel", "gouna", "cairo", "alexandria", "zamalek", "maadi", "new cairo", "ain sokhna", "hurghada",
  "vodafone", "orange", "etisalat", "talabat", "elmenus", "noon", "carrefour", "juhayna", "edita",
  "ramadan", "رمضان", "eid", "عيد",
];

function detectEgyptContext(text: string): boolean {
  if (!text) return false;
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(text)) return true;
  const lower = text.toLowerCase();
  return EGYPT_KEYWORDS.some((kw) => lower.includes(kw));
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
      .select("id,question,option_a,option_b,category,cultural_context,target_country,target_age_range,target_gender")
      .eq("id", calendar_id)
      .single();
    if (fetchErr || !row) throw fetchErr || new Error("not found");

    const resolvedContext: string = (row.cultural_context && row.cultural_context.trim()) || "";
    const resolvedCountry: string = (row.target_country || "").trim();

    const targets: ("A" | "B")[] = option === "both" ? ["A", "B"] : [option as "A" | "B"];
    const updates: Record<string, string> = {};

    const COUNTRY_DIRECTIVES: Record<string, string> = {
      egypt: "Contemporary Egyptian setting. Egyptian faces, authentic Cairo or Egyptian urban atmosphere. Arabic signage where natural.",
      uae: "Contemporary Gulf setting. Cosmopolitan MENA atmosphere, modern Gulf urban environment.",
      "united arab emirates": "Contemporary Gulf setting. Cosmopolitan MENA atmosphere, modern Gulf urban environment.",
      "saudi arabia": "Contemporary Saudi setting. Modern Riyadh or Jeddah urban atmosphere.",
      ksa: "Contemporary Saudi setting. Modern Riyadh or Jeddah urban atmosphere.",
      mena: "Contemporary Middle East and North Africa. Arab faces, modern MENA urban environment.",
    };
    const countryDirective = COUNTRY_DIRECTIVES[resolvedCountry.toLowerCase()] || COUNTRY_DIRECTIVES.mena;

    // Build demographic directive for lifestyle accuracy
    const ageRange = (row.target_age_range || "").trim();
    const gender = (row.target_gender || "").trim();
    let demographicDirective = "";
    if (ageRange || gender) {
      const ageParts: string[] = [];
      if (gender && gender !== "All") ageParts.push(gender === "male" ? "a young man" : gender === "female" ? "a young woman" : "a young person");
      else ageParts.push("a young person");
      
      if (ageRange && ageRange !== "All") {
        const AGE_LIFESTYLE: Record<string, string> = {
          "13-17": "teenager, school-age, casual youthful style",
          "18-24": "university student or early career, trendy Gen Z style, modern apartment or campus setting",
          "25-34": "young professional, polished style, modern apartment or upscale café, higher standard of living",
          "35-44": "established professional, premium lifestyle, well-furnished home or upscale environment",
          "45-54": "mature professional, affluent setting, luxury or classic style",
          "55+": "senior, distinguished style, comfortable upscale home",
        };
        const lifestyleHint = AGE_LIFESTYLE[ageRange] || "";
        ageParts.push(`aged ${ageRange}`);
        if (lifestyleHint) ageParts.push(lifestyleHint);
      }
      demographicDirective = ` The subject should be ${ageParts.join(", ")}. The setting, clothing, and environment must reflect their demographic — modern, aspirational, and realistic for someone in this age/lifestyle bracket.`;
    }

    // Infer logical setting from question context
    const SETTING_HINTS: Array<{ keywords: string[]; hint: string }> = [
      { keywords: ["online", "e-commerce", "order", "delivery", "return", "website", "app"], hint: "Indoor/home setting — this activity happens at home or in a modern apartment, NOT on the street or in a market." },
      { keywords: ["invest", "stock", "fund", "savings", "bank", "fintech", "wallet"], hint: "Show interaction with a phone/laptop screen showing financial data — indoor modern setting." },
      { keywords: ["gym", "workout", "exercise", "fitness", "sport"], hint: "Gym, sports facility, or outdoor exercise setting." },
      { keywords: ["cook", "kitchen", "recipe", "homemade", "meal prep"], hint: "Modern home kitchen setting." },
      { keywords: ["café", "coffee", "restaurant", "dining", "eat out"], hint: "Upscale café or restaurant setting." },
      { keywords: ["drive", "car", "commute", "transport"], hint: "In or near a vehicle, road setting." },
      { keywords: ["study", "university", "exam", "college", "school"], hint: "Campus, library, or study space setting." },
    ];
    const questionLower = `${row.question} ${row.option_a} ${row.option_b}`.toLowerCase();
    const settingHint = SETTING_HINTS.find(s => s.keywords.some(k => questionLower.includes(k)))?.hint || "";
    const settingLine = settingHint ? ` SETTING RULE: ${settingHint}` : "";

    for (const opt of targets) {
      const optionText = opt === "A" ? row.option_a : row.option_b;
      const combined = `${row.question || ""} ${optionText} ${row.category || ""}`;
      const keywordBoost = detectEgyptContext(combined)
        ? " Local cue detected: ensure Egyptian / Arabic signage and local Egyptian atmosphere are clearly present."
        : "";
      const contextLine = resolvedContext ? ` Cultural context: ${resolvedContext}.` : "";
      const prompt = `Generate an image (do not reply with text). Cinematic lifestyle photograph, DSLR quality, candid, magazine-grade. Real people in real environments. NO logos, brands, text, UI elements, posters, graphics, illustrations, icons, abstract symbols, or graphic design elements of any kind.

Poll question: "${row.question}". This person's answer: "${optionText}". Category: ${row.category || "lifestyle"}.${contextLine}

Show a person performing the EXACT real-life behavior implied by answering "${optionText}" to the question "${row.question}". The behavior must be obvious in under 1 second — this is the user's "this is me" moment. Think logically about WHERE this activity happens in real life and show THAT setting. For example: returning an online order = at home packing a box with a shipping label; investing = checking a trading app on phone in a modern apartment; cooking = in a kitchen. NEVER show street/market scenes for activities that happen indoors.${demographicDirective}${settingLine}

If the option is a brand name, translate it into a real-life usage scene — NEVER show the logo. If the subject is an abstract concept (Yes, No, Quality, Trust, etc.), show a lifestyle scene that embodies that feeling through visible action.

${countryDirective}${keywordBoost} Never default to Western, American, or European settings.`;

      // Try pro image model first, fallback to flash image on failure
      const models = ["google/gemini-3-pro-image-preview", "google/gemini-3.1-flash-image-preview", "google/gemini-2.5-flash-image"];
      let dataUrl: string | undefined;
      let lastErr = "";
      for (let attempt = 0; attempt < 3 && !dataUrl; attempt++) {
        const model = models[Math.min(attempt, models.length - 1)];
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
        });
        if (!aiRes.ok) {
          const t = await aiRes.text();
          lastErr = `AI gen ${aiRes.status}: ${t.slice(0, 200)}`;
          console.warn(`Attempt ${attempt + 1} failed for option ${opt}: ${lastErr}`);
          if (aiRes.status === 402) {
            return new Response(JSON.stringify({
              error: "AI_PAYMENT_REQUIRED",
              message: "Lovable AI is out of credits. Add funds in Settings → Workspace → Usage, or use the Upload button to add an image manually.",
            }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (aiRes.status === 429) {
            return new Response(JSON.stringify({
              error: "AI_RATE_LIMITED",
              message: "AI image service is rate limited. Please wait a moment and try again, or use Upload.",
            }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (aiRes.status >= 500) {
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
            continue;
          }
          throw new Error(lastErr);
        }
        const aiJson = await aiRes.json();
        dataUrl = aiJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!dataUrl) {
          lastErr = `No image in response (text: ${(aiJson?.choices?.[0]?.message?.content || "").slice(0, 120)})`;
          console.warn(`Attempt ${attempt + 1} for option ${opt}: ${lastErr}`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (!dataUrl) throw new Error(`AI returned no image after 3 attempts. ${lastErr}`);

      // data:image/png;base64,xxx -> Uint8Array
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

    // Set status to image_pending for admin review
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
