
-- Add retention tracking fields
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS first_vote_date date,
ADD COLUMN IF NOT EXISTS total_days_active integer DEFAULT 0;

-- Update handle_vote_rewards to track retention fields
CREATE OR REPLACE FUNCTION public.handle_vote_rewards()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _last_vote_date date;
  _current_streak int;
  _longest_streak int;
  _new_streak int;
  _vote_count int;
  _badge_record record;
  _points_to_add int := 5;
  _first_vote_date date;
BEGIN
  _user_id := NEW.user_id;
  
  SELECT last_vote_date, current_streak, longest_streak, first_vote_date
  INTO _last_vote_date, _current_streak, _longest_streak, _first_vote_date
  FROM users
  WHERE id = _user_id;
  
  -- Calculate new streak
  IF _last_vote_date IS NULL THEN
    _new_streak := 1;
  ELSIF _last_vote_date = CURRENT_DATE THEN
    _new_streak := _current_streak;
  ELSIF _last_vote_date = CURRENT_DATE - INTERVAL '1 day' THEN
    _new_streak := COALESCE(_current_streak, 0) + 1;
  ELSE
    _new_streak := 1;
  END IF;
  
  IF _new_streak > COALESCE(_longest_streak, 0) THEN
    _longest_streak := _new_streak;
  END IF;
  
  -- Update user with retention tracking
  UPDATE users
  SET 
    points = COALESCE(points, 0) + _points_to_add,
    current_streak = _new_streak,
    longest_streak = _longest_streak,
    last_vote_date = CURRENT_DATE,
    first_vote_date = COALESCE(first_vote_date, CURRENT_DATE),
    total_days_active = CASE 
      WHEN _last_vote_date IS NULL OR _last_vote_date < CURRENT_DATE 
      THEN COALESCE(total_days_active, 0) + 1 
      ELSE COALESCE(total_days_active, 0) 
    END
  WHERE id = _user_id;
  
  -- Get total vote count
  SELECT COUNT(*) INTO _vote_count
  FROM votes
  WHERE user_id = _user_id;
  
  -- Check for vote-based badges
  FOR _badge_record IN 
    SELECT b.id, b.requirement_value, b.points_reward
    FROM badges b
    WHERE b.badge_type = 'votes'
      AND b.requirement_value <= _vote_count
      AND NOT EXISTS (
        SELECT 1 FROM user_badges ub 
        WHERE ub.user_id = _user_id AND ub.badge_id = b.id
      )
  LOOP
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (_user_id, _badge_record.id);
    UPDATE users SET points = COALESCE(points, 0) + COALESCE(_badge_record.points_reward, 0) WHERE id = _user_id;
  END LOOP;
  
  -- Check for streak-based badges
  FOR _badge_record IN 
    SELECT b.id, b.requirement_value, b.points_reward
    FROM badges b
    WHERE b.badge_type = 'streak'
      AND b.requirement_value <= _new_streak
      AND NOT EXISTS (
        SELECT 1 FROM user_badges ub 
        WHERE ub.user_id = _user_id AND ub.badge_id = b.id
      )
  LOOP
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (_user_id, _badge_record.id);
    UPDATE users SET points = COALESCE(points, 0) + COALESCE(_badge_record.points_reward, 0) WHERE id = _user_id;
  END LOOP;
  
  RETURN NEW;
END;
$function$;
