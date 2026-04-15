import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Streak Rescue Push — fires at 8 PM Cairo.
 * Targets users who:
 *  1. Have a streak >= 3 days
 *  2. Haven't voted today yet
 * Sends an urgent "Your streak is about to break!" push.
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    webpush.setVapidDetails("mailto:support@getversa.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const today = new Date().toISOString().split("T")[0];

    // Users with streak >= 3 who haven't voted today
    const { data: atRiskUsers, error } = await supabase
      .from("users")
      .select("id, username, current_streak")
      .gte("current_streak", 3)
      .neq("last_vote_date", today);

    if (error) throw error;

    if (!atRiskUsers || atRiskUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No at-risk streaks" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userIds = atRiskUsers.map((u) => u.id);

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    if (subscriptions && subscriptions.length > 0) {
      await Promise.allSettled(
        subscriptions.map(async (sub) => {
          const user = atRiskUsers.find((u) => u.id === sub.user_id);
          const streak = user?.current_streak || 0;

          const pushPayload = JSON.stringify({
            title: `🚨 Your ${streak}-day streak is about to break!`,
            body: "Vote now before midnight to keep it alive",
            url: "/home",
          });

          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              pushPayload
            );
            sent++;
          } catch (err: any) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              expiredEndpoints.push(sub.endpoint);
            }
            failed++;
          }
        })
      );
    }

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    // In-app notifications
    const notifRecords = atRiskUsers.map((u) => ({
      user_id: u.id,
      title: `🚨 Your ${u.current_streak}-day streak is about to break!`,
      body: "Vote now before midnight to keep it alive",
      type: "streak_rescue",
      data: { url: "/home" },
    }));

    await supabase.from("notifications").insert(notifRecords);

    console.log(`Streak rescue: ${sent} push sent, ${failed} failed, ${atRiskUsers.length} at-risk users`);

    return new Response(
      JSON.stringify({ success: true, push_sent: sent, push_failed: failed, at_risk_users: atRiskUsers.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in streak-rescue-push:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
