import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calculate the week that just ended (Sunday to Saturday)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun
    const lastSunday = new Date(now);
    lastSunday.setUTCDate(now.getUTCDate() - dayOfWeek - 7); // Previous Sunday
    lastSunday.setUTCHours(0, 0, 0, 0);

    const lastSaturday = new Date(lastSunday);
    lastSaturday.setUTCDate(lastSunday.getUTCDate() + 6);
    lastSaturday.setUTCHours(23, 59, 59, 999);

    const weekStart = lastSunday.toISOString().split('T')[0];

    // Check if we already have entries for this week
    const { data: existing } = await supabase
      .from("weekly_leaderboard")
      .select("id")
      .eq("week_start", weekStart)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Week already processed" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Count points earned during that week (votes = 5 pts each)
    const { data: weeklyVotes, error: voteError } = await supabase
      .from("votes")
      .select("user_id")
      .gte("created_at", lastSunday.toISOString())
      .lte("created_at", lastSaturday.toISOString());

    if (voteError) throw voteError;

    // Aggregate points per user
    const pointsMap = new Map<string, number>();
    for (const vote of (weeklyVotes || [])) {
      pointsMap.set(vote.user_id, (pointsMap.get(vote.user_id) || 0) + 5);
    }

    if (pointsMap.size === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No votes this week" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Sort and rank
    const sorted = Array.from(pointsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100); // Top 100

    const entries = sorted.map(([userId, points], index) => ({
      user_id: userId,
      week_start: weekStart,
      weekly_points: points,
      rank: index + 1,
    }));

    // Insert in batches
    for (let i = 0; i < entries.length; i += 50) {
      const { error } = await supabase
        .from("weekly_leaderboard")
        .insert(entries.slice(i, i + 50));
      if (error) console.error("Insert error:", error);
    }

    // Notify top 3
    for (let i = 0; i < Math.min(3, sorted.length); i++) {
      const [userId, points] = sorted[i];
      await supabase.from("notifications").insert({
        user_id: userId,
        title: `🏆 Weekly #${i + 1}!`,
        body: `You finished #${i + 1} this week with ${points} points! New week, new race 🔥`,
        type: "weekly_leaderboard",
        data: { rank: i + 1, points, week_start: weekStart },
      });
    }

    console.log(`Weekly leaderboard: ${entries.length} users ranked for week ${weekStart}`);

    return new Response(
      JSON.stringify({ success: true, ranked: entries.length, week: weekStart }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in weekly-leaderboard-reset:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
