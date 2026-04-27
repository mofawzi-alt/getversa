ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS is_reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_image_fix boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_polls_is_reviewed ON public.polls(is_reviewed);
CREATE INDEX IF NOT EXISTS idx_polls_needs_image_fix ON public.polls(needs_image_fix) WHERE needs_image_fix = true;
CREATE INDEX IF NOT EXISTS idx_polls_is_archived ON public.polls(is_archived) WHERE is_archived = true;