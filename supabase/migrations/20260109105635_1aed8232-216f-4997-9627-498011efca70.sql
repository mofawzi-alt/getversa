-- Remove the overly permissive policy and rely on the SECURITY DEFINER function
-- The trigger function runs with SECURITY DEFINER which bypasses RLS
DROP POLICY IF EXISTS "System can insert badges" ON user_badges;