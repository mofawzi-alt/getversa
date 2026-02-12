-- Create a security definer function to get poll results without exposing individual votes
CREATE OR REPLACE FUNCTION public.get_poll_results(poll_ids uuid[])
RETURNS TABLE(
  poll_id uuid,
  total_votes bigint,
  votes_a bigint,
  votes_b bigint,
  percent_a integer,
  percent_b integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.poll_id,
    COUNT(*)::bigint as total_votes,
    COUNT(*) FILTER (WHERE v.choice = 'A')::bigint as votes_a,
    COUNT(*) FILTER (WHERE v.choice = 'B')::bigint as votes_b,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE v.choice = 'A')::numeric / COUNT(*)) * 100)::integer
      ELSE 0
    END as percent_a,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE v.choice = 'B')::numeric / COUNT(*)) * 100)::integer
      ELSE 0
    END as percent_b
  FROM votes v
  WHERE v.poll_id = ANY(poll_ids)
  GROUP BY v.poll_id;
END;
$$;