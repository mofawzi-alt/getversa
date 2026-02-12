-- Fix #1: Create atomic reward redemption function to prevent race conditions
CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_user_id UUID,
  p_reward_id UUID,
  p_cost_points INTEGER,
  p_redemption_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_points INTEGER;
  existing_redemption RECORD;
BEGIN
  -- Lock row and get current points
  SELECT points INTO current_points
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check sufficient points
  IF current_points IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;
  
  IF current_points < p_cost_points THEN
    RETURN jsonb_build_object('error', 'Insufficient points');
  END IF;
  
  -- Check if already redeemed
  SELECT * INTO existing_redemption
  FROM user_rewards
  WHERE user_id = p_user_id
    AND reward_id = p_reward_id
    AND status = 'redeemed'
  FOR UPDATE;
  
  IF FOUND THEN
    RETURN jsonb_build_object('error', 'Already redeemed');
  END IF;
  
  -- Deduct points atomically
  UPDATE users
  SET points = points - p_cost_points
  WHERE id = p_user_id;
  
  -- Record redemption (upsert)
  INSERT INTO user_rewards (user_id, reward_id, status, redeemed_at, redemption_code)
  VALUES (p_user_id, p_reward_id, 'redeemed', NOW(), p_redemption_code)
  ON CONFLICT (user_id, reward_id)
  DO UPDATE SET
    status = 'redeemed',
    redeemed_at = NOW(),
    redemption_code = p_redemption_code;
  
  RETURN jsonb_build_object('success', true, 'code', p_redemption_code);
END;
$$;

-- Add unique constraint for user_rewards if not exists (needed for ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_rewards_user_id_reward_id_key'
  ) THEN
    ALTER TABLE public.user_rewards ADD CONSTRAINT user_rewards_user_id_reward_id_key UNIQUE (user_id, reward_id);
  END IF;
END $$;

-- Fix #3: Replace overly permissive users table policy with restrictive one
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;

-- Users can only view their own complete profile
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create a secure view for public leaderboard data (non-sensitive fields only)
CREATE OR REPLACE VIEW public.public_user_profiles AS
SELECT 
  id,
  username,
  points,
  current_streak,
  longest_streak,
  created_at
FROM public.users;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.public_user_profiles TO authenticated;
GRANT SELECT ON public.public_user_profiles TO anon;