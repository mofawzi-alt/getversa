// Bulk regenerate AI preview images for all draft/image_pending calendar entries.
// Processes in batches with delays to avoid rate limits.
// Admin-only. Call with POST { batch_size?: number, delay_ms?: number, status_filter?: string[] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Validate admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: corsHeaders });

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body ok */ }
    
    const batchSize = body.batch_size || 5;
    const delayMs = body.delay_ms || 8000; // 8s between calls to avoid rate limits
    const statusFilter = body.status_filter || ["draft", "image_pending"];

    // Get all calendar entries that need images
    const { data: entries, error: fetchErr } = await supabase
      .from("poll_calendar")
      .select("id, question, status, ai_image_a_preview, ai_image_b_preview")
      .in("status", statusFilter)
      .is("image_a_url", null) // no approved image yet
      .order("release_date", { ascending: true })
      .limit(batchSize);

    if (fetchErr) throw fetchErr;
    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No entries need regeneration", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; question: string; status: string; error?: string }> = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      console.log(`[${i + 1}/${entries.length}] Generating images for: ${entry.question.slice(0, 60)}...`);

      try {
        const genRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-calendar-image`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
          },
          body: JSON.stringify({ calendar_id: entry.id, option: "both" }),
        });

        if (!genRes.ok) {
          const errText = await genRes.text();
          console.error(`Failed for ${entry.id}: ${genRes.status} ${errText.slice(0, 200)}`);
          results.push({ id: entry.id, question: entry.question, status: "failed", error: `${genRes.status}: ${errText.slice(0, 100)}` });
          
          // If rate limited or payment required, stop the batch
          if (genRes.status === 429 || genRes.status === 402) {
            results.push({ id: "BATCH_STOPPED", question: "Stopped due to rate limit or payment issue", status: "stopped" });
            break;
          }
        } else {
          results.push({ id: entry.id, question: entry.question, status: "success" });
        }
      } catch (e: any) {
        console.error(`Error for ${entry.id}:`, e);
        results.push({ id: entry.id, question: entry.question, status: "failed", error: e?.message || String(e) });
      }

      // Delay between calls to avoid rate limits
      if (i < entries.length - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    const succeeded = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status === "failed").length;

    // Count remaining
    const { count: remaining } = await supabase
      .from("poll_calendar")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "image_pending"])
      .is("image_a_url", null);

    return new Response(JSON.stringify({
      ok: true,
      processed: entries.length,
      succeeded,
      failed,
      remaining: remaining || 0,
      results,
      message: `Processed ${entries.length} entries (${succeeded} success, ${failed} failed). ${remaining || 0} remaining — call again to continue.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("bulk-regen error", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
