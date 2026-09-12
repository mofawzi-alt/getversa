// Admin-triggered backfill: translates existing polls into Egyptian Arabic in batches.
// POST { userId, limit? } — processes polls where question_ar is null, oldest first.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function translateBatch(apiKey: string, polls: any[]): Promise<Record<string, any>> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            'You translate polls into natural spoken Egyptian Arabic (not formal fusha). Keep brand and celebrity names as-is. Keep the tone and energy. Reply with VALID JSON only: an array where each item is {"id": "<same id>", "question_ar": "...", "option_a_ar": "...", "option_b_ar": "...", "subtitle_ar": "..."}. subtitle_ar must be a short catchy Egyptian Arabic hook (translate the subtitle if given, otherwise invent a short hook). No extra text.',
        },
        {
          role: "user",
          content: JSON.stringify(
            polls.map((p) => ({ id: p.id, question: p.question, option_a: p.option_a, option_b: p.option_b, subtitle: p.subtitle || "" }))
          ),
        },
      ],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`AI gateway error: ${res.status}`);
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content || "";
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array in AI response");
  const parsed = JSON.parse(match[0]);
  const out: Record<string, any> = {};
  for (const item of parsed) {
    if (item?.id && item.question_ar && item.option_a_ar && item.option_b_ar) {
      out[item.id] = {
        question_ar: String(item.question_ar).trim(),
        option_a_ar: String(item.option_a_ar).trim(),
        option_b_ar: String(item.option_b_ar).trim(),
        subtitle_ar: item.subtitle_ar ? String(item.subtitle_ar).trim() : null,
      };
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const userId = body?.userId;
    const limit = Math.min(Math.max(Number(body?.limit) || 10, 1), 25);
    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: adminRole, error: roleErr } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").single();
    if (roleErr || !adminRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { data: polls, error } = await supabase
      .from("polls")
      .select("id, question, option_a, option_b, subtitle")
      .is("question_ar", null)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;

    if (!polls?.length) {
      return new Response(JSON.stringify({ ok: true, translated: 0, remaining: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const translated = await translateBatch(apiKey, polls);
    let done = 0;
    for (const [id, patch] of Object.entries(translated)) {
      const { error: upErr } = await supabase.from("polls").update(patch).eq("id", id);
      if (!upErr) done++;
    }

    const { count: remaining } = await supabase
      .from("polls")
      .select("id", { count: "exact", head: true })
      .is("question_ar", null);

    return new Response(JSON.stringify({ ok: true, translated: done, remaining: remaining ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("translate-polls error", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
