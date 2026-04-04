
CREATE OR REPLACE FUNCTION public.get_demographic_poll_result(
  p_poll_id uuid,
  p_age_range text DEFAULT NULL,
  p_city text DEFAULT NULL
)
RETURNS TABLE(
  total_votes bigint,
  percent_a integer,
  percent_b integer,
  demo_total bigint,
  demo_percent_a integer,
  demo_percent_b integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Global results
    COUNT(*)::bigint AS total_votes,
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE v.choice = 'A')::numeric / COUNT(*)) * 100)::integer ELSE 0 END AS percent_a,
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE v.choice = 'B')::numeric / COUNT(*)) * 100)::integer ELSE 0 END AS percent_b,
    -- Demographic-filtered results
    COUNT(*) FILTER (WHERE
      (p_age_range IS NULL OR v.voter_age_range = p_age_range)
      AND (p_city IS NULL OR v.voter_city = p_city)
    )::bigint AS demo_total,
    CASE WHEN COUNT(*) FILTER (WHERE
      (p_age_range IS NULL OR v.voter_age_range = p_age_range)
      AND (p_city IS NULL OR v.voter_city = p_city)
    ) > 0 THEN
      ROUND(
        (COUNT(*) FILTER (WHERE v.choice = 'A'
          AND (p_age_range IS NULL OR v.voter_age_range = p_age_range)
          AND (p_city IS NULL OR v.voter_city = p_city)
        )::numeric /
        COUNT(*) FILTER (WHERE
          (p_age_range IS NULL OR v.voter_age_range = p_age_range)
          AND (p_city IS NULL OR v.voter_city = p_city)
        )) * 100
      )::integer
    ELSE 0 END AS demo_percent_a,
    CASE WHEN COUNT(*) FILTER (WHERE
      (p_age_range IS NULL OR v.voter_age_range = p_age_range)
      AND (p_city IS NULL OR v.voter_city = p_city)
    ) > 0 THEN
      ROUND(
        (COUNT(*) FILTER (WHERE v.choice = 'B'
          AND (p_age_range IS NULL OR v.voter_age_range = p_age_range)
          AND (p_city IS NULL OR v.voter_city = p_city)
        )::numeric /
        COUNT(*) FILTER (WHERE
          (p_age_range IS NULL OR v.voter_age_range = p_age_range)
          AND (p_city IS NULL OR v.voter_city = p_city)
        )) * 100
      )::integer
    ELSE 0 END AS demo_percent_b
  FROM votes v
  WHERE v.poll_id = p_poll_id;
END;
$$;
