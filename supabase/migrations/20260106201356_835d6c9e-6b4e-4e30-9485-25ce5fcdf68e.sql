-- Allow all authenticated users to view all votes (for seeing poll results)
DROP POLICY IF EXISTS "Users can view own votes" ON public.votes;

CREATE POLICY "Users can view all votes" 
ON public.votes 
FOR SELECT 
USING (auth.uid() IS NOT NULL);