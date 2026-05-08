// Runs daily at the configured release_hour_cairo (default 7 AM Cairo).
// 1) Publishes all approved poll_calendar rows for today as real polls (is_active=true)
// 2) If zero approved rows for today → no-op (queue logic naturally pulls random unvoted polls)
// 3) Sends admin notifications + triggers the daily batch push
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/* ── Auto-hook subtitle generator ── */
const HOOK_POOLS: Record<string, string[]> = {
  food: ["Be honest…", "Your taste says everything.", "This exposes your vibe.", "No neutral answers here.", "People will judge this choice.", "This is personal.", "Pick your comfort zone."],
  lifestyle: ["Be honest…", "This says a lot about you.", "Your choice defines your vibe.", "No middle ground here.", "Pick your side.", "Your answer might be unpopular."],
  celebrities: ["Nobody's neutral on this.", "This will start arguments.", "The internet can't agree.", "Pick carefully — people are watching.", "This one divides Egypt."],
  media: ["The ultimate struggle.", "Stop arguing — just vote.", "No one agrees on this.", "This is more controversial than it looks.", "Choose wisely."],
  brands: ["This exposes your taste.", "Loyalty check.", "Your wallet already voted.", "Brand wars — pick your side.", "This choice is personal."],
  social: ["Egypt is divided on this.", "Which side of history are you on?", "No one agrees on this.", "Your answer might be unpopular.", "Don't sit this one out."],
  daily: ["Quick — don't overthink it.", "Your morning dilemma.", "Choose.", "Pick your mission.", "A or B?", "Be honest…"],
  _default: ["Be honest…", "Pick your side.", "No neutral answers here.", "This says a lot about you.", "Your answer might be unpopular.", "Are you with the majority?"],
};
function generateHook(category: string): string {
  const cat = (category || '').toLowerCase();
  let pool: string[];
  if (cat.includes('food') || cat.includes('dining')) pool = HOOK_POOLS.food;
  else if (cat.includes('lifestyle') || cat.includes('fashion')) pool = HOOK_POOLS.lifestyle;
  else if (cat.includes('celeb') || cat.includes('entertainment')) pool = HOOK_POOLS.celebrities;
  else if (cat.includes('media') || cat.includes('streaming')) pool = HOOK_POOLS.media;
  else if (cat.includes('brand') || cat.includes('tech') || cat.includes('product')) pool = HOOK_POOLS.brands;
  else if (cat.includes('social') || cat.includes('opinion') || cat.includes('culture')) pool = HOOK_POOLS.social;
  else if (cat.includes('daily') || cat.includes('morning')) pool = HOOK_POOLS.daily;
  else pool = HOOK_POOLS._default;
  return pool[Math.floor(Math.random() * pool.length)];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function cairoToday(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date()); // YYYY-MM-DD
}

async function notifyAdmins(supabase: any, title: string, body: string, data: Record<string, any> = {}) {
  const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  if (!admins?.length) return;
  const rows = admins.map((a: any) => ({
    user_id: a.user_id, title, body, type: "admin_calendar", data,
  }));
  await supabase.from("notifications").insert(rows);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const today = cairoToday();

    const { data: approved, error } = await supabase
      .from("poll_calendar")
      .select("*")
      .eq("release_date", today)
      .eq("status", "approved");
    if (error) throw error;

    let publishedCount = 0;

    if (approved && approved.length > 0) {
      for (const row of approved) {
        const { data: poll, error: pErr } = await supabase
          .from("polls")
          .insert({
            question: row.question,
            option_a: row.option_a,
            option_b: row.option_b,
            image_a_url: row.image_a_url || null,
            image_b_url: row.image_b_url || null,
            category: row.category || null,
            target_country: row.target_country || null,
            target_age_range: row.target_age_range || null,
            target_gender: row.target_gender || null,
            is_active: true,
            poll_type: "core_index",
            expiry_type: "evergreen",
            created_by: row.created_by,
            starts_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (pErr) {
          console.error("Failed to publish row", row.id, pErr);
          continue;
        }
        await supabase
          .from("poll_calendar")
          .update({ status: "published", published_poll_id: poll.id, published_at: new Date().toISOString() })
          .eq("id", row.id);
        publishedCount++;
      }

      await notifyAdmins(
        supabase,
        `📅 ${publishedCount} polls published`,
        `Today's calendar batch is live (${today})`,
        { date: today, count: publishedCount, url: "/admin?tab=calendar" }
      );
    } else {
      // Empty day → recycle naturally via daily queue (random unvoted)
      await notifyAdmins(
        supabase,
        "♻️ No approved polls today",
        `No calendar entries for ${today} — queue will recycle older unvoted polls per user.`,
        { date: today, url: "/admin?tab=calendar" }
      );
    }

    // Trigger morning batch push to all users
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/batch-release-notify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch (e) { console.error("batch-release-notify failed", e); }

    return new Response(JSON.stringify({ ok: true, published: publishedCount, date: today }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("release-daily-calendar error", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
