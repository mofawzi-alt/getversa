CREATE INDEX IF NOT EXISTS idx_polls_category ON public.polls (category);
CREATE INDEX IF NOT EXISTS idx_polls_tags ON public.polls USING GIN (tags);