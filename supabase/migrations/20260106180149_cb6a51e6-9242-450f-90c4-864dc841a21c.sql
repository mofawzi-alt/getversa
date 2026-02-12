-- Fix votes table RLS policy to prevent public exposure of voting patterns
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view votes" ON public.votes;

-- Create a new policy that only allows users to view their own votes
CREATE POLICY "Users can view own votes"
ON public.votes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Also allow admins to view all votes for analytics purposes
CREATE POLICY "Admins can view all votes"
ON public.votes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));