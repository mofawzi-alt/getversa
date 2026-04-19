DROP FUNCTION IF EXISTS public.get_poll_results(uuid[]);

CREATE OR REPLACE FUNCTION public.get_poll_results(poll_ids uuid[])
 RETURNS TABLE(poll_id uuid, total_votes bigint, votes_a bigint, votes_b bigint, percent_a integer, percent_b integer, real_total bigint, baseline_active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  threshold int;
BEGIN
  SELECT baseline_sunset_threshold INTO threshold FROM public.seeding_settings LIMIT 1;
  IF threshold IS NULL THEN threshold := 50; END IF;

  RETURN QUERY
  WITH real_counts AS (
    SELECT
      p.id AS pid,
      COALESCE(p.baseline_votes_a, 0) AS base_a,
      COALESCE(p.baseline_votes_b, 0) AS base_b,
      COUNT(v.id) FILTER (WHERE v.choice = 'A')::bigint AS r_a,
      COUNT(v.id) FILTER (WHERE v.choice = 'B')::bigint AS r_b
    FROM public.polls p
    LEFT JOIN public.votes v ON v.poll_id = p.id
    WHERE p.id = ANY(poll_ids)
    GROUP BY p.id, p.baseline_votes_a, p.baseline_votes_b
  ),
  merged AS (
    SELECT
      pid,
      r_a,
      r_b,
      (r_a + r_b) AS r_total,
      CASE WHEN (r_a + r_b) >= threshold THEN false ELSE true END AS base_active,
      CASE WHEN (r_a + r_b) >= threshold THEN r_a ELSE r_a + base_a END AS eff_a,
      CASE WHEN (r_a + r_b) >= threshold THEN r_b ELSE r_b + base_b END AS eff_b
    FROM real_counts
  )
  SELECT
    m.pid AS poll_id,
    (m.eff_a + m.eff_b)::bigint AS total_votes,
    m.eff_a::bigint AS votes_a,
    m.eff_b::bigint AS votes_b,
    CASE WHEN (m.eff_a + m.eff_b) > 0
      THEN ROUND((m.eff_a::numeric / (m.eff_a + m.eff_b)) * 100)::integer
      ELSE 0 END AS percent_a,
    CASE WHEN (m.eff_a + m.eff_b) > 0
      THEN ROUND((m.eff_b::numeric / (m.eff_a + m.eff_b)) * 100)::integer
      ELSE 0 END AS percent_b,
    m.r_total::bigint AS real_total,
    m.base_active AS baseline_active
  FROM merged m;
END;
$function$;