import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Friend Activity Digest — sends ONE daily push per user summarizing
 * what their friends voted on in the last 24 hours.
 * Replaces per-vote push spam. Triggered by pg_cron daily at 7 PM Cairo.
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

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Pull all accepted friendships
    const { data: friendships, error: fErr } = await supabase
      .from("friendships")
      .select("requester_id, recipient_id")
      .eq("status", "accepted");
    if (fErr) throw fErr;

    // Build adjacency: userId -> Set of friendIds
    const friendsOf = new Map<string, Set<string>>();
    (friendships || []).forEach((f) => {
      if (!friendsOf.has(f.requester_id)) friendsOf.set(f.requester_id, new Set());
      if (!friendsOf.has(f.recipient_id)) friendsOf.set(f.recipient_id, new Set());
      friendsOf.get(f.requester_id)!.add(f.recipient_id);
      friendsOf.get(f.recipient_id)!.add(f.requester_id);
    });

    // Collect all users who have any friend
    const usersWithFriends = Array.from(friendsOf.keys());
    if (usersWithFriends.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "no friendships" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2. Fetch all votes in last 24h by anyone who is in someone's friend list
    const allFriendIds = Array.from(new Set(usersWithFriends));
    const { data: recentVotes, error: vErr } = await supabase
      .from("votes")
      .select("user_id, poll_id, created_at")
      .gte("created_at", since)
      .in("user_id", allFriendIds);
    if (vErr) throw vErr;

    // 3. Pull usernames for voters
    const voterIds = Array.from(new Set((recentVotes || []).map((v) => v.user_id)));
    const usernameMap = new Map<string, string>();
    if (voterIds.length > 0) {
      const { data: profiles } = await supabase
        .from("users")
        .select("id, username")
        .in("id", voterIds);
      (profiles || []).forEach((p: any) => usernameMap.set(p.id, p.username || "A friend"));
    }

    // Index votes by voter
    const votesByVoter = new Map<string, Set<string>>();
    (recentVotes || []).forEach((v) => {
      if (!votesByVoter.has(v.user_id)) votesByVoter.set(v.user_id, new Set());
      votesByVoter.get(v.user_id)!.add(v.poll_id);
    });

    // 4. For each user, build their digest from their friends' activity
    const digestRecipients: { userId: string; title: string; body: string }[] = [];

    for (const userId of usersWithFriends) {
      const myFriends = friendsOf.get(userId)!;
      const activeFriendNames: string[] = [];
      const polls = new Set<string>();

      myFriends.forEach((friendId) => {
        const fVotes = votesByVoter.get(friendId);
        if (fVotes && fVotes.size > 0) {
          activeFriendNames.push(usernameMap.get(friendId) || "A friend");
          fVotes.forEach((p) => polls.add(p));
        }
      });

      if (activeFriendNames.length === 0 || polls.size === 0) continue;

      // Compose copy
      const friendCount = activeFriendNames.length;
      const pollCount = polls.size;
      const previewNames =
        friendCount === 1
          ? activeFriendNames[0]
          : friendCount === 2
          ? `${activeFriendNames[0]} & ${activeFriendNames[1]}`
          : `${activeFriendNames[0]}, ${activeFriendNames[1]} & ${friendCount - 2} more`;

      const title = `👀 Your crew was busy today`;
      const body = `${previewNames} voted on ${pollCount} poll${pollCount === 1 ? "" : "s"} — see what they picked.`;

      digestRecipients.push({ userId, title, body });
    }

    if (digestRecipients.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "no activity" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 5. Insert in-app notifications (single batch)
    const inAppRows = digestRecipients.map((r) => ({
      user_id: r.userId,
      title: r.title,
      body: r.body,
      type: "friend_digest",
      data: { url: "/friends" },
    }));
    await supabase.from("notifications").insert(inAppRows);

    // 6. Send pushes
    const recipientIds = digestRecipients.map((r) => r.userId);
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", recipientIds);

    const subsByUser = new Map<string, any[]>();
    (subscriptions || []).forEach((s) => {
      if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
      subsByUser.get(s.user_id)!.push(s);
    });

    let sent = 0;
    const expiredEndpoints: string[] = [];

    await Promise.allSettled(
      digestRecipients.flatMap((r) => {
        const subs = subsByUser.get(r.userId) || [];
        return subs.map(async (sub) => {
          const payload = JSON.stringify({
            title: r.title,
            body: r.body,
            url: "/friends",
          });
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            sent++;
          } catch (err: any) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              expiredEndpoints.push(sub.endpoint);
            }
          }
        });
      })
    );

    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }

    console.log(`Friend digest: ${digestRecipients.length} users, ${sent} pushes sent`);

    return new Response(
      JSON.stringify({ success: true, recipients: digestRecipients.length, sent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in friend-activity-digest:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
