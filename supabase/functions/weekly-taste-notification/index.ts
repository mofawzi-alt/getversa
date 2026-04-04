import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Get all users who have voted in the last 30 days (active users)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activeUsers, error: usersError } = await supabase
      .from("users")
      .select("id, username")
      .gte("last_vote_date", thirtyDaysAgo.toISOString().split("T")[0]);

    if (usersError) throw usersError;
    if (!activeUsers?.length) {
      return new Response(
        JSON.stringify({ message: "No active users to notify", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert a notification for each active user
    const notifications = activeUsers.map((user) => ({
      user_id: user.id,
      title: "Your weekly taste report is ready 👀",
      body: `See how your choices define you — your Taste Profile has been updated.`,
      type: "weekly_taste",
      data: { route: "/taste-profile" },
    }));

    // Batch insert notifications
    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        message: `Sent weekly taste notifications to ${notifications.length} users`,
        count: notifications.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
