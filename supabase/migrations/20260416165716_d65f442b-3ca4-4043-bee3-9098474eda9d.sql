
CREATE OR REPLACE FUNCTION public.get_dimension_compatibility(user_a uuid, user_b uuid)
RETURNS TABLE(
  dimension_name text,
  user_a_score numeric,
  user_b_score numeric,
  alignment numeric,
  shared_dimensions integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH a_scores AS (
    SELECT uds.dimension_id, uds.score, uds.vote_count
    FROM user_dimension_scores uds WHERE uds.user_id = user_a AND uds.vote_count >= 2
  ),
  b_scores AS (
    SELECT uds.dimension_id, uds.score, uds.vote_count
    FROM user_dimension_scores uds WHERE uds.user_id = user_b AND uds.vote_count >= 2
  ),
  shared AS (
    SELECT 
      d.name as dim_name,
      a.score as a_score,
      b.score as b_score,
      -- Alignment: 1.0 when same direction, 0.0 when opposite
      CASE 
        WHEN SIGN(a.score) = SIGN(b.score) THEN 
          1.0 - (ABS(a.score - b.score) / (GREATEST(ABS(a.score), ABS(b.score)) * 2 + 1))
        ELSE 
          0.5 - (ABS(a.score - b.score) / (GREATEST(ABS(a.score), ABS(b.score)) * 4 + 2))
      END as align_score
    FROM a_scores a
    JOIN b_scores b ON a.dimension_id = b.dimension_id
    JOIN dimensions d ON d.id = a.dimension_id
  )
  SELECT 
    s.dim_name::text as dimension_name,
    s.a_score as user_a_score,
    s.b_score as user_b_score,
    ROUND(GREATEST(s.align_score, 0) * 100)::numeric as alignment,
    (SELECT COUNT(*)::integer FROM shared) as shared_dimensions
  FROM shared s
  ORDER BY s.align_score DESC;
END;
$$;
