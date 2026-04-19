-- Add baseline vote columns to polls
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS baseline_votes_a integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baseline_votes_b integer NOT NULL DEFAULT 0;

-- Add a global sunset threshold setting (reuses daily_poll_settings pattern)
CREATE TABLE IF NOT EXISTS public.seeding_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_sunset_threshold integer NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.seeding_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seeding settings"
  ON public.seeding_settings FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins manage seeding settings"
  ON public.seeding_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed a default row
INSERT INTO public.seeding_settings (baseline_sunset_threshold)
SELECT 50
WHERE NOT EXISTS (SELECT 1 FROM public.seeding_settings);

-- Helper view: effective vote counts (real + baseline until sunset)
CREATE OR REPLACE VIEW public.poll_effective_counts AS
WITH settings AS (
  SELECT baseline_sunset_threshold FROM public.seeding_settings LIMIT 1
),
real_counts AS (
  SELECT
    p.id AS poll_id,
    COALESCE(SUM(CASE WHEN v.choice = 'A' THEN 1 ELSE 0 END), 0)::int AS real_votes_a,
    COALESCE(SUM(CASE WHEN v.choice = 'B' THEN 1 ELSE 0 END), 0)::int AS real_votes_b
  FROM public.polls p
  LEFT JOIN public.votes v ON v.poll_id = p.id
  GROUP BY p.id
)
SELECT
  p.id AS poll_id,
  rc.real_votes_a,
  rc.real_votes_b,
  (rc.real_votes_a + rc.real_votes_b) AS real_total,
  p.baseline_votes_a,
  p.baseline_votes_b,
  CASE
    WHEN (rc.real_votes_a + rc.real_votes_b) >= s.baseline_sunset_threshold THEN false
    ELSE true
  END AS baseline_active,
  CASE
    WHEN (rc.real_votes_a + rc.real_votes_b) >= s.baseline_sunset_threshold THEN rc.real_votes_a
    ELSE rc.real_votes_a + p.baseline_votes_a
  END AS effective_votes_a,
  CASE
    WHEN (rc.real_votes_a + rc.real_votes_b) >= s.baseline_sunset_threshold THEN rc.real_votes_b
    ELSE rc.real_votes_b + p.baseline_votes_b
  END AS effective_votes_b
FROM public.polls p
LEFT JOIN real_counts rc ON rc.poll_id = p.id
CROSS JOIN settings s;