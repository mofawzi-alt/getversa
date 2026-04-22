// Apple App Store Guideline 5.1.1(v) — apps must allow users to delete
// their account from within the app. This edge function permanently
// removes the user's auth record (cascades to all related rows).
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

    // Best-effort cleanup of user-owned data. Most tables cascade via FKs,
    // but we explicitly purge tables without ON DELETE CASCADE to be safe.
    const cleanupTables = [
      "votes",
      "predictions",
      "skipped_polls",
      "favorite_polls",
      "pinned_polls",
      "follows",
      "friendships",
      "messages",
      "conversations",
      "notifications",
      "push_subscriptions",
      "automation_settings",
      "ask_versa_queries",
      "poll_reactions",
      "poll_attribute_ratings",
      "poll_verbatim_feedback",
      "poll_suggestions",
      "user_roles",
    ];

    for (const table of cleanupTables) {
      try {
        // Delete by user_id where present
        await admin.from(table).delete().eq("user_id", userId);
      } catch (_) { /* table may not have user_id col, ignore */ }
    }

    // Delete from public.users (profile)
    try { await admin.from("users").delete().eq("id", userId); } catch (_) {}

    // Finally, delete the auth user
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
