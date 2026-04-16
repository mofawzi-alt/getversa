import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  poll_id?: string;
  user_ids?: string[];
  skip_in_app?: boolean; // when true, do not insert a row into public.notifications
  notification_type?: string; // type to use if we do insert (default 'new_poll')
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("VAPID keys not configured");
    }

    // Configure web-push with VAPID details
    webpush.setVapidDetails(
      "mailto:support@getversa.app",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload: NotificationPayload = await req.json();
    console.log("Sending push notification:", payload);

    // Get push subscriptions
    let query = supabase.from("push_subscriptions").select("*");

    if (payload.user_ids && payload.user_ids.length > 0) {
      query = query.in("user_id", payload.user_ids);
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    console.log(`Found ${subscriptions?.length || 0} push subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build the push payload
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
      poll_id: payload.poll_id,
    });

    // Send real push notifications to all subscriptions
    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, pushPayload);
          sent++;
        } catch (err: any) {
          console.error(`Push failed for ${sub.endpoint}:`, err.statusCode, err.body);
          // 404 or 410 means subscription is expired/invalid
          if (err.statusCode === 404 || err.statusCode === 410) {
            expiredEndpoints.push(sub.endpoint);
          }
          failed++;
        }
      })
    );

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      const { error: deleteError } = await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);

      if (deleteError) {
        console.error("Error cleaning expired subs:", deleteError);
      } else {
        console.log(`Cleaned ${expiredEndpoints.length} expired subscriptions`);
      }
    }

    // Also store in-app notifications
    const uniqueUserIds = [...new Set(subscriptions.map((s) => s.user_id))];
    const notificationRecords = uniqueUserIds.map((userId) => ({
      user_id: userId,
      title: payload.title,
      body: payload.body,
      type: "new_poll",
      data: { poll_id: payload.poll_id, url: payload.url },
    }));

    const { error: notifError } = await supabase
      .from("notifications")
      .insert(notificationRecords);

    if (notifError) {
      console.error("Error storing notifications:", notifError);
    }

    console.log(`Push results: ${sent} sent, ${failed} failed, ${expiredEndpoints.length} expired`);

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        expired_cleaned: expiredEndpoints.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
