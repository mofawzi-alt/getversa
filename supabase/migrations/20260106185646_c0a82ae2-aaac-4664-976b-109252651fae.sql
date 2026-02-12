-- Allow users to view votes for polls they have voted on (for demographic analytics)
CREATE POLICY "Users can view votes for polls they voted on"
ON public.votes
FOR SELECT
USING (
  poll_id IN (
    SELECT poll_id FROM votes WHERE user_id = auth.uid()
  )
);