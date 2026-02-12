-- Drop restrictive SELECT policies and allow anyone to read active polls
DROP POLICY IF EXISTS "Users can view all polls" ON public.polls;

CREATE POLICY "Anyone can view active polls"
ON public.polls
FOR SELECT
USING (is_active = true);
