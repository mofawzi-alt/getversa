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

    // Get all users
    const { data: allUsers, error: usersError } = await supabase
      .from("users")
      .select("id");

    if (usersError) throw usersError;

    if (!allUsers || allUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No users found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Insert weekly notification for all users
    const notificationRecords = allUsers.map((u) => ({
      user_id: u.id,
      title: "Fresh battles this week 👀",
      body: "See what's new on Versa",
      type: "weekly_polls",
      data: { url: "/home" },
    }));

    const { error: notifError } = await supabase
      .from("notifications")
      .insert(notificationRecords);

    if (notifError) {
      console.error("Error storing notifications:", notifError);
    }

    console.log(`Sent weekly notification to ${allUsers.length} users`);

    return new Response(
      JSON.stringify({
        success: true,
        notified: allUsers.length,
        message: `Weekly polls notification sent to ${allUsers.length} users`,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in weekly-new-polls:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
