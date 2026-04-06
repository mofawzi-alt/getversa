
-- Daily poll settings (admin-configurable)
CREATE TABLE IF NOT EXISTS daily_poll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_limit integer NOT NULL DEFAULT 15,
  first_day_limit integer NOT NULL DEFAULT 20,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE daily_poll_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage daily settings" ON daily_poll_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view daily settings" ON daily_poll_settings
  FOR SELECT TO authenticated
  USING (true);

-- Insert default settings
INSERT INTO daily_poll_settings (daily_limit, first_day_limit) VALUES (15, 20);

-- Daily poll queues per user
CREATE TABLE IF NOT EXISTS daily_poll_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  queue_date date NOT NULL,
  queue_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, poll_id, queue_date)
);

CREATE INDEX idx_daily_poll_queues_user_date ON daily_poll_queues(user_id, queue_date);

ALTER TABLE daily_poll_queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own queue" ON daily_poll_queues
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Function to generate daily queue (called lazily on app load)
CREATE OR REPLACE FUNCTION generate_daily_queue(p_user_id uuid)
RETURNS TABLE(poll_id uuid, queue_order integer) AS $$
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
  
  -- Check if first day user (never voted before or first vote is today)
  SELECT (u.first_vote_date IS NULL) INTO _is_first_day
  FROM users u WHERE u.id = p_user_id;
  
  _actual_limit := CASE WHEN COALESCE(_is_first_day, true) THEN _first_day_limit ELSE _limit END;
  
  -- Get user age range for prioritization
  SELECT u.age_range INTO _user_age_range FROM users u WHERE u.id = p_user_id;
  
  -- Generate and insert queue: age-targeted first, then most voted, then newest
  INSERT INTO daily_poll_queues (user_id, poll_id, queue_date, queue_order)
  SELECT p_user_id, sub.id, _queue_date, ROW_NUMBER() OVER ()::integer
  FROM (
    SELECT p.id
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
      CASE WHEN _user_age_range IS NOT NULL AND p.target_age_range = _user_age_range THEN 0 ELSE 1 END,
      COALESCE(p.weight_score, 1) DESC,
      COALESCE(vc.vote_count, 0) DESC,
      p.created_at DESC
    LIMIT _actual_limit
  ) sub;
  
  -- Return the generated queue
  RETURN QUERY SELECT dpq.poll_id, dpq.queue_order 
  FROM daily_poll_queues dpq 
  WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date
  ORDER BY dpq.queue_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
