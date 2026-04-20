CREATE OR REPLACE FUNCTION public.generate_daily_queue(p_user_id uuid)
 RETURNS TABLE(poll_id uuid, queue_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _queue_date date;
  _limit integer := 10;
  _first_day_limit integer := 10;
  _is_first_day boolean;
  _user_age_range text;
  _actual_limit integer;
  _has_voted boolean;
  _onboarding_count integer;
  _current_count integer;
BEGIN
  -- Cairo "day" rolls over at 7 AM
  _queue_date := CASE 
    WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'Africa/Cairo') < 7 
    THEN ((now() AT TIME ZONE 'Africa/Cairo') - INTERVAL '1 day')::date
    ELSE (now() AT TIME ZONE 'Africa/Cairo')::date
  END;
  
  SELECT EXISTS(SELECT 1 FROM votes v WHERE v.user_id = p_user_id LIMIT 1) INTO _has_voted;
  SELECT COUNT(*) INTO _onboarding_count FROM onboarding_polls;
  
  -- First-time user: serve onboarding polls
  IF NOT _has_voted AND _onboarding_count > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM daily_poll_queues dpq
      WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date
    ) THEN
      INSERT INTO daily_poll_queues (user_id, poll_id, queue_date, queue_order)
      SELECT p_user_id, op.poll_id, _queue_date,
             ROW_NUMBER() OVER (ORDER BY md5(op.poll_id::text || p_user_id::text))::integer
      FROM onboarding_polls op
      JOIN polls p ON p.id = op.poll_id
      WHERE p.is_active = true;
    END IF;
    
    RETURN QUERY
    SELECT dpq.poll_id, dpq.queue_order
    FROM daily_poll_queues dpq
    JOIN polls p ON p.id = dpq.poll_id
    WHERE dpq.user_id = p_user_id
      AND dpq.queue_date = _queue_date
      AND p.is_active = true
      AND NOT public.is_poll_expired(p.expiry_type, p.ends_at)
    ORDER BY dpq.queue_order;
    RETURN;
  END IF;
  
  -- Read configured limits (default 10/10)
  SELECT ds.daily_limit, ds.first_day_limit INTO _limit, _first_day_limit 
  FROM daily_poll_settings ds LIMIT 1;
  _limit := COALESCE(_limit, 10);
  _first_day_limit := COALESCE(_first_day_limit, 10);
  
  SELECT (u.first_vote_date IS NULL) INTO _is_first_day
  FROM users u WHERE u.id = p_user_id;
  _actual_limit := CASE WHEN COALESCE(_is_first_day, true) THEN _first_day_limit ELSE _limit END;
  
  -- Always fill queue to FULL daily limit at 7 AM (no time-of-day batching)
  SELECT COUNT(*) INTO _current_count 
  FROM daily_poll_queues dpq 
  WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date;
  
  IF _current_count < _actual_limit THEN
    SELECT u.age_range INTO _user_age_range FROM users u WHERE u.id = p_user_id;
    
    INSERT INTO daily_poll_queues (user_id, poll_id, queue_date, queue_order)
    SELECT p_user_id, sub.id, _queue_date, 
      _current_count + ROW_NUMBER() OVER ()::integer
    FROM (
      SELECT p.id
      FROM polls p
      LEFT JOIN (SELECT v.poll_id, COUNT(*) as vote_count FROM votes v GROUP BY v.poll_id) vc ON vc.poll_id = p.id
      LEFT JOIN poll_campaigns pc ON pc.id = p.campaign_id
      WHERE p.is_active = true
        AND NOT public.is_poll_expired(p.expiry_type, p.ends_at)
        AND (p.campaign_id IS NULL OR (
          COALESCE(pc.visibility_mode, 'mixed') NOT IN ('bundle_only', 'panel_only')
          AND COALESCE(pc.campaign_type, 'standard') <> 'focus_group'
        ))
        AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.poll_id = p.id AND v.user_id = p_user_id)
        AND NOT EXISTS (SELECT 1 FROM daily_poll_queues dq3 WHERE dq3.poll_id = p.id AND dq3.user_id = p_user_id AND dq3.queue_date = _queue_date)
      ORDER BY 
        (CASE WHEN _user_age_range IS NOT NULL AND p.target_age_range = _user_age_range THEN 0 ELSE 1 END),
        COALESCE(vc.vote_count, 0) DESC,
        p.created_at DESC
      LIMIT (_actual_limit - _current_count)
    ) sub;
  END IF;
  
  RETURN QUERY
  SELECT dpq.poll_id, dpq.queue_order
  FROM daily_poll_queues dpq
  JOIN polls p ON p.id = dpq.poll_id
  WHERE dpq.user_id = p_user_id
    AND dpq.queue_date = _queue_date
    AND p.is_active = true
    AND NOT public.is_poll_expired(p.expiry_type, p.ends_at)
  ORDER BY dpq.queue_order;
END;
$function$;