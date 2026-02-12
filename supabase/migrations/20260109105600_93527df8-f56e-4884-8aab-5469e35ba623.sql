-- Function to update user streak and points after voting
CREATE OR REPLACE FUNCTION public.handle_vote_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _last_vote_date date;
  _current_streak int;
  _longest_streak int;
  _new_streak int;
  _vote_count int;
  _badge_record record;
  _points_to_add int := 5; -- Base points per vote
BEGIN
  _user_id := NEW.user_id;
  
  -- Get user's current streak info
  SELECT last_vote_date, current_streak, longest_streak
  INTO _last_vote_date, _current_streak, _longest_streak
  FROM users
  WHERE id = _user_id;
  
  -- Calculate new streak
  IF _last_vote_date IS NULL THEN
    -- First vote ever
    _new_streak := 1;
  ELSIF _last_vote_date = CURRENT_DATE THEN
    -- Already voted today, keep same streak
    _new_streak := _current_streak;
  ELSIF _last_vote_date = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Voted yesterday, increment streak
    _new_streak := COALESCE(_current_streak, 0) + 1;
  ELSE
    -- Streak broken, reset to 1
    _new_streak := 1;
  END IF;
  
  -- Update longest streak if needed
  IF _new_streak > COALESCE(_longest_streak, 0) THEN
    _longest_streak := _new_streak;
  END IF;
  
  -- Update user's points and streak
  UPDATE users
  SET 
    points = COALESCE(points, 0) + _points_to_add,
    current_streak = _new_streak,
    longest_streak = _longest_streak,
    last_vote_date = CURRENT_DATE
  WHERE id = _user_id;
  
  -- Get total vote count for this user
  SELECT COUNT(*) INTO _vote_count
  FROM votes
  WHERE user_id = _user_id;
  
  -- Check for vote-based badges user hasn't earned yet
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
    -- Award the badge
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (_user_id, _badge_record.id);
    
    -- Award badge points
    UPDATE users
    SET points = COALESCE(points, 0) + COALESCE(_badge_record.points_reward, 0)
    WHERE id = _user_id;
  END LOOP;
  
  -- Check for streak-based badges user hasn't earned yet
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
    -- Award the badge
    INSERT INTO user_badges (user_id, badge_id)
    VALUES (_user_id, _badge_record.id);
    
    -- Award badge points
    UPDATE users
    SET points = COALESCE(points, 0) + COALESCE(_badge_record.points_reward, 0)
    WHERE id = _user_id;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for vote rewards
DROP TRIGGER IF EXISTS on_vote_created ON votes;
CREATE TRIGGER on_vote_created
  AFTER INSERT ON votes
  FOR EACH ROW
  EXECUTE FUNCTION handle_vote_rewards();

-- Also add INSERT policy for user_badges so the trigger can insert badges
DROP POLICY IF EXISTS "System can insert badges" ON user_badges;
CREATE POLICY "System can insert badges"
  ON user_badges
  FOR INSERT
  WITH CHECK (true);