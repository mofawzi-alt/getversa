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
      .select("id,question,option_a,option_b,category")
      .eq("id", calendar_id)
      .single();
    if (fetchErr || !row) throw fetchErr || new Error("not found");

    const targets: ("A" | "B")[] = option === "both" ? ["A", "B"] : [option as "A" | "B"];
    const updates: Record<string, string> = {};

    for (const opt of targets) {
      const optionText = opt === "A" ? row.option_a : row.option_b;
      const prompt = `Generate an image (do not reply with text). Editorial magazine-style photograph, vibrant, clean, mobile-optimized, centered composition, high quality. No text, no logos, no watermarks, no brand names. Subject: ${optionText}. Visual context: ${row.category || "lifestyle"}.`;

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
