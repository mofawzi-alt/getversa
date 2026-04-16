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

    // Determine which batch this is based on Cairo time
    const now = new Date();
    const cairoHour = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" })).getHours();

    let batchLabel: string;
    let emoji: string;
    let body: string;

    if (cairoHour >= 7 && cairoHour < 11) {
      batchLabel = "morning";
      emoji = "☀️";
      body = "Your morning polls are ready! Start your day with fresh debates.";
    } else if (cairoHour >= 12 && cairoHour < 16) {
      batchLabel = "afternoon";
      emoji = "🔥";
      body = "New polls just dropped! More debates waiting for you.";
    } else {
      batchLabel = "evening";
      emoji = "🌙";
      body = "Tonight's final batch is here! Don't miss out before the day ends.";
    }

    const title = `${emoji} New Polls Available!`;

    console.log(`Batch release notification: ${batchLabel} batch at Cairo hour ${cairoHour}`);

    // Send push notification via the existing send-push-notification function
    const { error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        title,
        body,
        url: "/home",
      },
    });

    if (error) {
      console.error("Error invoking send-push-notification:", error);
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, batch: batchLabel }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in batch-release-notify:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
