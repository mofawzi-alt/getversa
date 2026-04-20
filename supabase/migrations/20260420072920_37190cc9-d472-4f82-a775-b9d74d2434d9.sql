
-- 1. Reschedule the streak reminder cron from 9am Cairo to 7am Cairo
SELECT cron.unschedule('daily-poll-reminder-9am-cairo');

SELECT cron.schedule(
  'daily-poll-reminder-7am-cairo',
  '0 5 * * *',  -- 05:00 UTC = 07:00 Cairo
  $$
  SELECT net.http_post(
    url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/daily-streak-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
    body := '{"triggered_by": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- 2. Move the daily-queue rollover from 9am Cairo to 7am Cairo so users get
--    a fresh queue the moment the morning batch is announced.
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
  _has_voted boolean;
  _onboarding_count integer;
BEGIN
  _queue_date := CASE 
    WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'Africa/Cairo') < 7 
    THEN ((now() AT TIME ZONE 'Africa/Cairo') - INTERVAL '1 day')::date
    ELSE (now() AT TIME ZONE 'Africa/Cairo')::date
  END;
  
  _cairo_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'Africa/Cairo')::integer;
  _seed := abs(hashtext(_queue_date::text || p_user_id::text)) / 2147483647.0;
  
  SELECT EXISTS(SELECT 1 FROM votes v WHERE v.user_id = p_user_id LIMIT 1) INTO _has_voted;
  SELECT COUNT(*) INTO _onboarding_count FROM onboarding_polls;
  
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
        LIMIT (_batch_limit - (SELECT COUNT(*) FROM daily_poll_queues dpq WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date))
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
    RETURN;
  END IF;
  
  -- New queue (no entries yet for today)
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
  
  SELECT u.age_range INTO _user_age_range FROM users u WHERE u.id = p_user_id;
  
  INSERT INTO daily_poll_queues (user_id, poll_id, queue_date, queue_order)
  SELECT p_user_id, sub.id, _queue_date, ROW_NUMBER() OVER ()::integer
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
    ORDER BY 
      (CASE WHEN _user_age_range IS NOT NULL AND p.target_age_range = _user_age_range THEN 0 ELSE 1 END),
      COALESCE(vc.vote_count, 0) DESC,
      p.created_at DESC
    LIMIT _batch_limit
  ) sub;
  
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
