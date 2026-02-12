-- Drop the policy I just added (demographics are for creators/subscribers only)
DROP POLICY IF EXISTS "Users can view votes for polls they voted on" ON public.votes;

-- Update polls policy to use DATE comparison (same day or after signup)
DROP POLICY IF EXISTS "Users can view active polls created after signup" ON public.polls;

CREATE POLICY "Users can view active polls from signup day onwards"
ON public.polls
FOR SELECT
USING (
  (is_active = true) 
  AND (DATE(created_at) >= DATE((SELECT created_at FROM users WHERE id = auth.uid())))
);