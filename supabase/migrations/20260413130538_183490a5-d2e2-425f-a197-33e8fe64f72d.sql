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
BEGIN
  -- Calculate queue date (9am Cairo reset = UTC+2/+3)
  _queue_date := CASE 
    WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'Africa/Cairo') < 9 
    THEN ((now() AT TIME ZONE 'Africa/Cairo') - INTERVAL '1 day')::date
    ELSE (now() AT TIME ZONE 'Africa/Cairo')::date
  END;
  
  -- If queue exists for today, just return it
  IF EXISTS (SELECT 1 FROM daily_poll_queues dpq WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date) THEN
    RETURN QUERY SELECT dpq.poll_id, dpq.queue_order 
    FROM daily_poll_queues dpq 
    WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date
    ORDER BY dpq.queue_order;
    RETURN;
  END IF;
  
  -- Get settings
  SELECT ds.daily_limit, ds.first_day_limit INTO _limit, _first_day_limit 
  FROM daily_poll_settings ds LIMIT 1;
  _limit := COALESCE(_limit, 15);
  _first_day_limit := COALESCE(_first_day_limit, 20);
  
  -- Check if first day user
  SELECT (u.first_vote_date IS NULL) INTO _is_first_day
  FROM users u WHERE u.id = p_user_id;
  
  _actual_limit := CASE WHEN COALESCE(_is_first_day, true) THEN _first_day_limit ELSE _limit END;
  
  -- Get user age range
  SELECT u.age_range INTO _user_age_range FROM users u WHERE u.id = p_user_id;
  
  -- Generate and insert queue: taste-matched first, then age-targeted, then trending
  INSERT INTO daily_poll_queues (user_id, poll_id, queue_date, queue_order)
  SELECT p_user_id, sub.id, _queue_date, ROW_NUMBER() OVER ()::integer
  FROM (
    SELECT p.id,
      -- Taste score: count how many of user's voted categories match this poll
      COALESCE((
        SELECT COUNT(*)
        FROM votes v
        WHERE v.user_id = p_user_id AND v.category IS NOT NULL AND v.category = p.category
      ), 0) as category_match_count,
      -- Tag match: check if poll's option tags match user's preferred tags
      COALESCE((
        SELECT COUNT(*)
        FROM (
          SELECT CASE WHEN v2.choice = 'A' THEN p2.option_a_tag ELSE p2.option_b_tag END AS trait_tag
          FROM votes v2
          JOIN polls p2 ON p2.id = v2.poll_id
          WHERE v2.user_id = p_user_id
            AND CASE WHEN v2.choice = 'A' THEN p2.option_a_tag ELSE p2.option_b_tag END IS NOT NULL
            AND CASE WHEN v2.choice = 'A' THEN p2.option_a_tag ELSE p2.option_b_tag END IN (p.option_a_tag, p.option_b_tag)
        ) tag_matches
      ), 0) as tag_match_count
    FROM polls p
    LEFT JOIN (
      SELECT v.poll_id, COUNT(*) as vote_count 
      FROM votes v 
      GROUP BY v.poll_id
    ) vc ON vc.poll_id = p.id
    WHERE p.is_active = true
      AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.poll_id = p.id AND v.user_id = p_user_id)
      AND NOT EXISTS (SELECT 1 FROM skipped_polls s WHERE s.poll_id = p.id AND s.user_id = p_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM daily_poll_queues dq 
        WHERE dq.poll_id = p.id AND dq.user_id = p_user_id
      )
    ORDER BY
      -- 1. Taste match (category + tags combined)
      (COALESCE((
        SELECT COUNT(*)
        FROM votes v
        WHERE v.user_id = p_user_id AND v.category IS NOT NULL AND v.category = p.category
      ), 0) * 2 + COALESCE((
        SELECT COUNT(*)
        FROM (
          SELECT CASE WHEN v2.choice = 'A' THEN p2.option_a_tag ELSE p2.option_b_tag END AS trait_tag
          FROM votes v2
          JOIN polls p2 ON p2.id = v2.poll_id
          WHERE v2.user_id = p_user_id
            AND CASE WHEN v2.choice = 'A' THEN p2.option_a_tag ELSE p2.option_b_tag END IS NOT NULL
            AND CASE WHEN v2.choice = 'A' THEN p2.option_a_tag ELSE p2.option_b_tag END IN (p.option_a_tag, p.option_b_tag)
        ) tag_matches
      ), 0)) DESC,
      -- 2. Age targeting match
      CASE WHEN _user_age_range IS NOT NULL AND p.target_age_range = _user_age_range THEN 0 ELSE 1 END,
      -- 3. Admin weight (as a boost, not override)
      COALESCE(p.weight_score, 500) DESC,
      -- 4. Trending (vote count)
      COALESCE(vc.vote_count, 0) DESC,
      -- 5. Newest first
      p.created_at DESC
    LIMIT _actual_limit
  ) sub;
  
  -- Return the generated queue
  RETURN QUERY SELECT dpq.poll_id, dpq.queue_order 
  FROM daily_poll_queues dpq 
  WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date
  ORDER BY dpq.queue_order;
END;
$function$;