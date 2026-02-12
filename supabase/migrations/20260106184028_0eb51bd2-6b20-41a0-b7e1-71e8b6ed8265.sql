-- Update polls SELECT policy to only show polls created after user signup
DROP POLICY IF EXISTS "Anyone can view active polls" ON public.polls;

CREATE POLICY "Users can view active polls created after signup"
ON public.polls
FOR SELECT
TO authenticated
USING (
  is_active = true 
  AND created_at >= (SELECT created_at FROM public.users WHERE id = auth.uid())
);

-- Also allow admins to see all polls (they already have ALL policy)