-- First create the updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create friendships table for friend requests and relationships
CREATE TABLE public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(requester_id, recipient_id)
);

-- Enable Row Level Security
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Users can view friendships they're part of
CREATE POLICY "Users can view own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Users can send friend requests
CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Users can update friendships they're recipient of (accept/reject)
CREATE POLICY "Recipients can update friend requests"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = recipient_id);

-- Users can delete friendships they're part of (unfriend)
CREATE POLICY "Users can delete own friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Create trigger for updated_at
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate compatibility score between two users
CREATE OR REPLACE FUNCTION public.get_compatibility_score(user_a UUID, user_b UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  shared_polls INTEGER;
  matching_votes INTEGER;
  score INTEGER;
BEGIN
  -- Count polls where both users voted
  SELECT COUNT(*) INTO shared_polls
  FROM (
    SELECT v1.poll_id
    FROM votes v1
    JOIN votes v2 ON v1.poll_id = v2.poll_id
    WHERE v1.user_id = user_a AND v2.user_id = user_b
  ) shared;
  
  IF shared_polls = 0 THEN
    RETURN NULL; -- No shared polls yet
  END IF;
  
  -- Count polls where both users voted the same
  SELECT COUNT(*) INTO matching_votes
  FROM (
    SELECT v1.poll_id
    FROM votes v1
    JOIN votes v2 ON v1.poll_id = v2.poll_id AND v1.choice = v2.choice
    WHERE v1.user_id = user_a AND v2.user_id = user_b
  ) matches;
  
  -- Calculate percentage
  score := ROUND((matching_votes::NUMERIC / shared_polls) * 100)::INTEGER;
  
  RETURN score;
END;
$$;

-- Function to get friend's vote on a specific poll
CREATE OR REPLACE FUNCTION public.get_friend_votes(p_user_id UUID, p_poll_id UUID)
RETURNS TABLE(
  friend_id UUID,
  friend_username TEXT,
  choice TEXT,
  compatibility_score INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as friend_id,
    u.username as friend_username,
    v.choice,
    public.get_compatibility_score(p_user_id, u.id) as compatibility_score
  FROM friendships f
  JOIN users u ON (
    CASE 
      WHEN f.requester_id = p_user_id THEN u.id = f.recipient_id
      ELSE u.id = f.requester_id
    END
  )
  LEFT JOIN votes v ON v.user_id = u.id AND v.poll_id = p_poll_id
  WHERE f.status = 'accepted'
    AND (f.requester_id = p_user_id OR f.recipient_id = p_user_id);
END;
$$;

-- Function to search users by username
CREATE OR REPLACE FUNCTION public.search_users_by_username(search_term TEXT, current_user_id UUID)
RETURNS TABLE(
  id UUID,
  username TEXT,
  points INTEGER,
  friendship_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.points,
    COALESCE(
      (SELECT f.status FROM friendships f 
       WHERE (f.requester_id = current_user_id AND f.recipient_id = u.id)
          OR (f.recipient_id = current_user_id AND f.requester_id = u.id)
       LIMIT 1),
      'none'
    ) as friendship_status
  FROM users u
  WHERE u.username ILIKE '%' || search_term || '%'
    AND u.id != current_user_id
    AND u.username IS NOT NULL
  LIMIT 20;
END;
$$;

-- Function to get all friends with compatibility scores
CREATE OR REPLACE FUNCTION public.get_friends_with_scores(p_user_id UUID)
RETURNS TABLE(
  friend_id UUID,
  friend_username TEXT,
  friend_points INTEGER,
  compatibility_score INTEGER,
  friendship_created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as friend_id,
    u.username as friend_username,
    u.points as friend_points,
    public.get_compatibility_score(p_user_id, u.id) as compatibility_score,
    f.created_at as friendship_created_at
  FROM friendships f
  JOIN users u ON (
    CASE 
      WHEN f.requester_id = p_user_id THEN u.id = f.recipient_id
      ELSE u.id = f.requester_id
    END
  )
  WHERE f.status = 'accepted'
    AND (f.requester_id = p_user_id OR f.recipient_id = p_user_id)
  ORDER BY compatibility_score DESC NULLS LAST;
END;
$$;