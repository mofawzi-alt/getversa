-- Fix #1: Restrict user_badges visibility to own badges only
-- (Keep admin access for management)
DROP POLICY IF EXISTS "Anyone can view user badges" ON public.user_badges;

CREATE POLICY "Users can view own badges"
ON public.user_badges
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Fix #2: Remove SELECT access from push_subscriptions (keys should only be used server-side)
-- Keep INSERT and DELETE for users to manage their subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.push_subscriptions;

-- Fix #3: Restrict votes visibility to own votes only
-- Poll creators and admins can still see aggregate results via the get_poll_results function
DROP POLICY IF EXISTS "Users can view all votes" ON public.votes;

CREATE POLICY "Users can view own votes"
ON public.votes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create function for poll creators to see their poll's aggregate results
-- (already exists as get_poll_results, but ensure poll creators can use it)
CREATE OR REPLACE FUNCTION public.get_user_badge_count(target_user_id uuid)
RETURNS TABLE (
  badge_id uuid,
  badge_name text,
  badge_description text,
  earned_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    b.id as badge_id,
    b.name as badge_name,
    b.description as badge_description,
    ub.earned_at
  FROM user_badges ub
  JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = target_user_id;
$$;

-- Also allow users to insert their own notifications for reward redemptions
-- This fixes the broken feature where Rewards.tsx tries to create notifications
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());