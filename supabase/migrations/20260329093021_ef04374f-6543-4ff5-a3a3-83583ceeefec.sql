
CREATE TABLE public.skipped_polls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, poll_id)
);

ALTER TABLE public.skipped_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own skips" ON public.skipped_polls
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own skips" ON public.skipped_polls
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own skips" ON public.skipped_polls
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
