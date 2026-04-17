import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Personalized Poll Push — Phase 2: routes through governance layer.
 * Maps to notification_type "new_category" (priority 7) since these are
 * category-interest matches.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: recentPolls } = await supabase
      .from("polls")
      .select("id, question, category")
      .eq("is_active", true)
      .gte("created_at", fourHoursAgo)
      .not("category", "is", null);

    if (!recentPolls?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: users } = await supabase
      .from("users").select("id, category_interests").not("category_interests", "is", null);

    const matches: { userId: string; poll: any }[] = [];
    for (const u of users ?? []) {
      const interests = (u.category_interests || []).map((c: string) => c.toLowerCase());
      const m = recentPolls.find((p) => interests.includes(p.category?.toLowerCase() || ""));
      if (m) matches.push({ userId: u.id, poll: m });
    }

    const results = await Promise.allSettled(
      matches.map((m) =>
        fetch(`${SUPABASE_URL}/functions/v1/send-governed-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_id: m.userId,
            notification_type: "new_category",
            priority: 7,
            title: "🎯 A poll you'd love!",
            body: m.poll.question.substring(0, 60),
            url: `/poll/${m.poll.id}`,
            data: { poll_id: m.poll.id, category: m.poll.category },
          }),
        }).then((r) => r.json())
      )
    );

    const sent = results.filter((r: any) => r.status === "fulfilled" && r.value?.sent).length;
    return new Response(JSON.stringify({ success: true, sent, matched: matches.length }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("personalized-poll-push error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
