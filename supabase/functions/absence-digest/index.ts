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

    // Find users who haven't voted in 48+ hours but were active before
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];
    const maxAbsence = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: absentUsers, error: userError } = await supabase
      .from("users")
      .select("id, username")
      .lt("last_vote_date", cutoff)
      .gt("last_vote_date", maxAbsence)
      .not("last_vote_date", "is", null)
      .limit(200);

    if (userError) throw userError;
    if (!absentUsers || absentUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the 3 most debated polls from the last 48h (closest to 50/50)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: recentPolls } = await supabase
      .from("polls")
      .select("id, question, option_a, option_b")
      .eq("is_active", true)
      .gte("created_at", twoDaysAgo)
      .limit(50);

    if (!recentPolls || recentPolls.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, reason: "no recent polls" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const pollIds = recentPolls.map(p => p.id);
    const { data: results } = await supabase.rpc("get_poll_results", { poll_ids: pollIds });

    // Sort by closeness to 50/50 and minimum votes
    const debatedPolls = (results || [])
      .filter((r: any) => r.total_votes >= 5)
      .map((r: any) => ({
        ...r,
        spread: Math.abs(r.percent_a - r.percent_b),
        poll: recentPolls.find(p => p.id === r.poll_id),
      }))
      .sort((a: any, b: any) => a.spread - b.spread)
      .slice(0, 3);

    if (debatedPolls.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, reason: "no debated polls" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build notification body
    const pollSummaries = debatedPolls
      .map((d: any) => `${d.poll?.option_a} vs ${d.poll?.option_b} (${d.percent_a}%-${d.percent_b}%)`)
      .join(" · ");

    const title = "🔥 You missed some close battles!";
    const body = pollSummaries.length > 120 
      ? pollSummaries.substring(0, 117) + "..." 
      : pollSummaries;

    // Send notifications
    const notifications = absentUsers.map(user => ({
      user_id: user.id,
      title,
      body,
      type: "absence_digest",
      data: { poll_ids: debatedPolls.map((d: any) => d.poll_id) },
    }));

    for (let i = 0; i < notifications.length; i += 100) {
      await supabase.from("notifications").insert(notifications.slice(i, i + 100));
    }

    // Trigger push notifications
    const userIds = absentUsers.map(u => u.id);
    await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({
        title,
        body,
        url: "/home",
        user_ids: userIds,
      }),
    });

    console.log(`Absence digest sent to ${absentUsers.length} users with ${debatedPolls.length} polls`);

    return new Response(
      JSON.stringify({ success: true, notified: absentUsers.length, polls: debatedPolls.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in absence-digest:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
