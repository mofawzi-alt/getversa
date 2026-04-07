import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Get users who haven't voted today
    const { data: allUsers, error: usersError } = await supabase
      .from("users")
      .select("id, username, last_vote_date, current_streak");

    if (usersError) throw usersError;

    const usersToRemind = (allUsers || []).filter((u) => u.last_vote_date !== today);

    if (usersToRemind.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "All users voted today!" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userIds = usersToRemind.map((u) => u.id);

    // Get push subscriptions for these users
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    // Send real push notifications
    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    if (subscriptions && subscriptions.length > 0) {
      await Promise.allSettled(
        subscriptions.map(async (sub) => {
          const user = usersToRemind.find((u) => u.id === sub.user_id);
          const streakText = user?.current_streak && user.current_streak > 0
            ? ` — ${user.current_streak} day streak!`
            : "";

          const pushPayload = JSON.stringify({
            title: "Your streak is waiting 🔥",
            body: `New battles today on Versa${streakText}`,
            url: "/swipe",
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

    // Clean expired
    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    // Store in-app notifications
    const notifRecords = usersToRemind.map((u) => ({
      user_id: u.id,
      title: "Your streak is waiting 🔥",
      body: `New battles today on Versa${u.current_streak && u.current_streak > 0 ? ` — ${u.current_streak} day streak!` : ""}`,
      type: "streak_reminder",
      data: { url: "/swipe" },
    }));

    await supabase.from("notifications").insert(notifRecords);

    console.log(`Streak reminder: ${sent} push sent, ${failed} failed, ${userIds.length} in-app`);

    return new Response(
      JSON.stringify({ success: true, push_sent: sent, push_failed: failed, in_app: userIds.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in daily-streak-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
