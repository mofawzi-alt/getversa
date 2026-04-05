
-- User pinned polls (personal pin per user)
CREATE TABLE public.pinned_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (date_trunc('day', now() + interval '1 day')),
  UNIQUE(user_id)
);

ALTER TABLE public.pinned_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pins" ON public.pinned_polls
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin featured poll (global pin for all users)
CREATE TABLE public.featured_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (date_trunc('day', now() + interval '1 day'))
);

ALTER TABLE public.featured_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view featured polls" ON public.featured_polls
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage featured polls" ON public.featured_polls
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.pinned_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.featured_polls;
