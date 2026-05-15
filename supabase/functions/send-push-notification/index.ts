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
  governance_checked?: boolean; // when true, caller already passed can_send_notification
  priority?: number; // for governance gate when not yet checked
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

    // ── Anti-spam governance gate ───────────────────────────────────────────
    // If caller hasn't already been governed AND we have a notification_type,
    // run can_send_notification per user. Drop users who fail (cap, prefs,
    // quiet hours, or 6h duplicate). This protects every legacy/bypass caller.
    let allowedUserIds: string[] | null = payload.user_ids ?? null;
    const notifType = payload.notification_type || "new_poll";
    const priority = payload.priority ?? 9;
    if (!payload.governance_checked && payload.user_ids?.length) {
      const allowed: string[] = [];
      const blocked: Record<string, string> = {};
      await Promise.all(
        payload.user_ids.map(async (uid) => {
          const { data: gate } = await supabase.rpc("can_send_notification", {
            p_user_id: uid,
            p_notification_type: notifType,
            p_priority: priority,
            p_title: payload.title,
          });
          if (gate?.allowed) allowed.push(uid);
          else blocked[uid] = gate?.reason ?? "unknown";
        })
      );
      const blockedCount = payload.user_ids.length - allowed.length;
      if (blockedCount > 0) {
        const sample = Object.entries(blocked).slice(0, 5);
        console.log(`Governance blocked ${blockedCount}/${payload.user_ids.length} users (sample:`, sample, ")");
      }
      allowedUserIds = allowed;
      if (allowed.length === 0) {
        return new Response(
          JSON.stringify({ success: true, sent: 0, governance_blocked: blockedCount, message: "All recipients gated by governance" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      // Log each allowed send so the 3/day cap and dedupe stay honest
      await Promise.all(
        allowed.map((uid) =>
          supabase.rpc("log_notification_sent", {
            p_user_id: uid,
            p_notification_type: notifType,
            p_priority: priority,
            p_channel: "push",
            p_data: { title: payload.title, url: payload.url, poll_id: payload.poll_id },
          })
        )
      );
    }
    // Replace the payload's user_ids with the filtered set for downstream queries
    payload.user_ids = allowedUserIds ?? payload.user_ids;
    // Fire-and-forget: also send via OneSignal for native iOS/Android subscribers.
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
    if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
      try {
        let subscriptionIds: string[] = [];
        if (payload.user_ids?.length) {
          const { data: osSubs } = await supabase
            .from("onesignal_subscriptions")
            .select("player_id")
            .in("user_id", payload.user_ids);
          subscriptionIds = [...new Set((osSubs ?? []).map((r: any) => r.player_id))].filter(Boolean);
        } else {
          const { data: osSubs } = await supabase
            .from("onesignal_subscriptions")
            .select("player_id");
          subscriptionIds = [...new Set((osSubs ?? []).map((r: any) => r.player_id))].filter(Boolean);
        }

        const osBody: Record<string, unknown> = {
          app_id: ONESIGNAL_APP_ID,
          headings: { en: payload.title },
          contents: { en: payload.body },
          data: { url: payload.url ?? "/", poll_id: payload.poll_id },
          target_channel: "push",
          ...(payload.url ? { app_url: `com.versa.app://${String(payload.url).replace(/^\//, '')}` } : {}),
        };

        if (subscriptionIds.length === 0) {
          console.log("OneSignal: no native subscription ids found, skipping");
        } else {
          osBody.include_subscription_ids = subscriptionIds;
        }

        if (osBody.include_subscription_ids) {
          const osRes = await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: {
              Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(osBody),
          });
          const osJson = await osRes.json();
          console.log(`OneSignal sent (${subscriptionIds.length} native subscriptions):`, osRes.status, osJson);
        }
      } catch (osErr) {
        console.error("OneSignal forward failed:", osErr);
      }
    }

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

    // Also store in-app notifications (unless caller already inserted them)
    if (!payload.skip_in_app) {
      const uniqueUserIds = [...new Set(subscriptions.map((s) => s.user_id))];
      const notificationRecords = uniqueUserIds.map((userId) => ({
        user_id: userId,
        title: payload.title,
        body: payload.body,
        type: payload.notification_type || "new_poll",
        data: { poll_id: payload.poll_id, url: payload.url },
      }));

      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notificationRecords);

      if (notifError) {
        console.error("Error storing notifications:", notifError);
      }
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
