
DROP FUNCTION IF EXISTS public.get_insight_profile(uuid);

CREATE FUNCTION public.get_insight_profile(p_user_id uuid)
RETURNS TABLE(dimension_name text, tendency text, score numeric, vote_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.name::text as dimension_name,
    CASE
      WHEN uds.score > 3 THEN 'strong_a'
      WHEN uds.score > 0 THEN 'lean_a'
      WHEN uds.score = 0 THEN 'balanced'
      WHEN uds.score > -3 THEN 'lean_b'
      ELSE 'strong_b'
    END as tendency,
    uds.score as score,
    uds.vote_count::integer as vote_count
  FROM user_dimension_scores uds
  JOIN dimensions d ON d.id = uds.dimension_id
  WHERE uds.user_id = p_user_id
    AND uds.vote_count >= 2
  ORDER BY uds.vote_count DESC;
END;
$$;
