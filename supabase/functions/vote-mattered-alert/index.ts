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

    // Get active polls with recent votes
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const { data: recentVotedPolls } = await supabase
      .from("votes")
      .select("poll_id")
      .gte("created_at", sixHoursAgo);

    if (!recentVotedPolls || recentVotedPolls.length === 0) {
      return new Response(
        JSON.stringify({ success: true, alerts: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const uniquePollIds = [...new Set(recentVotedPolls.map(v => v.poll_id))];
    const { data: currentResults } = await supabase.rpc("get_poll_results", { poll_ids: uniquePollIds });
    if (!currentResults) {
      return new Response(
        JSON.stringify({ success: true, alerts: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: polls } = await supabase
      .from("polls")
      .select("id, option_a, option_b")
      .in("id", uniquePollIds);

    const pollMap = new Map((polls || []).map(p => [p.id, p]));
    let totalAlerts = 0;

    for (const result of currentResults) {
      if (result.total_votes < 15) continue;

      const poll = pollMap.get(result.poll_id);
      if (!poll) continue;

      const winningChoice = result.percent_a > result.percent_b ? 'A' : 'B';
      const spread = Math.abs(result.percent_a - result.percent_b);

      // Only tight wins (within 10%)
      if (spread > 10) continue;

      // Find users who voted for the current winner when it was losing
      // Check: at the time of their vote, was their choice in the minority?
      const winnerName = winningChoice === 'A' ? poll.option_a : poll.option_b;

      // Get early voters for the winning side (voted in first 50% of votes by time)
      const { data: allVotes } = await supabase
        .from("votes")
        .select("user_id, choice, created_at")
        .eq("poll_id", result.poll_id)
        .order("created_at", { ascending: true });

      if (!allVotes || allVotes.length < 15) continue;

      const midpoint = Math.floor(allVotes.length / 2);
      const earlyVotes = allVotes.slice(0, midpoint);

      // Check if winning choice was minority in early votes
      const earlyWinnerCount = earlyVotes.filter(v => v.choice === winningChoice).length;
      const earlyWinnerPct = (earlyWinnerCount / earlyVotes.length) * 100;

      // Winner was minority early (<45%) but is now majority
      if (earlyWinnerPct >= 45) continue;

      // Find early voters who picked the winner when it was losing
      const heroVoters = earlyVotes
        .filter(v => v.choice === winningChoice)
        .map(v => v.user_id);

      if (heroVoters.length === 0) continue;

      // Check we haven't already notified them (check recent notifications)
      const { data: existingNotifs } = await supabase
        .from("notifications")
        .select("user_id")
        .eq("type", "vote_mattered")
        .in("user_id", heroVoters)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const alreadyNotified = new Set((existingNotifs || []).map(n => n.user_id));
      const newHeroes = heroVoters.filter(id => !alreadyNotified.has(id));

      if (newHeroes.length === 0) continue;

      totalAlerts += newHeroes.length;

      const notifications = newHeroes.map(userId => ({
        user_id: userId,
        title: "🎯 Your vote mattered!",
        body: `You backed ${winnerName} when it was losing — now it's winning! Your early vote turned the tide 💪`,
        type: "vote_mattered",
        data: { poll_id: result.poll_id },
      }));

      for (let i = 0; i < notifications.length; i += 100) {
        await supabase.from("notifications").insert(notifications.slice(i, i + 100));
      }

      // Push
      await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          title: "🎯 Your vote mattered!",
          body: `You backed ${winnerName} early — now it's winning!`,
          url: "/home",
          user_ids: newHeroes,
        }),
      });

      console.log(`Vote mattered: ${newHeroes.length} users notified for ${winnerName}`);
    }

    return new Response(
      JSON.stringify({ success: true, alerts: totalAlerts }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in vote-mattered-alert:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
