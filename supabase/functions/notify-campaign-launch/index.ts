// Notifies targeted users when an admin launches a campaign.
// Triggered by the AFTER UPDATE trigger on poll_campaigns when is_active flips false->true.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const campaignId: string | undefined = body?.campaign_id;
    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Load campaign
    const { data: campaign, error: cErr } = await supabase
      .from("poll_campaigns")
      .select("id, name, brand_name, is_active, launch_notification_sent, target_gender, target_age_ranges, target_countries, target_cities")
      .eq("id", campaignId)
      .maybeSingle();

    if (cErr || !campaign) {
      return new Response(JSON.stringify({ error: "campaign not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!campaign.is_active) {
      return new Response(JSON.stringify({ skipped: "campaign not active" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (campaign.launch_notification_sent) {
      return new Response(JSON.stringify({ skipped: "already sent" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Build user query with demographic filters
    let q = supabase.from("users").select("id");

    if (campaign.target_gender) {
      q = q.eq("gender", campaign.target_gender);
    }
    if (Array.isArray(campaign.target_age_ranges) && campaign.target_age_ranges.length > 0) {
      q = q.in("age_range", campaign.target_age_ranges);
    }
    if (Array.isArray(campaign.target_countries) && campaign.target_countries.length > 0) {
      q = q.in("country", campaign.target_countries);
    }
    if (Array.isArray(campaign.target_cities) && campaign.target_cities.length > 0) {
      q = q.in("city", campaign.target_cities);
    }

    const { data: users, error: uErr } = await q.limit(50000);
    if (uErr) throw uErr;

    const userIds = (users || []).map((u: any) => u.id);
    const brand = campaign.brand_name || campaign.name;
    const title = `🔥 New: ${campaign.name}`;
    const messageBody = `Tap to vote on the ${brand} debate now.`;

    let sentResult: any = { sent: 0 };
    if (userIds.length > 0) {
      // Fire to send-push-notification (handles both push + in-app + governance)
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          title,
          body: messageBody,
          url: `/brand-campaign/${campaign.id}`,
          user_ids: userIds,
          notification_type: "new_poll",
          priority: 5,
        }),
      });
      sentResult = await resp.json().catch(() => ({ ok: resp.ok }));
    }

    // Mark as sent
    await supabase
      .from("poll_campaigns")
      .update({
        launch_notification_sent: true,
        launch_notification_sent_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaign.id,
        matched_users: userIds.length,
        push_result: sentResult,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e: any) {
    console.error("notify-campaign-launch error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
