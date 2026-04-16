import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Weekly Recap Push — sends a personalized weekly summary push every Sunday at 6 PM Cairo.
 * Includes: total votes this week, streak status, majority %.
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

    // Get votes from the past 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: weekVotes } = await supabase
      .from("votes")
      .select("user_id, poll_id, choice")
      .gte("created_at", weekAgo);

    if (!weekVotes || weekVotes.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Aggregate per user
    const userStats = new Map<string, { voteCount: number }>();
    for (const vote of weekVotes) {
      const stats = userStats.get(vote.user_id) || { voteCount: 0 };
      stats.voteCount++;
      userStats.set(vote.user_id, stats);
    }

    const userIds = [...userStats.keys()];

    // Get user details
    const { data: users } = await supabase
      .from("users")
      .select("id, username, current_streak")
      .in("id", userIds);

    // Get push subscriptions
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    let sent = 0;
    const expiredEndpoints: string[] = [];

    if (subscriptions && subscriptions.length > 0) {
      await Promise.allSettled(
        subscriptions.map(async (sub) => {
          const stats = userStats.get(sub.user_id);
          const user = users?.find(u => u.id === sub.user_id);
          if (!stats) return;

          const streakPart = user?.current_streak && user.current_streak > 0
            ? ` 🔥 ${user.current_streak}-day streak!`
            : "";
          
          const pushPayload = JSON.stringify({
            title: "📊 Your Weekly Recap",
            body: `You voted ${stats.voteCount} times this week!${streakPart} Keep it up 💪`,
            url: "/profile",
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
          }
        })
      );
    }

    // Store in-app notifications
    const notifRecords = userIds.map(userId => {
      const stats = userStats.get(userId)!;
      const user = users?.find(u => u.id === userId);
      const streakPart = user?.current_streak && user.current_streak > 0
        ? ` 🔥 ${user.current_streak}-day streak!`
        : "";
      return {
        user_id: userId,
        title: "📊 Your Weekly Recap",
        body: `You voted ${stats.voteCount} times this week!${streakPart}`,
        type: "weekly_recap",
        data: { url: "/profile", vote_count: stats.voteCount },
      };
    });
    await supabase.from("notifications").insert(notifRecords);

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    console.log(`Weekly recap: ${sent} push sent, ${userIds.length} in-app`);

    return new Response(
      JSON.stringify({ success: true, sent, users_notified: userIds.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in weekly-recap-push:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
