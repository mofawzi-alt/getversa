DROP VIEW IF EXISTS public.poll_effective_counts;

CREATE VIEW public.poll_effective_counts
WITH (security_invoker = true) AS
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