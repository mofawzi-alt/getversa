-- Function to find users with similar voting patterns (potential friends)
CREATE OR REPLACE FUNCTION public.get_similar_voters(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  points INTEGER,
  shared_polls BIGINT,
  matching_votes BIGINT,
  similarity_score INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.username,
    u.points,
    COUNT(*)::BIGINT as shared_polls,
    COUNT(*) FILTER (WHERE v1.choice = v2.choice)::BIGINT as matching_votes,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE v1.choice = v2.choice)::NUMERIC / COUNT(*)) * 100)::INTEGER
      ELSE 0
    END as similarity_score
  FROM votes v1
  JOIN votes v2 ON v1.poll_id = v2.poll_id AND v1.user_id != v2.user_id
  JOIN users u ON u.id = v2.user_id
  WHERE v1.user_id = p_user_id
    AND u.username IS NOT NULL
    -- Exclude existing friends
    AND NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = p_user_id AND f.recipient_id = v2.user_id)
          OR (f.recipient_id = p_user_id AND f.requester_id = v2.user_id))
    )
    -- Exclude pending requests
    AND NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'pending'
        AND ((f.requester_id = p_user_id AND f.recipient_id = v2.user_id)
          OR (f.recipient_id = p_user_id AND f.requester_id = v2.user_id))
    )
  GROUP BY u.id, u.username, u.points
  HAVING COUNT(*) >= 3  -- Require at least 3 shared polls
  ORDER BY 
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE v1.choice = v2.choice)::NUMERIC / COUNT(*)) * 100)::INTEGER
      ELSE 0
    END DESC,
    COUNT(*) DESC
  LIMIT p_limit;
END;
$$;

-- Function to calculate compatibility trend (compare recent vs older votes)
CREATE OR REPLACE FUNCTION public.get_compatibility_trend(user_a UUID, user_b UUID)
RETURNS TABLE(
  overall_score INTEGER,
  recent_score INTEGER,
  older_score INTEGER,
  trend TEXT,
  trend_change INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _overall INTEGER;
  _recent INTEGER;
  _older INTEGER;
  _recent_count INTEGER;
  _older_count INTEGER;
BEGIN
  -- Get overall compatibility
  _overall := public.get_compatibility_score(user_a, user_b);
  
  -- Get recent votes compatibility (last 30 days)
  SELECT 
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 
      ROUND((COUNT(*) FILTER (WHERE v1.choice = v2.choice)::NUMERIC / COUNT(*)) * 100)::INTEGER
    ELSE NULL END
  INTO _recent_count, _recent
  FROM votes v1
  JOIN votes v2 ON v1.poll_id = v2.poll_id
  WHERE v1.user_id = user_a AND v2.user_id = user_b
    AND GREATEST(v1.created_at, v2.created_at) >= NOW() - INTERVAL '30 days';
  
  -- Get older votes compatibility (before 30 days)
  SELECT 
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN 
      ROUND((COUNT(*) FILTER (WHERE v1.choice = v2.choice)::NUMERIC / COUNT(*)) * 100)::INTEGER
    ELSE NULL END
  INTO _older_count, _older
  FROM votes v1
  JOIN votes v2 ON v1.poll_id = v2.poll_id
  WHERE v1.user_id = user_a AND v2.user_id = user_b
    AND GREATEST(v1.created_at, v2.created_at) < NOW() - INTERVAL '30 days';
  
  -- Determine trend
  RETURN QUERY
  SELECT 
    _overall as overall_score,
    _recent as recent_score,
    _older as older_score,
    CASE
      WHEN _recent IS NULL OR _older IS NULL THEN 'neutral'
      WHEN _recent > _older + 5 THEN 'up'
      WHEN _recent < _older - 5 THEN 'down'
      ELSE 'stable'
    END as trend,
    CASE
      WHEN _recent IS NULL OR _older IS NULL THEN 0
      ELSE _recent - _older
    END as trend_change;
END;
$$;

-- Function to get friends with compatibility trends
CREATE OR REPLACE FUNCTION public.get_friends_with_trends(p_user_id UUID)
RETURNS TABLE(
  friend_id UUID,
  friend_username TEXT,
  friend_points INTEGER,
  compatibility_score INTEGER,
  recent_score INTEGER,
  trend TEXT,
  trend_change INTEGER,
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
    (SELECT ct.recent_score FROM public.get_compatibility_trend(p_user_id, u.id) ct) as recent_score,
    (SELECT ct.trend FROM public.get_compatibility_trend(p_user_id, u.id) ct) as trend,
    (SELECT ct.trend_change FROM public.get_compatibility_trend(p_user_id, u.id) ct) as trend_change,
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