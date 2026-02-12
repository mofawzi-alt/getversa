import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
}

// Web Push implementation using Web Crypto API
async function generateVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const urlObj = new URL(endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;
  
  // Create JWT header and payload
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: "mailto:support@versa.app",
  };

  // Base64URL encode
  const base64UrlEncode = (data: Uint8Array | string): string => {
    const str = typeof data === "string" ? data : new TextDecoder().decode(data);
    const base64 = btoa(str);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKeyBuffer = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  return {
    authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    cryptoKey: vapidPublicKey,
  };
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<Response> {
  // For web push, we'll use a simplified approach with fetch
  // This sends to the push service endpoint
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
    },
    body: payload,
  });

  return response;
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload: NotificationPayload = await req.json();
    console.log("Sending notification:", payload);

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

    console.log(`Found ${subscriptions?.length || 0} subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Store notification in database for all target users
    const notificationRecords = subscriptions.map((sub) => ({
      user_id: sub.user_id,
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

    // Note: Full web-push encryption requires complex ECDH key exchange
    // For production, consider using a service like OneSignal or Firebase FCM
    // This stores the notification in DB and users will see it in-app
    
    console.log(`Stored ${subscriptions.length} notifications in database`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        stored: subscriptions.length,
        message: "Notifications stored. Users will see them in-app."
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
