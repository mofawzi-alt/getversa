// Daily 9:00 AM Cairo cron: activates campaign polls whose drip release date has arrived.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Activate all polls belonging to drip-enabled campaigns whose starts_at has passed
    // and which are not yet active.
    const { data: campaigns, error: campErr } = await supabase
      .from('poll_campaigns')
      .select('id, name')
      .eq('drip_enabled', true);

    if (campErr) throw campErr;

    const nowIso = new Date().toISOString();
    let totalActivated = 0;
    const perCampaign: Array<{ campaign_id: string; name: string; activated: number }> = [];

    for (const c of campaigns ?? []) {
      const { data: updated, error: upErr } = await supabase
        .from('polls')
        .update({ is_active: true })
        .eq('campaign_id', c.id)
        .eq('is_active', false)
        .lte('starts_at', nowIso)
        .select('id');

      if (upErr) {
        console.error(`[drip] campaign ${c.id} update failed`, upErr);
        continue;
      }
      const n = updated?.length ?? 0;
      totalActivated += n;
      if (n > 0) perCampaign.push({ campaign_id: c.id, name: c.name, activated: n });
    }

    console.log(`[drip] activated ${totalActivated} polls across ${perCampaign.length} campaigns`);

    return new Response(
      JSON.stringify({ ok: true, total_activated: totalActivated, campaigns: perCampaign }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[drip] error', e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
