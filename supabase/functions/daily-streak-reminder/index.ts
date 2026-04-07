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

    // Get today's date
    const today = new Date().toISOString().split("T")[0];

    // Find all users who have NOT voted today
    // Get all users, then exclude those who voted today
    const { data: allUsers, error: usersError } = await supabase
      .from("users")
      .select("id, username, last_vote_date, current_streak");

    if (usersError) throw usersError;

    const usersWhoHaventVotedToday = (allUsers || []).filter(
      (u) => u.last_vote_date !== today
    );

    if (usersWhoHaventVotedToday.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "All users voted today!" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userIds = usersWhoHaventVotedToday.map((u) => u.id);

    // Insert in-app notifications for these users
    const notificationRecords = usersWhoHaventVotedToday.map((u) => ({
      user_id: u.id,
      title: "Your streak is waiting 🔥",
      body: `New battles today on Versa${u.current_streak && u.current_streak > 0 ? ` — ${u.current_streak} day streak!` : ""}`,
      type: "streak_reminder",
      data: { url: "/swipe" },
    }));

    const { error: notifError } = await supabase
      .from("notifications")
      .insert(notificationRecords);

    if (notifError) {
      console.error("Error storing notifications:", notifError);
    }

    console.log(`Sent streak reminders to ${userIds.length} users who haven't voted today`);

    return new Response(
      JSON.stringify({
        success: true,
        reminded: userIds.length,
        message: `Streak reminders sent to ${userIds.length} users`,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in daily-streak-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
