
-- Daily pulse cache: one row per slot (morning/evening) per Cairo date
CREATE TABLE public.daily_pulse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot TEXT NOT NULL CHECK (slot IN ('morning', 'evening')),
  pulse_date DATE NOT NULL,
  -- Cards: structured JSON for each story card in the sequence
  -- { big_result: {...}, closest_battle: {...}, surprise: {...}, today_first: {...} }
  cards JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Egypt Today: top 3 results (last 24h) for the home stories row
  egypt_today JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Cairo-specific: top result filtered to Cairo voters
  cairo JSONB DEFAULT '[]'::jsonb,
  -- Per-category top result (keyed by category lowercase)
  by_category JSONB DEFAULT '{}'::jsonb,
  -- Admin pin: poll_id forced into Egypt Today position 1
  pinned_poll_id UUID REFERENCES public.polls(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_pulse_slot_date_unique UNIQUE (slot, pulse_date)
);

CREATE INDEX idx_daily_pulse_date ON public.daily_pulse (pulse_date DESC, slot);

ALTER TABLE public.daily_pulse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pulse"
  ON public.daily_pulse FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins manage pulse"
  ON public.daily_pulse FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Per-user story view tracking (powers seen/unseen circles + "once per day" gating)
CREATE TABLE public.story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic TEXT NOT NULL, -- 'morning_pulse' | 'evening_verdict' | 'egypt_today' | 'cairo' | 'category:<name>' | 'updates' | 'friends'
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  cards_viewed INTEGER NOT NULL DEFAULT 0,
  vote_taps INTEGER NOT NULL DEFAULT 0,
  share_taps INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT story_views_unique UNIQUE (user_id, topic, view_date)
);

CREATE INDEX idx_story_views_user_date ON public.story_views (user_id, view_date DESC);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own story views"
  ON public.story_views FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all story views"
  ON public.story_views FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Feature flags / admin toggles
CREATE TABLE public.pulse_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  morning_pulse_enabled BOOLEAN NOT NULL DEFAULT true,
  evening_verdict_enabled BOOLEAN NOT NULL DEFAULT true,
  stories_row_enabled BOOLEAN NOT NULL DEFAULT true,
  egypt_today_enabled BOOLEAN NOT NULL DEFAULT true,
  cairo_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

INSERT INTO public.pulse_settings (id) VALUES (gen_random_uuid());

ALTER TABLE public.pulse_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view pulse settings"
  ON public.pulse_settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins manage pulse settings"
  ON public.pulse_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
