CREATE POLICY "Challengers can cancel pending challenges"
ON public.poll_challenges
FOR DELETE
TO authenticated
USING (auth.uid() = challenger_id AND status = 'pending');