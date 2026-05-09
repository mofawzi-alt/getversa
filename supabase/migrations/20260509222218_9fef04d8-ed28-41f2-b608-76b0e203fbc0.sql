
-- USERS counters
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS live_asks_used_this_week int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_ask_week_start date,
  ADD COLUMN IF NOT EXISTS live_ask_unlocked_at timestamptz;

-- LIVE_ASKS
CREATE TABLE public.live_asks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  question text NOT NULL CHECK (char_length(question) BETWEEN 3 AND 140),
  option_a text NOT NULL CHECK (char_length(option_a) BETWEEN 1 AND 40),
  option_b text NOT NULL CHECK (char_length(option_b) BETWEEN 1 AND 40),
  target_gender text,
  target_age_ranges text[],
  target_cities text[],
  target_countries text[],
  status text NOT NULL DEFAULT 'active',
  vision_check jsonb DEFAULT '{}'::jsonb,
  vote_count int NOT NULL DEFAULT 0,
  votes_a int NOT NULL DEFAULT 0,
  votes_b int NOT NULL DEFAULT 0,
  reveal_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  finalized_at timestamptz,
  is_paid boolean NOT NULL DEFAULT false,
  credits_charged int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('active','collapsed','finalized','rejected'))
);

CREATE INDEX idx_live_asks_asker ON public.live_asks(asker_id, created_at DESC);
CREATE INDEX idx_live_asks_active ON public.live_asks(status, reveal_at) WHERE status = 'active';

ALTER TABLE public.live_asks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-rejected live asks"
  ON public.live_asks FOR SELECT TO authenticated
  USING (status <> 'rejected' OR asker_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own live asks"
  ON public.live_asks FOR INSERT TO authenticated
  WITH CHECK (asker_id = auth.uid());

CREATE POLICY "Admins manage live asks"
  ON public.live_asks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- LIVE_ASK_VOTES (denormalized B2B-grade demographic snapshot)
CREATE TABLE public.live_ask_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_ask_id uuid NOT NULL REFERENCES public.live_asks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  choice text NOT NULL CHECK (choice IN ('A','B')),
  -- demographic snapshot at vote time
  voter_gender text,
  voter_age_range text,
  voter_city text,
  voter_country text,
  taste_archetype text,
  personality_type text,
  -- decision quality signals
  session_duration_ms int,
  is_targeted_match boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (live_ask_id, user_id)
);

CREATE INDEX idx_live_ask_votes_ask ON public.live_ask_votes(live_ask_id);
CREATE INDEX idx_live_ask_votes_targeted ON public.live_ask_votes(live_ask_id, is_targeted_match);
CREATE INDEX idx_live_ask_votes_demo ON public.live_ask_votes(live_ask_id, voter_gender, voter_age_range);

ALTER TABLE public.live_ask_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view live ask votes"
  ON public.live_ask_votes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own live ask votes"
  ON public.live_ask_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all live ask votes"
  ON public.live_ask_votes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- REPORTS
CREATE TABLE public.live_ask_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_ask_id uuid NOT NULL REFERENCES public.live_asks(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (live_ask_id, reporter_id)
);

ALTER TABLE public.live_ask_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own reports"
  ON public.live_ask_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Reporters view own reports"
  ON public.live_ask_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage reports"
  ON public.live_ask_reports FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger on live_asks
CREATE TRIGGER trg_live_asks_updated_at
  BEFORE UPDATE ON public.live_asks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- vote count maintenance
CREATE OR REPLACE FUNCTION public.live_ask_increment_votes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.live_asks
  SET vote_count = vote_count + 1,
      votes_a = votes_a + CASE WHEN NEW.choice = 'A' THEN 1 ELSE 0 END,
      votes_b = votes_b + CASE WHEN NEW.choice = 'B' THEN 1 ELSE 0 END
  WHERE id = NEW.live_ask_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_live_ask_votes_count
  AFTER INSERT ON public.live_ask_votes
  FOR EACH ROW EXECUTE FUNCTION public.live_ask_increment_votes();

-- auto-collapse on 3 reports
CREATE OR REPLACE FUNCTION public.live_ask_check_reports()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rcount int;
BEGIN
  SELECT count(*) INTO rcount FROM public.live_ask_reports WHERE live_ask_id = NEW.live_ask_id;
  IF rcount >= 3 THEN
    UPDATE public.live_asks SET status = 'collapsed' WHERE id = NEW.live_ask_id AND status = 'active';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_live_ask_reports_threshold
  AFTER INSERT ON public.live_ask_reports
  FOR EACH ROW EXECUTE FUNCTION public.live_ask_check_reports();

-- STORAGE bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('live-ask-photos', 'live-ask-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read live-ask-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'live-ask-photos');

CREATE POLICY "Users upload own live-ask-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'live-ask-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own live-ask-photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'live-ask-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
