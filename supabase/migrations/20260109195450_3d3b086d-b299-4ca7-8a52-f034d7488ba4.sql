-- Fix the security definer view by recreating it as a regular view with explicit security
DROP VIEW IF EXISTS public.public_user_profiles;

-- Create a simple view that inherits RLS from the underlying table
-- Since users table now has RLS requiring auth.uid() = id, we need a function approach
-- Create a security invoker function to get public profile data

CREATE OR REPLACE FUNCTION public.get_public_profiles(user_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  username text,
  points integer,
  current_streak integer,
  longest_streak integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id,
    u.username,
    u.points,
    u.current_streak,
    u.longest_streak,
    u.created_at
  FROM users u
  WHERE user_ids IS NULL OR u.id = ANY(user_ids);
$$;

-- Create a function for leaderboard (returns top users by various criteria)
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  order_by text DEFAULT 'points',
  limit_count integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  username text,
  points integer,
  current_streak integer,
  longest_streak integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF order_by = 'points' THEN
    RETURN QUERY
    SELECT u.id, u.username, u.points, u.current_streak, u.longest_streak
    FROM users u
    ORDER BY u.points DESC NULLS LAST
    LIMIT limit_count;
  ELSIF order_by = 'current_streak' THEN
    RETURN QUERY
    SELECT u.id, u.username, u.points, u.current_streak, u.longest_streak
    FROM users u
    ORDER BY u.current_streak DESC NULLS LAST
    LIMIT limit_count;
  ELSE
    RETURN QUERY
    SELECT u.id, u.username, u.points, u.current_streak, u.longest_streak
    FROM users u
    ORDER BY u.points DESC NULLS LAST
    LIMIT limit_count;
  END IF;
END;
$$;