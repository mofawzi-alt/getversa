// Single entry point for all Phase 2 governed notifications.
// Checks prefs + quiet hours + 3/day cap via can_send_notification, then
// inserts the in-app notification, sends a web push, and logs it.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  user_id: string;
  notification_type: string; // must match a column on user_notification_preferences
  priority: number;          // 1 (highest) … 10 (lowest)
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
  send_push?: boolean;       // default true
}

const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const p = (await req.json()) as Payload;
    if (!p.user_id || !p.notification_type || !p.title || !p.body) {
      return new Response(JSON.stringify({ error: "missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Governance check
    const { data: gate, error: gateErr } = await supabase.rpc("can_send_notification", {
      p_user_id: p.user_id,
      p_notification_type: p.notification_type,
      p_priority: p.priority ?? 99,
    });
    if (gateErr) throw gateErr;

    if (!gate?.allowed) {
      return new Response(JSON.stringify({ sent: false, reason: gate?.reason }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Insert in-app notification
    const { error: insErr } = await supabase.from("notifications").insert({
      user_id: p.user_id,
      title: p.title,
      body: p.body,
      type: p.notification_type,
      data: { ...(p.data ?? {}), url: p.url },
    });
    if (insErr) throw insErr;

    // 3. Optional web push (skip duplicate in-app insert, since we already inserted)
    if (p.send_push !== false) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ANON}`,
          },
          body: JSON.stringify({
            title: p.title,
            body: p.body,
            url: p.url ?? "/",
            user_ids: [p.user_id],
            skip_in_app: true,
            notification_type: p.notification_type,
          }),
        });
      } catch (e) {
        console.error("push relay failed", e);
      }
    }

    // 4. Log
    await supabase.rpc("log_notification_sent", {
      p_user_id: p.user_id,
      p_notification_type: p.notification_type,
      p_priority: p.priority ?? 99,
      p_channel: "in_app",
      p_data: p.data ?? {},
    });

    return new Response(JSON.stringify({ sent: true, displaced_id: gate.displaced_id ?? null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-governed-notification error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
