
CREATE OR REPLACE FUNCTION public.update_user_dimension_scores(
  p_user_id uuid,
  p_poll_id uuid,
  p_choice text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dim_row RECORD;
BEGIN
  FOR dim_row IN
    SELECT pd.dimension_id, pd.weight_a, pd.weight_b
    FROM poll_dimensions pd
    WHERE pd.poll_id = p_poll_id
  LOOP
    INSERT INTO user_dimension_scores (user_id, dimension_id, score, vote_count, last_updated)
    VALUES (
      p_user_id,
      dim_row.dimension_id,
      CASE WHEN upper(p_choice) = 'A' THEN dim_row.weight_a ELSE dim_row.weight_b END,
      1,
      now()
    )
    ON CONFLICT (user_id, dimension_id)
    DO UPDATE SET
      score = (user_dimension_scores.score * user_dimension_scores.vote_count +
               CASE WHEN upper(p_choice) = 'A' THEN dim_row.weight_a ELSE dim_row.weight_b END)
              / (user_dimension_scores.vote_count + 1),
      vote_count = user_dimension_scores.vote_count + 1,
      last_updated = now();
  END LOOP;
END;
$$;
