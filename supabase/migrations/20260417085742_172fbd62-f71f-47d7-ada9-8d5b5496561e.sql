DROP POLICY IF EXISTS "Users can respond to challenges" ON public.poll_challenges;

CREATE POLICY "Challenged users can update their duels"
ON public.poll_challenges
FOR UPDATE
TO authenticated
USING (auth.uid() = challenged_id)
WITH CHECK (auth.uid() = challenged_id);

CREATE POLICY "Challengers can update their duels"
ON public.poll_challenges
FOR UPDATE
TO authenticated
USING (auth.uid() = challenger_id)
WITH CHECK (auth.uid() = challenger_id);