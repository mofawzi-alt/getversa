import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SaveSubscriptionPayload {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return json({ error: "Please sign in to enable notifications" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return json({ error: "Please sign in again to enable notifications" }, 401);
    }

    const payload = (await req.json()) as SaveSubscriptionPayload;

    if (!payload.endpoint || !payload.p256dh || !payload.auth) {
      return json({ error: "Incomplete push subscription" }, 400);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: createUserError } = await adminClient.from("users").insert({
      id: user.id,
      email: user.email ?? "",
      username: user.email?.split("@")[0] ?? null,
    });

    if (createUserError && createUserError.code !== "23505") {
      throw createUserError;
    }

    const { error: subscriptionError } = await adminClient
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: payload.endpoint,
          p256dh: payload.p256dh,
          auth: payload.auth,
        },
        {
          onConflict: "user_id,endpoint",
        },
      );

    if (subscriptionError) {
      throw subscriptionError;
    }

    return json({ success: true });
  } catch (error: any) {
    console.error("Error saving push subscription:", error);
    return json({ error: error.message || "Failed to save push subscription" }, 500);
  }
});