import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        "mailto:support@getversa.app",
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
      );
    }

    // Get all users who voted in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: activeUsers, error: usersError } = await supabase
      .from("users")
      .select("id, username")
      .gte("last_vote_date", sevenDaysAgo.toISOString().split("T")[0]);

    if (usersError) throw usersError;
    if (!activeUsers?.length) {
      return new Response(
        JSON.stringify({ message: "No active users", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let notified = 0;

    for (const user of activeUsers) {
      // Get this week's votes
      const { data: weekVotes } = await supabase
        .from("votes")
        .select("id, poll_id, choice, created_at, category")
        .eq("user_id", user.id)
        .gte("created_at", sevenDaysAgo.toISOString());

      if (!weekVotes?.length) continue;

      const totalWeekVotes = weekVotes.length;

      // Get poll results for majority/minority calculation
      const pollIds = weekVotes.map((v: any) => v.poll_id);
      const { data: results } = await supabase.rpc("get_poll_results", {
        poll_ids: pollIds,
      });

      let majorityCount = 0;
      let minorityCount = 0;
      const resultsMap = new Map(
        (results || []).map((r: any) => [r.poll_id, r])
      );

      for (const vote of weekVotes) {
        const r = resultsMap.get(vote.poll_id) as any;
        if (!r || r.total_votes < 3) continue;
        const userPct =
          vote.choice === "A" ? r.percent_a : r.percent_b;
        if (userPct > 50) majorityCount++;
        else if (userPct < 50) minorityCount++;
      }

      const total = majorityCount + minorityCount;
      const majorityPct =
        total > 0 ? Math.round((majorityCount / total) * 100) : 50;

      // Get voting traits for brand loyalty
      const { data: traits } = await supabase.rpc(
        "get_user_voting_traits",
        { p_user_id: user.id }
      );

      const topTrait = traits?.[0]?.tag || null;
      const brandTrait = (traits || []).find(
        (t: any) => t.tag === "brand_oriented"
      );
      const totalTraitVotes = (traits || []).reduce(
        (sum: number, t: any) => sum + (t.vote_count || 0),
        0
      );
      const brandLoyaltyScore =
        totalTraitVotes > 0 && brandTrait
          ? Math.round(((brandTrait as any).vote_count / totalTraitVotes) * 100)
          : 0;

      // Calculate adventure score (minority votes = more adventurous)
      const adventureScore = total > 0
        ? Math.round((minorityCount / total) * 100)
        : 0;

      // Save taste snapshot
      await supabase.from("taste_snapshots").upsert(
        {
          user_id: user.id,
          snapshot_date: new Date().toISOString().split("T")[0],
          majority_pct: majorityPct,
          minority_pct: 100 - majorityPct,
          top_trait: topTrait,
          archetype: topTrait,
          adventure_score: adventureScore,
          brand_loyalty_score: brandLoyaltyScore,
          total_votes: totalWeekVotes,
        },
        { onConflict: "user_id,snapshot_date" }
      );

      // Build personalized message
      const loyaltyText =
        brandLoyaltyScore > 50
          ? `${brandLoyaltyScore}% brand-loyal`
          : `${100 - brandLoyaltyScore}% value-focused`;
      const adventureText = `more adventurous than ${adventureScore}%`;

      const body = `This week you were ${loyaltyText}, ${adventureText} of voters. ${totalWeekVotes} votes cast!`;

      // Insert in-app notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "📊 Your Weekly Taste Report",
        body,
        type: "weekly_taste",
        data: { route: "/taste-profile", majority_pct: majorityPct, adventure_score: adventureScore },
      });

      // Send push if VAPID configured
      if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", user.id);

        if (subs?.length) {
          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                JSON.stringify({
                  title: "📊 Your Weekly Taste Report",
                  body,
                  url: "/taste-profile",
                })
              );
            } catch (err: any) {
              if (err.statusCode === 404 || err.statusCode === 410) {
                await supabase
                  .from("push_subscriptions")
                  .delete()
                  .eq("endpoint", sub.endpoint);
              }
            }
          }
        }
      }

      notified++;
    }

    return new Response(
      JSON.stringify({
        message: `Weekly taste report sent to ${notified} users`,
        count: notified,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
