// Admin-only one-shot backfill for polls.entities.
// Iterates every poll, derives canonical entity keys from its text, and writes them.
// Idempotent — safe to re-run; rebuilds the column from current text every time.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractEntities } from "../_shared/entity-extractor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Admin gate
    const authHeader = req.headers.get("Authorization") || "";
    let isAdmin = false;
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: ud } = await supabase.auth.getUser(token);
      const uid = ud?.user?.id;
      if (uid) {
        const { data: hasRole } = await supabase.rpc("has_role", {
          _user_id: uid,
          _role: "admin",
        });
        isAdmin = !!hasRole;
      }
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0, updated = 0, page = 0;
    const PAGE = 500;
    while (true) {
      const { data: polls, error } = await supabase
        .from("polls")
        .select("id, question, option_a, option_b, subtitle, category")
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      if (!polls || polls.length === 0) break;

      for (const p of polls) {
        processed++;
        const text = [p.question, p.option_a, p.option_b, p.subtitle, p.category]
          .filter(Boolean)
          .join(" ");
        const entities = extractEntities(text);
        const { error: upErr } = await supabase
          .from("polls")
          .update({ entities })
          .eq("id", p.id);
        if (!upErr) updated++;
      }

      if (polls.length < PAGE) break;
      page++;
    }

    return new Response(JSON.stringify({ processed, updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("backfill-poll-entities failed", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
