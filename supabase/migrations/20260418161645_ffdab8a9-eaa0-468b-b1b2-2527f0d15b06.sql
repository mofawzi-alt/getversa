ALTER TABLE public.poll_campaigns DROP CONSTRAINT IF EXISTS poll_campaigns_visibility_mode_check;
ALTER TABLE public.poll_campaigns ADD CONSTRAINT poll_campaigns_visibility_mode_check
  CHECK (visibility_mode IN ('mixed', 'bundle_only', 'hero_only', 'panel_only'));