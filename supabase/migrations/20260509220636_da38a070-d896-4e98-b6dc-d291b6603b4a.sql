ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS entities text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_polls_entities ON public.polls USING GIN (entities);