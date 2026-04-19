CREATE TABLE public.poll_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reaction TEXT NOT NULL DEFAULT 'fire',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id, reaction)
);

CREATE INDEX idx_poll_reactions_poll ON public.poll_reactions(poll_id);
CREATE INDEX idx_poll_reactions_user ON public.poll_reactions(user_id);

ALTER TABLE public.poll_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions"
ON public.poll_reactions FOR SELECT
USING (true);

CREATE POLICY "Users can add own reactions"
ON public.poll_reactions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove own reactions"
ON public.poll_reactions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_reactions;