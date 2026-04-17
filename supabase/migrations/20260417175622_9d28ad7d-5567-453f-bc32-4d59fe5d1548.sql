-- Add campaign_id to polls for fast campaign filtering
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.poll_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_polls_campaign_id ON public.polls(campaign_id);

-- Extend poll_campaigns with brand + release window + status
ALTER TABLE public.poll_campaigns
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS release_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS target_vote_count integer,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS brand_logo_url text;

-- Allow public read of active campaigns so Home banner can render them
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON public.poll_campaigns;
CREATE POLICY "Anyone can view active campaigns"
  ON public.poll_campaigns
  FOR SELECT
  USING (is_active = true);

-- Allow public read of campaign_polls links for active campaigns
DROP POLICY IF EXISTS "Anyone can view active campaign polls" ON public.campaign_polls;
CREATE POLICY "Anyone can view active campaign polls"
  ON public.campaign_polls
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.poll_campaigns pc
    WHERE pc.id = campaign_polls.campaign_id AND pc.is_active = true
  ));