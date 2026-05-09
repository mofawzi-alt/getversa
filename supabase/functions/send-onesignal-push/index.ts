import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendPayload {
  user_ids?: string[];
  player_ids?: string[];
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      throw new Error("OneSignal credentials not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload = (await req.json()) as SendPayload;
    if (!payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: "title and body required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let subscriptionIds: string[] = payload.player_ids ?? [];

    if (payload.user_ids && payload.user_ids.length > 0) {
      const { data, error } = await admin
        .from("onesignal_subscriptions")
        .select("player_id")
        .in("user_id", payload.user_ids);
      if (error) throw error;
      subscriptionIds = subscriptionIds.concat((data ?? []).map((r) => r.player_id));
    }

    subscriptionIds = [...new Set(subscriptionIds)].filter(Boolean);

    if (subscriptionIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, note: "no subscribers" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const osBody: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      include_subscription_ids: subscriptionIds,
      target_channel: "push",
      headings: { en: payload.title },
      contents: { en: payload.body },
      data: { ...(payload.data ?? {}), url: payload.url ?? "/" },
    };
    if (payload.url) {
      osBody.url = payload.url;
    }

    const response = await fetch(
      "https://api.onesignal.com/notifications",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(osBody),
      },
    );

    const result = await response.json();
    if (!response.ok) {
      console.error("OneSignal error:", result);
      throw new Error(`OneSignal API ${response.status}: ${JSON.stringify(result)}`);
    }

    return new Response(
      JSON.stringify({ success: true, sent: subscriptionIds.length, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("send-onesignal-push error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to send" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
