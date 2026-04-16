import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Social Proof Nudge — "X friends voted today, you haven't yet!"
 * Cron: daily at 3 PM Cairo (1 PM UTC).
 * Targets users who have friends that voted today but they haven't.
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

    // Get users who haven't voted today
    const { data: inactiveUsers } = await supabase
      .from("users")
      .select("id, username, last_vote_date")
      .or(`last_vote_date.lt.${today},last_vote_date.is.null`);

    if (!inactiveUsers || inactiveUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "Everyone voted!" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get users who HAVE voted today
    const { data: activeUsers } = await supabase
      .from("users")
      .select("id")
      .eq("last_vote_date", today);

    const activeUserIds = new Set((activeUsers || []).map(u => u.id));

    if (activeUserIds.size === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No active users today" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // For each inactive user, count how many of their friends voted today
    const nudgeTargets: { userId: string; friendCount: number }[] = [];

    for (const user of inactiveUsers) {
      // Get this user's friends
      const { data: friendships } = await supabase
        .from("friendships")
        .select("requester_id, recipient_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);

      if (!friendships || friendships.length === 0) continue;

      const friendIds = friendships.map(f =>
        f.requester_id === user.id ? f.recipient_id : f.requester_id
      );

      const activeFriendCount = friendIds.filter(id => activeUserIds.has(id)).length;

      if (activeFriendCount > 0) {
        nudgeTargets.push({ userId: user.id, friendCount: activeFriendCount });
      }
    }

    if (nudgeTargets.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No social nudges needed" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const targetUserIds = nudgeTargets.map(t => t.userId);
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    let sent = 0;
    const expiredEndpoints: string[] = [];

    if (subscriptions && subscriptions.length > 0) {
      await Promise.allSettled(
        subscriptions.map(async (sub) => {
          const target = nudgeTargets.find(t => t.userId === sub.user_id);
          if (!target) return;

          const friendWord = target.friendCount === 1 ? "friend" : "friends";
          const pushPayload = JSON.stringify({
            title: `👥 ${target.friendCount} ${friendWord} voted today!`,
            body: "Don't miss out — jump in and see if you agree",
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
          }
        })
      );
    }

    // Store in-app notifications
    const notifRecords = nudgeTargets.map(t => {
      const friendWord = t.friendCount === 1 ? "friend" : "friends";
      return {
        user_id: t.userId,
        title: `👥 ${t.friendCount} ${friendWord} voted today!`,
        body: "Don't miss out — jump in and see if you agree",
        type: "social_proof_nudge",
        data: { url: "/home", friend_count: t.friendCount },
      };
    });
    await supabase.from("notifications").insert(notifRecords);

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    console.log(`Social proof nudge: ${sent} push sent, ${nudgeTargets.length} users nudged`);

    return new Response(
      JSON.stringify({ success: true, sent, nudged: nudgeTargets.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in social-proof-nudge:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
