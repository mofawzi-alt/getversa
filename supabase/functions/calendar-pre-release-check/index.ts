// Runs hourly. Sends warning notifications to admins:
//  - 1 hr before release: today's batch has unapproved/draft rows
//  - 8 PM Cairo: tomorrow has zero approved rows
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function cairoNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  return { date: `${m.year}-${m.month}-${m.day}`, hour: parseInt(m.hour, 10) };
}

async function notifyAdmins(supabase: any, title: string, body: string, data: Record<string, any> = {}) {
  const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  if (!admins?.length) return;
  const rows = admins.map((a: any) => ({ user_id: a.user_id, title, body, type: "admin_calendar", data }));
  await supabase.from("notifications").insert(rows);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { date: today, hour } = cairoNow();

    const { data: settings } = await supabase.from("daily_poll_settings").select("release_hour_cairo").maybeSingle();
    const releaseHour = (settings as any)?.release_hour_cairo ?? 7;

    const fired: string[] = [];

    // 1 hour before release → check today's unapproved
    if (hour === releaseHour - 1) {
      const { data: pending } = await supabase
        .from("poll_calendar")
        .select("id", { count: "exact" })
        .eq("release_date", today)
        .in("status", ["draft", "image_pending"]);
      if (pending && pending.length > 0) {
        await notifyAdmins(
          supabase,
          "⚠️ Unapproved polls for today",
          `${pending.length} calendar rows still need approval — release in 1 hour.`,
          { url: "/admin?tab=calendar", date: today }
        );
        fired.push("pre_release_warning");
      }
    }

    // 8 PM Cairo → tomorrow check
    if (hour === 20) {
      const tomorrowDate = new Date(today + "T00:00:00Z");
      tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
      const tomorrow = tomorrowDate.toISOString().slice(0, 10);
      const { data: approvedTomorrow } = await supabase
        .from("poll_calendar")
        .select("id")
        .eq("release_date", tomorrow)
        .eq("status", "approved");
      if (!approvedTomorrow || approvedTomorrow.length === 0) {
        await notifyAdmins(
          supabase,
          "📭 No polls approved for tomorrow",
          `Tomorrow (${tomorrow}) has no approved calendar entries — recycling will activate.`,
          { url: "/admin?tab=calendar", date: tomorrow }
        );
        fired.push("empty_tomorrow_warning");
      }
    }

    return new Response(JSON.stringify({ ok: true, hour, fired }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("calendar-pre-release-check error", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
