-- Drop the restrictive policy that only lets users see their own votes
DROP POLICY IF EXISTS "Users can view own votes" ON public.votes;

-- Create a new policy that allows all authenticated users to view all votes
-- This is needed for users to see live poll results
CREATE POLICY "Users can view all votes" 
ON public.votes 
FOR SELECT 
TO authenticated
USING (true);