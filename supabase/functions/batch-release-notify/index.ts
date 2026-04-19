import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Daily Poll Batch Notify — sends ONE governed push per user per day at 7am Cairo
 * announcing the day's fresh polls. Replaces the per-poll blast trigger and the
 * 3-batch (morning/afternoon/evening) schedule.
 *
 * notification_type: "daily_poll_batch" (priority 3 — high enough to land but
 * still respects the 3/day cap, user prefs, and quiet hours).
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Count fresh polls (last 24h) so the copy can be a little dynamic
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: freshCount } = await supabase
      .from("polls")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .eq("is_active", true);

    const polls = freshCount ?? 0;
    const title = "☀️ New polls are live";
    const body =
      polls > 0
        ? `${polls} fresh debate${polls === 1 ? "" : "s"} waiting for you. Start your morning vote.`
        : "Your daily polls are ready. Tap in and shape today's results.";

    console.log(`Daily poll batch notify — ${polls} fresh polls`);

    // Fetch all users
    const { data: users, error: usersError } = await supabase.from("users").select("id");
    if (usersError) throw usersError;

    if (!users?.length) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, total_users: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // One governed notification per user — governance enforces 1/day naturally because
    // the type is unique to this morning send and quiet hours / cap apply.
    const results = await Promise.allSettled(
      users.map((u) =>
        fetch(`${SUPABASE_URL}/functions/v1/send-governed-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_id: u.id,
            notification_type: "daily_poll_batch",
            priority: 3,
            title,
            body,
            url: "/home",
            data: { fresh_count: polls },
          }),
        }).then((r) => r.json())
      )
    );

    const sent = results.filter(
      (r: any) => r.status === "fulfilled" && r.value?.sent
    ).length;
    const skipped = users.length - sent;

    console.log(`Daily poll batch: ${sent} sent, ${skipped} skipped (cap/prefs/quiet)`);

    return new Response(
      JSON.stringify({ success: true, sent, skipped, total_users: users.length, fresh_polls: polls }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in batch-release-notify:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
