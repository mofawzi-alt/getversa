import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Personalized Poll Push — notifies users about new polls matching their category interests.
 * Cron: every 4 hours. Checks polls created in last 4h and matches against user category_interests.
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

    // Get polls created in the last 4 hours
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: recentPolls } = await supabase
      .from("polls")
      .select("id, question, category")
      .eq("is_active", true)
      .gte("created_at", fourHoursAgo)
      .not("category", "is", null);

    if (!recentPolls || recentPolls.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No new categorized polls" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get unique categories from recent polls
    const categories = [...new Set(recentPolls.map(p => p.category?.toLowerCase()).filter(Boolean))];

    // Get users with matching category interests who haven't voted on these polls
    const { data: users } = await supabase
      .from("users")
      .select("id, username, category_interests")
      .not("category_interests", "is", null);

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Match users to polls by category interest
    const userMatches: { userId: string; poll: typeof recentPolls[0] }[] = [];

    for (const user of users) {
      const interests = (user.category_interests || []).map((c: string) => c.toLowerCase());
      const matchingPoll = recentPolls.find(p => 
        interests.includes(p.category?.toLowerCase() || "")
      );
      if (matchingPoll) {
        userMatches.push({ userId: user.id, poll: matchingPoll });
      }
    }

    if (userMatches.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No matching users" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const matchedUserIds = userMatches.map(m => m.userId);
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", matchedUserIds);

    let sent = 0;
    const expiredEndpoints: string[] = [];

    if (subscriptions && subscriptions.length > 0) {
      await Promise.allSettled(
        subscriptions.map(async (sub) => {
          const match = userMatches.find(m => m.userId === sub.user_id);
          if (!match) return;

          const pushPayload = JSON.stringify({
            title: `🎯 A poll you'd love just dropped!`,
            body: match.poll.question.substring(0, 60),
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
    const notifRecords = userMatches.map(m => ({
      user_id: m.userId,
      title: "🎯 A poll you'd love!",
      body: m.poll.question.substring(0, 60),
      type: "personalized_poll",
      data: { poll_id: m.poll.id, url: "/home" },
    }));
    await supabase.from("notifications").insert(notifRecords);

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    console.log(`Personalized poll push: ${sent} sent, ${userMatches.length} matched`);

    return new Response(
      JSON.stringify({ success: true, sent, matched: userMatches.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in personalized-poll-push:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
