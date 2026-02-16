import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Track previous leaders to detect flips
// In production, this would be stored in a DB table
const SHIFT_CACHE_KEY = "poll_leaders";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all active polls
    const { data: activePolls, error: pollError } = await supabase
      .from("polls")
      .select("id, question, option_a, option_b, is_active")
      .eq("is_active", true)
      .limit(50);

    if (pollError) throw pollError;
    if (!activePolls || activePolls.length === 0) {
      return new Response(
        JSON.stringify({ success: true, shifts: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const pollIds = activePolls.map(p => p.id);

    // Get current results
    const { data: results, error: resultError } = await supabase
      .rpc("get_poll_results", { poll_ids: pollIds });

    if (resultError) throw resultError;

    // Check for flips: compare current leader with stored leader
    // For simplicity, we'll check recent vote patterns
    const shifts: Array<{ pollId: string; newLeader: string; oldLeader: string; question: string }> = [];

    for (const result of (results || [])) {
      const poll = activePolls.find(p => p.id === result.poll_id);
      if (!poll || result.total_votes < 10) continue; // Need minimum votes

      const currentLeader = result.percent_a > result.percent_b ? 'A' : 'B';
      const spread = Math.abs(result.percent_a - result.percent_b);

      // Only notify on close races that just flipped (spread < 5%)
      if (spread > 5) continue;

      // Get votes from the last 30 minutes to detect recent flips
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentVotes } = await supabase
        .from("votes")
        .select("choice")
        .eq("poll_id", result.poll_id)
        .gte("created_at", thirtyMinAgo);

      if (!recentVotes || recentVotes.length < 3) continue;

      // Check if recent votes caused a shift
      const recentA = recentVotes.filter(v => v.choice === 'A').length;
      const recentB = recentVotes.filter(v => v.choice === 'B').length;
      const recentLeader = recentA > recentB ? 'A' : 'B';

      // If recent trend opposes current leader → likely a flip just happened
      if (recentLeader !== currentLeader || spread <= 2) {
        const newLeaderName = currentLeader === 'A' ? poll.option_a : poll.option_b;
        const oldLeaderName = currentLeader === 'A' ? poll.option_b : poll.option_a;

        shifts.push({
          pollId: result.poll_id,
          newLeader: newLeaderName,
          oldLeader: oldLeaderName,
          question: poll.question,
        });
      }
    }

    // Send push notifications for each shift
    for (const shift of shifts) {
      // Get users who voted on this poll
      const { data: voters } = await supabase
        .from("votes")
        .select("user_id")
        .eq("poll_id", shift.pollId);

      if (!voters || voters.length === 0) continue;

      const userIds = [...new Set(voters.map(v => v.user_id))];

      // Store notifications
      const notifications = userIds.map(userId => ({
        user_id: userId,
        title: "🔄 Live Shift!",
        body: `${shift.newLeader} just overtook ${shift.oldLeader} 👀`,
        type: "live_shift",
        data: { poll_id: shift.pollId },
      }));

      // Insert in batches of 100
      for (let i = 0; i < notifications.length; i += 100) {
        const batch = notifications.slice(i, i + 100);
        await supabase.from("notifications").insert(batch);
      }

      console.log(`Live shift detected: ${shift.newLeader} overtook ${shift.oldLeader} — notified ${userIds.length} users`);
    }

    return new Response(
      JSON.stringify({ success: true, shifts: shifts.length, details: shifts }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error checking live shifts:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
