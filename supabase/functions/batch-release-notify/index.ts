import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Batch Release Notify — sends ONE push per batch window (morning/afternoon/evening)
 * announcing the new batch of polls. Routed through send-governed-notification so it
 * respects the 3/day cap, user prefs, quiet hours, and gets logged.
 *
 * Mapped to notification_type "new_category" (priority 7) — same bucket as other
 * poll-discovery pushes.
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Determine which batch this is based on Cairo time
    const cairoHour = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" })
    ).getHours();

    let batchLabel: string;
    let emoji: string;
    let body: string;

    if (cairoHour >= 7 && cairoHour < 11) {
      batchLabel = "morning";
      emoji = "☀️";
      body = "Your morning polls are ready! Start your day with fresh debates.";
    } else if (cairoHour >= 12 && cairoHour < 16) {
      batchLabel = "afternoon";
      emoji = "🔥";
      body = "New polls just dropped! More debates waiting for you.";
    } else {
      batchLabel = "evening";
      emoji = "🌙";
      body = "Tonight's final batch is here! Don't miss out before the day ends.";
    }

    const title = `${emoji} New Polls Available!`;

    console.log(`Batch release notification: ${batchLabel} batch at Cairo hour ${cairoHour}`);

    // Fetch all users
    const { data: users, error: usersError } = await supabase.from("users").select("id");
    if (usersError) throw usersError;

    if (!users?.length) {
      return new Response(
        JSON.stringify({ success: true, batch: batchLabel, sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send one governed notification per user (governance handles dedup/cap/prefs)
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
            notification_type: "new_category",
            priority: 7,
            title,
            body,
            url: "/home",
            data: { batch: batchLabel },
          }),
        }).then((r) => r.json())
      )
    );

    const sent = results.filter(
      (r: any) => r.status === "fulfilled" && r.value?.sent
    ).length;
    const skipped = users.length - sent;

    console.log(`Batch ${batchLabel}: ${sent} sent, ${skipped} skipped (cap/prefs/quiet)`);

    return new Response(
      JSON.stringify({ success: true, batch: batchLabel, sent, skipped, total_users: users.length }),
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
