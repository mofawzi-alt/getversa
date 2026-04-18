// Sends "The day's verdict is in 🔥" push at 9 PM Cairo (6 PM UTC).
// Triggered by pg_cron once daily.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Honor the admin pulse setting
    const { data: settings } = await supabase
      .from("pulse_settings")
      .select("evening_verdict_enabled")
      .limit(1)
      .maybeSingle();
    if (settings && (settings as any).evening_verdict_enabled === false) {
      return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        title: "🔥 The day's verdict is in",
        body: "See today's biggest result, closest battle, and the surprise that broke the internet.",
        url: "/home",
      },
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("evening-verdict-push error", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
