import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Friend Voted Push — refactored Phase 2: routes through governance layer.
 * Each friend gets ONE governed call (priority 4 = friend_activity).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { voter_username, poll_question, poll_id, friend_ids } = await req.json();
    if (!friend_ids?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const name = voter_username || "A friend";
    const question = (poll_question || "").substring(0, 50);
    const title = `${name} just voted! 👀`;
    const body = `See if you agree: ${question}`;

    const results = await Promise.allSettled(
      friend_ids.map((uid: string) =>
        fetch(`${SUPABASE_URL}/functions/v1/send-governed-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_id: uid,
            notification_type: "friend_activity",
            priority: 4,
            title,
            body,
            url: poll_id ? `/poll/${poll_id}` : "/home",
            data: { poll_id, voter_username: name },
          }),
        }).then((r) => r.json())
      )
    );

    const sent = results.filter((r: any) => r.status === "fulfilled" && r.value?.sent).length;
    return new Response(JSON.stringify({ success: true, sent, attempted: friend_ids.length }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("friend-voted-push error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
