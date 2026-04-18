CREATE OR REPLACE FUNCTION public.get_campaign_demographics(p_campaign_id uuid)
RETURNS TABLE(segment_type text, segment_value text, choice text, vote_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.is_campaign_client(auth.uid(), p_campaign_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this campaign';
  END IF;

  -- Returns unique people per segment (choice = 'ALL' means unique audience reach, not per-choice split)
  RETURN QUERY
  SELECT 'gender'::text, COALESCE(v.voter_gender, 'unknown'), 'ALL'::text, COUNT(DISTINCT v.user_id)::bigint
  FROM votes v
  JOIN polls p ON p.id = v.poll_id
  WHERE p.campaign_id = p_campaign_id
  GROUP BY v.voter_gender
  UNION ALL
  SELECT 'age'::text, COALESCE(v.voter_age_range, 'unknown'), 'ALL'::text, COUNT(DISTINCT v.user_id)::bigint
  FROM votes v
  JOIN polls p ON p.id = v.poll_id
  WHERE p.campaign_id = p_campaign_id
  GROUP BY v.voter_age_range
  UNION ALL
  SELECT 'city'::text, COALESCE(v.voter_city, 'unknown'), 'ALL'::text, COUNT(DISTINCT v.user_id)::bigint
  FROM votes v
  JOIN polls p ON p.id = v.poll_id
  WHERE p.campaign_id = p_campaign_id
  GROUP BY v.voter_city;
END;
$function$;