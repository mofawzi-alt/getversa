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
      { keywords: ["sahel", "beach", "coast", "sea", "swim", "resort"], hint: "OUTDOOR beach/resort/coastal setting — turquoise water, sand, summer vibes. NOT indoors." },
      { keywords: ["ride", "uber", "careem", "taxi", "commute", "transport", "traffic"], hint: "In or near a vehicle on a busy city road. Show actual transportation scene." },
      { keywords: ["street food", "koshary", "falafel", "shawarma", "food cart", "food stall"], hint: "At a vibrant street food stall or cart, eating while standing. Outdoor." },
      { keywords: ["online", "e-commerce", "order", "delivery", "return", "website"], hint: "At home on couch — opening a package or browsing phone. NOT at a desk." },
      { keywords: ["invest", "stock", "fund", "savings", "bank", "fintech", "wallet"], hint: "Show interaction with a phone screen — indoor modern setting." },
      { keywords: ["gym", "workout", "exercise", "fitness", "sport"], hint: "Gym, sports facility, or outdoor exercise setting." },
      { keywords: ["cook", "kitchen", "recipe", "homemade", "meal prep"], hint: "Modern home kitchen setting." },
      { keywords: ["café", "coffee", "restaurant", "dining", "eat out", "fine dining"], hint: "Upscale café or restaurant setting." },
      { keywords: ["drive", "car"], hint: "In or near a vehicle, road setting." },
      { keywords: ["study", "university", "exam", "college", "school"], hint: "Campus, library, or study space setting." },
      { keywords: ["travel", "fly", "airport", "vacation", "trip"], hint: "Airport, airplane, or travel destination setting. Show travel energy." },
      { keywords: ["shop", "mall", "buy", "brand", "luxury"], hint: "Inside a modern mall or boutique, browsing or holding shopping bags." },
      { keywords: ["concert", "music", "festival", "party"], hint: "Live music venue, festival crowd, or party setting with energy and lights." },
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
      const prompt = `Generate an image (do not reply with text). Cinematic lifestyle photograph for a Gen Z polling app. DSLR quality, shallow depth-of-field, warm natural lighting, editorial-grade color grading. Real people in REAL environments. Absolutely NO logos, brand names, text overlays, UI elements, illustrations, icons, abstract art, or graphic design.

CRITICAL RULES — READ CAREFULLY:
1. The image MUST directly depict the SPECIFIC TOPIC of this poll. If the poll is about Sahel, show a BEACH/RESORT. If about ride-hailing, show someone IN A CAR or hailing a ride on a busy street. If about coffee, show ACTUAL COFFEE. NEVER default to "person sitting at desk with phone" — that is WRONG for 90% of topics.
2. The subject must be a real, attractive, stylish Gen Z person (18-25 years old) with contemporary fashion. NEVER show middle-aged or older people unless the poll specifically targets them.
3. The person must be ACTIVELY DOING the thing the option describes — not just sitting somewhere.

Poll: "${row.question}"
This person chose: "${optionText}"
Category: ${row.category || "lifestyle"}${contextLine}

Show this person LIVING their answer to "${optionText}". The scene must make the viewer instantly think "${optionText}" within 1 second. Examples of CORRECT interpretation:
- "Going to Sahel" → young person at a beautiful beach resort, turquoise water, summer vibes
- "Peak hours ride-hailing" → young person in the back seat of a car in Cairo traffic
- "Street food" → young person eating koshary/falafel at a street stall
- "Save money" → NOT a person at a desk — instead show putting cash in a jar, or walking past shops without buying
- "Online shopping" → person on couch excitedly opening a delivery box, NOT at a desk

${countryDirective}${demographicDirective}${settingLine}${keywordBoost}

FINAL CHECK: Does this image SCREAM "${optionText}"? If someone saw only the image with no text, would they guess the topic? If not, rethink the scene. Never default to Western settings.`;

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
