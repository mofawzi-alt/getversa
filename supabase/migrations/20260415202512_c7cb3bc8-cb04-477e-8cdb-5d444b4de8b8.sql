-- Cliffhanger poll series support
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS series_id uuid;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS series_order integer;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS series_title text;

CREATE INDEX IF NOT EXISTS idx_polls_series ON public.polls(series_id) WHERE series_id IS NOT NULL;

-- Taste evolution snapshots (weekly)
CREATE TABLE public.taste_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  majority_pct integer,
  minority_pct integer,
  top_trait text,
  archetype text,
  adventure_score integer,
  brand_loyalty_score integer,
  total_votes integer NOT NULL DEFAULT 0,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

ALTER TABLE public.taste_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots" ON public.taste_snapshots
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert snapshots" ON public.taste_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_taste_snapshots_user ON public.taste_snapshots(user_id, snapshot_date DESC);