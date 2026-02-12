-- Add compatibility badges
INSERT INTO public.badges (name, description, badge_type, requirement_value, points_reward, icon_url)
VALUES 
  ('Best Friends', 'Reached 90%+ compatibility with a friend', 'compatibility', 90, 50, '💕'),
  ('Great Match', 'Reached 75%+ compatibility with a friend', 'compatibility', 75, 25, '💫'),
  ('Vote Buddy', 'Reached 50%+ compatibility with a friend', 'compatibility', 50, 10, '🤝');

-- Function to check and award compatibility badges
CREATE OR REPLACE FUNCTION public.check_compatibility_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _friend_id uuid;
  _score integer;
  _badge_record record;
BEGIN
  -- Get both users from the friendship
  IF NEW.status = 'accepted' THEN
    _user_id := NEW.requester_id;
    _friend_id := NEW.recipient_id;
    
    -- Check compatibility for requester
    _score := public.get_compatibility_score(_user_id, _friend_id);
    
    IF _score IS NOT NULL THEN
      -- Award compatibility badges to requester
      FOR _badge_record IN 
        SELECT b.id, b.requirement_value, b.points_reward
        FROM badges b
        WHERE b.badge_type = 'compatibility'
          AND b.requirement_value <= _score
          AND NOT EXISTS (
            SELECT 1 FROM user_badges ub 
            WHERE ub.user_id = _user_id AND ub.badge_id = b.id
          )
      LOOP
        INSERT INTO user_badges (user_id, badge_id)
        VALUES (_user_id, _badge_record.id);
        
        UPDATE users
        SET points = COALESCE(points, 0) + COALESCE(_badge_record.points_reward, 0)
        WHERE id = _user_id;
      END LOOP;
      
      -- Award compatibility badges to recipient
      FOR _badge_record IN 
        SELECT b.id, b.requirement_value, b.points_reward
        FROM badges b
        WHERE b.badge_type = 'compatibility'
          AND b.requirement_value <= _score
          AND NOT EXISTS (
            SELECT 1 FROM user_badges ub 
            WHERE ub.user_id = _friend_id AND ub.badge_id = b.id
          )
      LOOP
        INSERT INTO user_badges (user_id, badge_id)
        VALUES (_friend_id, _badge_record.id);
        
        UPDATE users
        SET points = COALESCE(points, 0) + COALESCE(_badge_record.points_reward, 0)
        WHERE id = _friend_id;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to check badges when friendship is accepted
CREATE TRIGGER check_compatibility_badges_trigger
  AFTER UPDATE ON public.friendships
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status = 'pending')
  EXECUTE FUNCTION public.check_compatibility_badges();

-- Function to check compatibility badges after voting (for existing friends)
CREATE OR REPLACE FUNCTION public.check_vote_compatibility_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _friend record;
  _score integer;
  _badge_record record;
BEGIN
  -- Get all accepted friends of the voter
  FOR _friend IN 
    SELECT 
      CASE 
        WHEN f.requester_id = NEW.user_id THEN f.recipient_id
        ELSE f.requester_id
      END as friend_id
    FROM friendships f
    WHERE f.status = 'accepted'
      AND (f.requester_id = NEW.user_id OR f.recipient_id = NEW.user_id)
  LOOP
    _score := public.get_compatibility_score(NEW.user_id, _friend.friend_id);
    
    IF _score IS NOT NULL THEN
      -- Award badges to voter
      FOR _badge_record IN 
        SELECT b.id, b.requirement_value, b.points_reward
        FROM badges b
        WHERE b.badge_type = 'compatibility'
          AND b.requirement_value <= _score
          AND NOT EXISTS (
            SELECT 1 FROM user_badges ub 
            WHERE ub.user_id = NEW.user_id AND ub.badge_id = b.id
          )
      LOOP
        INSERT INTO user_badges (user_id, badge_id)
        VALUES (NEW.user_id, _badge_record.id);
        
        UPDATE users
        SET points = COALESCE(points, 0) + COALESCE(_badge_record.points_reward, 0)
        WHERE id = NEW.user_id;
      END LOOP;
      
      -- Award badges to friend
      FOR _badge_record IN 
        SELECT b.id, b.requirement_value, b.points_reward
        FROM badges b
        WHERE b.badge_type = 'compatibility'
          AND b.requirement_value <= _score
          AND NOT EXISTS (
            SELECT 1 FROM user_badges ub 
            WHERE ub.user_id = _friend.friend_id AND ub.badge_id = b.id
          )
      LOOP
        INSERT INTO user_badges (user_id, badge_id)
        VALUES (_friend.friend_id, _badge_record.id);
        
        UPDATE users
        SET points = COALESCE(points, 0) + COALESCE(_badge_record.points_reward, 0)
        WHERE id = _friend.friend_id;
      END LOOP;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger to check compatibility badges after voting
CREATE TRIGGER check_vote_compatibility_badges_trigger
  AFTER INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.check_vote_compatibility_badges();

-- Function to get shared vote history between two users
CREATE OR REPLACE FUNCTION public.get_shared_vote_history(user_a UUID, user_b UUID)
RETURNS TABLE(
  poll_id UUID,
  question TEXT,
  option_a TEXT,
  option_b TEXT,
  user_a_choice TEXT,
  user_b_choice TEXT,
  is_match BOOLEAN,
  voted_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as poll_id,
    p.question,
    p.option_a,
    p.option_b,
    v1.choice as user_a_choice,
    v2.choice as user_b_choice,
    (v1.choice = v2.choice) as is_match,
    GREATEST(v1.created_at, v2.created_at) as voted_at
  FROM votes v1
  JOIN votes v2 ON v1.poll_id = v2.poll_id
  JOIN polls p ON p.id = v1.poll_id
  WHERE v1.user_id = user_a AND v2.user_id = user_b
  ORDER BY voted_at DESC;
END;
$$;

-- Function to notify friends when user votes
CREATE OR REPLACE FUNCTION public.notify_friends_on_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _friend record;
  _poll_question text;
  _voter_username text;
BEGIN
  -- Get poll question
  SELECT question INTO _poll_question FROM polls WHERE id = NEW.poll_id;
  
  -- Get voter username
  SELECT username INTO _voter_username FROM users WHERE id = NEW.user_id;
  
  -- Notify all friends who haven't voted on this poll yet
  FOR _friend IN 
    SELECT 
      CASE 
        WHEN f.requester_id = NEW.user_id THEN f.recipient_id
        ELSE f.requester_id
      END as friend_id
    FROM friendships f
    WHERE f.status = 'accepted'
      AND (f.requester_id = NEW.user_id OR f.recipient_id = NEW.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM votes v 
        WHERE v.poll_id = NEW.poll_id 
          AND v.user_id = CASE 
            WHEN f.requester_id = NEW.user_id THEN f.recipient_id
            ELSE f.requester_id
          END
      )
  LOOP
    INSERT INTO notifications (user_id, title, body, type, data)
    VALUES (
      _friend.friend_id,
      'Your friend voted!',
      COALESCE(_voter_username, 'A friend') || ' just voted on: ' || LEFT(_poll_question, 50),
      'friend_voted',
      jsonb_build_object(
        'poll_id', NEW.poll_id,
        'voter_id', NEW.user_id,
        'voter_username', _voter_username
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger to notify friends when user votes
CREATE TRIGGER notify_friends_on_vote_trigger
  AFTER INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_friends_on_vote();