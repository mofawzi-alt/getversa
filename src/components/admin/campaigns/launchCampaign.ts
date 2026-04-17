import { supabase } from '@/integrations/supabase/client';

export interface DraftPoll {
  question: string;
  option_a: string;
  option_b: string;
  image_a_url?: string;
  image_b_url?: string;
  category?: string;
}

export interface LaunchInput {
  userId: string;
  name: string;
  brandName: string;
  brandLogoUrl?: string;
  description?: string;
  releaseAt?: string; // datetime-local
  expiresAt?: string;
  polls: DraftPoll[];
}

export async function launchCampaign(input: LaunchInput): Promise<{ campaignId: string; pollCount: number }> {
  const {
    userId, name, brandName, brandLogoUrl, description, releaseAt, expiresAt, polls,
  } = input;

  const { data: campaign, error: cErr } = await supabase
    .from('poll_campaigns')
    .insert({
      name: name.trim(),
      brand_name: brandName.trim(),
      brand_logo_url: brandLogoUrl?.trim() || null,
      description: description?.trim() || null,
      release_at: releaseAt ? new Date(releaseAt).toISOString() : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      is_active: true,
      created_by: userId,
    })
    .select()
    .single();
  if (cErr) throw cErr;

  const startsAt = releaseAt ? new Date(releaseAt).toISOString() : new Date().toISOString();
  const endsAt = expiresAt ? new Date(expiresAt).toISOString() : null;

  const pollRows = polls.map((p) => ({
    question: p.question.trim(),
    option_a: p.option_a.trim(),
    option_b: p.option_b.trim(),
    image_a_url: p.image_a_url?.trim() || null,
    image_b_url: p.image_b_url?.trim() || null,
    category: p.category?.trim() || 'brands',
    is_active: true,
    starts_at: startsAt,
    ends_at: endsAt,
    campaign_id: campaign.id,
    created_by: userId,
    poll_type: 'campaign',
    expiry_type: endsAt ? 'trending' : 'evergreen',
  }));

  const { data: createdPolls, error: pErr } = await supabase
    .from('polls')
    .insert(pollRows)
    .select('id');
  if (pErr) throw pErr;

  const links = (createdPolls || []).map((cp) => ({
    campaign_id: campaign.id,
    poll_id: cp.id,
    entity_name: brandName.trim(),
  }));
  if (links.length > 0) {
    const { error: lErr } = await supabase.from('campaign_polls').insert(links);
    if (lErr) throw lErr;
  }

  return { campaignId: campaign.id, pollCount: createdPolls?.length || 0 };
}
