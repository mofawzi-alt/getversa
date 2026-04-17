import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Social Proof Nudge — Phase 2: routes through governance layer.
 * Maps to notification_type "friend_activity" (priority 4).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const today = new Date().toISOString().split("T")[0];
    const { data: inactiveUsers } = await supabase
      .from("users").select("id, last_vote_date")
      .or(`last_vote_date.lt.${today},last_vote_date.is.null`);

    const { data: activeUsers } = await supabase.from("users").select("id").eq("last_vote_date", today);
    const activeIds = new Set((activeUsers ?? []).map((u) => u.id));
    if (!activeIds.size || !inactiveUsers?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const targets: { userId: string; friendCount: number }[] = [];
    for (const user of inactiveUsers) {
      const { data: friendships } = await supabase
        .from("friendships").select("requester_id, recipient_id").eq("status", "accepted")
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);
      if (!friendships?.length) continue;
      const friendIds = friendships.map((f) =>
        f.requester_id === user.id ? f.recipient_id : f.requester_id
      );
      const cnt = friendIds.filter((id) => activeIds.has(id)).length;
      if (cnt > 0) targets.push({ userId: user.id, friendCount: cnt });
    }

    const results = await Promise.allSettled(
      targets.map((t) => {
        const word = t.friendCount === 1 ? "friend" : "friends";
        return fetch(`${SUPABASE_URL}/functions/v1/send-governed-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_id: t.userId,
            notification_type: "friend_activity",
            priority: 4,
            title: `👥 ${t.friendCount} ${word} voted today!`,
            body: "Don't miss out — jump in and see if you agree",
            url: "/home",
            data: { friend_count: t.friendCount },
          }),
        }).then((r) => r.json());
      })
    );

    const sent = results.filter((r: any) => r.status === "fulfilled" && r.value?.sent).length;
    return new Response(JSON.stringify({ success: true, sent, nudged: targets.length }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("social-proof-nudge error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
