// Apple App Store Guideline 5.1.1(v) — apps must allow users to delete
// their account from within the app.
//
// IMPORTANT — Versa data policy:
//  - PERSONAL / PRIVATE data is permanently deleted (profile, friendships,
//    messages, conversations, push subscriptions, suggestions, reactions,
//    notifications, follows, pins/favorites, automation settings, roles).
//  - ANALYTICS-CRITICAL data (votes, predictions, attribute ratings, verbatim
//    feedback, ask-versa queries) is ANONYMIZED in place by setting
//    `user_id = NULL`. This severs the personal link so the user is no longer
//    identifiable, while preserving aggregate vote totals, poll results, and
//    platform insights that other users and analytics depend on.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the calling user with their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    // Use service role to perform the deletion
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ---------------------------------------------------------------
    // STEP 1 — ANONYMIZE analytics-critical records (do not delete).
    // The vote / prediction / rating row stays in place so aggregate
    // poll results, percentages, and insights remain accurate.
    // ---------------------------------------------------------------
    const anonymizeTables: { table: string; extra?: Record<string, unknown> }[] = [
      // Core vote — keep the row, drop the identity + denormalized demographics.
      { table: "votes", extra: { voter_gender: null, voter_age_range: null, voter_city: null, voter_country: null } },
      // Predictions feed accuracy stats.
      { table: "predictions", extra: { voter_gender: null, voter_age_range: null, voter_city: null, voter_country: null } },
      // Attribute ratings power campaign analytics.
      { table: "poll_attribute_ratings", extra: { voter_gender: null, voter_age_range: null, voter_city: null, voter_country: null } },
      // Verbatim feedback feeds theming/clustering for brands.
      { table: "poll_verbatim_feedback", extra: { voter_gender: null, voter_age_range: null, voter_city: null, voter_country: null } },
      // Ask Versa queries are aggregate signal.
      { table: "ask_versa_queries" },
    ];

    for (const { table, extra } of anonymizeTables) {
      try {
        await admin.from(table).update({ user_id: null, ...(extra ?? {}) }).eq("user_id", userId);
      } catch (e) {
        console.error(`anonymize ${table} failed`, e);
      }
    }

    // ---------------------------------------------------------------
    // STEP 2 — DELETE personal / private data.
    // These are personal records that have no analytics value once the
    // user is gone (or that contain private content like DMs).
    // ---------------------------------------------------------------
    // Tables keyed by `user_id`:
    const deleteByUserId = [
      "skipped_polls",
      "favorite_polls",
      "pinned_polls",
      "notifications",
      "notification_log",
      "push_subscriptions",
      "automation_settings",
      "poll_reactions",
      "poll_suggestions",      // user-submitted ideas (personal)
      "user_roles",
      "campaign_clients",
      "campaign_panelists",
      "organization_members",
      "daily_poll_queues",
    ];
    for (const table of deleteByUserId) {
      try {
        await admin.from(table).delete().eq("user_id", userId);
      } catch (_) { /* ignore — table may not exist or column absent */ }
    }

    // Friendships — both directions.
    try { await admin.from("friendships").delete().eq("requester_id", userId); } catch (_) {}
    try { await admin.from("friendships").delete().eq("recipient_id", userId); } catch (_) {}

    // Follows — both directions.
    try { await admin.from("follows").delete().eq("follower_id", userId); } catch (_) {}
    try { await admin.from("follows").delete().eq("following_id", userId); } catch (_) {}

    // Private messages + conversations.
    try { await admin.from("messages").delete().eq("sender_id", userId); } catch (_) {}
    try { await admin.from("conversations").delete().eq("user1_id", userId); } catch (_) {}
    try { await admin.from("conversations").delete().eq("user2_id", userId); } catch (_) {}

    // Duels / challenges (personal head-to-head records).
    try { await admin.from("poll_challenges").delete().eq("challenger_id", userId); } catch (_) {}
    try { await admin.from("poll_challenges").delete().eq("challenged_id", userId); } catch (_) {}

    // Collaboration requests (personal outreach).
    try { await admin.from("collaboration_requests").delete().eq("requester_id", userId); } catch (_) {}

    // ---------------------------------------------------------------
    // STEP 3 — Profile row (public.users) is the personal identity.
    // ---------------------------------------------------------------
    try { await admin.from("users").delete().eq("id", userId); } catch (e) {
      console.error("delete users row failed", e);
    }

    // ---------------------------------------------------------------
    // STEP 4 — Auth user. This is the canonical identity record.
    // ---------------------------------------------------------------
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("auth.admin.deleteUser error", delErr);
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
