CREATE OR REPLACE FUNCTION public.generate_daily_queue(p_user_id uuid)
 RETURNS TABLE(poll_id uuid, queue_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _queue_date date;
  _limit integer := 15;
  _first_day_limit integer := 20;
  _is_first_day boolean;
  _user_age_range text;
  _actual_limit integer;
  _cairo_hour integer;
  _batch_limit integer;
  _seed double precision;
BEGIN
  _queue_date := CASE 
    WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'Africa/Cairo') < 9 
    THEN ((now() AT TIME ZONE 'Africa/Cairo') - INTERVAL '1 day')::date
    ELSE (now() AT TIME ZONE 'Africa/Cairo')::date
  END;
  
  _cairo_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'Africa/Cairo')::integer;
  _seed := abs(hashtext(_queue_date::text || p_user_id::text)) / 2147483647.0;
  
  IF EXISTS (SELECT 1 FROM daily_poll_queues dpq WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date) THEN
    SELECT ds.daily_limit, ds.first_day_limit INTO _limit, _first_day_limit 
    FROM daily_poll_settings ds LIMIT 1;
    _limit := COALESCE(_limit, 15);
    _first_day_limit := COALESCE(_first_day_limit, 20);
    
    SELECT (u.first_vote_date IS NULL) INTO _is_first_day
    FROM users u WHERE u.id = p_user_id;
    _actual_limit := CASE WHEN COALESCE(_is_first_day, true) THEN _first_day_limit ELSE _limit END;
    
    IF _cairo_hour >= 19 THEN
      _batch_limit := _actual_limit;
    ELSIF _cairo_hour >= 14 THEN
      _batch_limit := CEIL(_actual_limit * 0.7);
    ELSE
      _batch_limit := CEIL(_actual_limit * 0.4);
    END IF;
    
    IF (SELECT COUNT(*) FROM daily_poll_queues dpq WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date) < _batch_limit THEN
      SELECT u.age_range INTO _user_age_range FROM users u WHERE u.id = p_user_id;
      
      INSERT INTO daily_poll_queues (user_id, poll_id, queue_date, queue_order)
      SELECT p_user_id, sub.id, _queue_date, 
        (SELECT COALESCE(MAX(dq2.queue_order), 0) FROM daily_poll_queues dq2 WHERE dq2.user_id = p_user_id AND dq2.queue_date = _queue_date) + ROW_NUMBER() OVER ()::integer
      FROM (
        SELECT p.id
        FROM polls p
        LEFT JOIN (SELECT v.poll_id, COUNT(*) as vote_count FROM votes v GROUP BY v.poll_id) vc ON vc.poll_id = p.id
        WHERE p.is_active = true
          AND NOT public.is_poll_expired(p.expiry_type, p.ends_at)
          AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.poll_id = p.id AND v.user_id = p_user_id)
          AND NOT EXISTS (SELECT 1 FROM skipped_polls s WHERE s.poll_id = p.id AND s.user_id = p_user_id)
          AND NOT EXISTS (SELECT 1 FROM daily_poll_queues dq WHERE dq.poll_id = p.id AND dq.user_id = p_user_id)
        ORDER BY
          CASE WHEN p.is_hot_take = true THEN 0 ELSE 1 END,
          CASE WHEN p.created_at >= (now() - INTERVAL '24 hours') THEN 0 ELSE 1 END,
          COALESCE(p.weight_score, 500) DESC,
          COALESCE(vc.vote_count, 0) DESC,
          md5(p.id::text || _queue_date::text || p_user_id::text)
        LIMIT (_batch_limit - (SELECT COUNT(*) FROM daily_poll_queues dpq WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date))
      ) sub;
    END IF;
    
    -- Return queue, but skip polls that have since expired
    RETURN QUERY 
    SELECT dpq.poll_id, dpq.queue_order 
    FROM daily_poll_queues dpq 
    JOIN polls p ON p.id = dpq.poll_id
    WHERE dpq.user_id = p_user_id 
      AND dpq.queue_date = _queue_date
      AND dpq.queue_order <= _batch_limit
      AND p.is_active = true
      AND NOT public.is_poll_expired(p.expiry_type, p.ends_at)
    ORDER BY dpq.queue_order;
    RETURN;
  END IF;
  
  -- First generation of the day
  SELECT ds.daily_limit, ds.first_day_limit INTO _limit, _first_day_limit 
  FROM daily_poll_settings ds LIMIT 1;
  _limit := COALESCE(_limit, 15);
  _first_day_limit := COALESCE(_first_day_limit, 20);
  
  SELECT (u.first_vote_date IS NULL) INTO _is_first_day
  FROM users u WHERE u.id = p_user_id;
  _actual_limit := CASE WHEN COALESCE(_is_first_day, true) THEN _first_day_limit ELSE _limit END;
  
  SELECT u.age_range INTO _user_age_range FROM users u WHERE u.id = p_user_id;
  
  IF _cairo_hour >= 19 THEN
    _batch_limit := _actual_limit;
  ELSIF _cairo_hour >= 14 THEN
    _batch_limit := CEIL(_actual_limit * 0.7);
  ELSE
    _batch_limit := CEIL(_actual_limit * 0.4);
  END IF;
  
  INSERT INTO daily_poll_queues (user_id, poll_id, queue_date, queue_order)
  SELECT p_user_id, sub.id, _queue_date, ROW_NUMBER() OVER ()::integer
  FROM (
    SELECT p.id
    FROM polls p
    LEFT JOIN (SELECT v.poll_id, COUNT(*) as vote_count FROM votes v GROUP BY v.poll_id) vc ON vc.poll_id = p.id
    WHERE p.is_active = true
      AND NOT public.is_poll_expired(p.expiry_type, p.ends_at)
      AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.poll_id = p.id AND v.user_id = p_user_id)
      AND NOT EXISTS (SELECT 1 FROM skipped_polls s WHERE s.poll_id = p.id AND s.user_id = p_user_id)
      AND NOT EXISTS (SELECT 1 FROM daily_poll_queues dq WHERE dq.poll_id = p.id AND dq.user_id = p_user_id)
    ORDER BY
      CASE WHEN p.is_hot_take = true THEN 0 ELSE 1 END,
      CASE WHEN p.created_at >= (now() - INTERVAL '24 hours') THEN 0 ELSE 1 END,
      (
        COALESCE(p.weight_score, 500) * 0.4
        + LEAST(COALESCE(vc.vote_count, 0), 500) * 0.3
        + (abs(hashtext(p.id::text || _queue_date::text || p_user_id::text)) % 500) * 0.3
      ) DESC,
      md5(p.id::text || _queue_date::text || p_user_id::text)
    LIMIT _actual_limit
  ) sub;
  
  RETURN QUERY 
  SELECT dpq.poll_id, dpq.queue_order 
  FROM daily_poll_queues dpq 
  JOIN polls p ON p.id = dpq.poll_id
  WHERE dpq.user_id = p_user_id 
    AND dpq.queue_date = _queue_date
    AND dpq.queue_order <= _batch_limit
    AND p.is_active = true
    AND NOT public.is_poll_expired(p.expiry_type, p.ends_at)
  ORDER BY dpq.queue_order;
END;
$function$;