// Finds friend pairs who disagreed on 2+ polls in the last 24h and sends
// the challenged-side user a push: "Sara disagreed with you on 3 polls — challenge her ⚔️"
// Sends at most one push per recipient per day per friend.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1) Get all accepted friendships
    const { data: friendships, error: fErr } = await supabase
      .from("friendships")
      .select("requester_id, recipient_id")
      .eq("status", "accepted");
    if (fErr) throw fErr;

    if (!friendships || friendships.length === 0) {
      return json({ success: true, pairs: 0, pushes: 0, message: "No friendships" });
    }

    // 2) Get recent votes (last 24h) for every user involved
    const userIds = Array.from(
      new Set(friendships.flatMap((f) => [f.requester_id, f.recipient_id]))
    );

    const { data: votes, error: vErr } = await supabase
      .from("votes")
      .select("user_id, poll_id, choice")
      .in("user_id", userIds)
      .gte("created_at", since);
    if (vErr) throw vErr;

    // Build lookup: user_id -> Map(poll_id -> choice)
    const userVotes = new Map<string, Map<string, string>>();
    for (const v of votes || []) {
      if (!userVotes.has(v.user_id)) userVotes.set(v.user_id, new Map());
      userVotes.get(v.user_id)!.set(v.poll_id, v.choice);
    }

    // 3) For each friendship, count disagreements on shared polls (last 24h)
    const recipientPushes = new Map<
      string,
      { friendId: string; friendName: string; disagreements: number; pollIds: string[] }
    >();

    for (const f of friendships) {
      const a = f.requester_id;
      const b = f.recipient_id;
      const va = userVotes.get(a);
      const vb = userVotes.get(b);
      if (!va || !vb) continue;

      const disagreements: string[] = [];
      for (const [pollId, choiceA] of va) {
        const choiceB = vb.get(pollId);
        if (choiceB && choiceB !== choiceA) disagreements.push(pollId);
      }

      if (disagreements.length < 2) continue;

      // Notify both sides — pick the user with fewer pushes already queued for fairness
      for (const [recipient, friendId] of [
        [a, b],
        [b, a],
      ] as const) {
        const existing = recipientPushes.get(`${recipient}:${friendId}`);
        if (existing) continue;
        recipientPushes.set(`${recipient}:${friendId}`, {
          friendId,
          friendName: "",
          disagreements: disagreements.length,
          pollIds: disagreements,
        });
      }
    }

    if (recipientPushes.size === 0) {
      return json({ success: true, pairs: 0, pushes: 0, message: "No disagreements" });
    }

    // 4) Resolve usernames
    const friendIds = Array.from(new Set(Array.from(recipientPushes.values()).map((p) => p.friendId)));
    const { data: profiles } = await supabase
      .from("users")
      .select("id, username")
      .in("id", friendIds);
    const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.username || "A friend"]));

    // 5) De-dupe: skip recipients already notified today (any friend) for this type
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const recipientIds = Array.from(new Set(Array.from(recipientPushes.keys()).map((k) => k.split(":")[0])));
    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("type", "friend_disagreement")
      .in("user_id", recipientIds)
      .gte("created_at", todayStart.toISOString());
    const alreadyNotified = new Set((existingNotifs || []).map((n: any) => n.user_id));

    let pushes = 0;
    for (const [key, info] of recipientPushes) {
      const [recipient] = key.split(":");
      if (alreadyNotified.has(recipient)) continue;
      alreadyNotified.add(recipient); // only one per recipient per day

      const friendName = nameMap.get(info.friendId) || "A friend";
      const title = `⚔️ ${friendName} disagreed with you`;
      const body = `On ${info.disagreements} polls today. Challenge them to a duel?`;
      const url = "/play/duels";

      // In-app
      await supabase.from("notifications").insert({
        user_id: recipient,
        title,
        body,
        type: "friend_disagreement",
        data: { friend_id: info.friendId, poll_ids: info.pollIds, url, tab: "duels" },
      });

      // Push (skip duplicate in-app insert)
      await supabase.functions.invoke("send-push-notification", {
        body: {
          title,
          body,
          url,
          user_ids: [recipient],
          skip_in_app: true,
        },
      });

      pushes++;
    }

    return json({ success: true, pairs: recipientPushes.size, pushes });
  } catch (error: any) {
    console.error("friend-disagreement-push error:", error);
    return json({ error: error.message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
