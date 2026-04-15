-- Challenge a Friend table
CREATE TABLE public.poll_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL,
  challenged_id uuid NOT NULL,
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  taunt_message text,
  challenger_choice text,
  challenged_choice text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

ALTER TABLE public.poll_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own challenges" ON public.poll_challenges
  FOR SELECT TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

CREATE POLICY "Users can create challenges" ON public.poll_challenges
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Users can respond to challenges" ON public.poll_challenges
  FOR UPDATE TO authenticated
  USING (auth.uid() = challenged_id);

CREATE INDEX idx_poll_challenges_challenged ON public.poll_challenges(challenged_id, status);
CREATE INDEX idx_poll_challenges_poll ON public.poll_challenges(poll_id);