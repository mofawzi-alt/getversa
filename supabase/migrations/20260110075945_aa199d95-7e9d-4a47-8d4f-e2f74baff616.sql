-- Allow admins to view all user profiles for analytics
-- This is needed for admin dashboard to show vote demographics

CREATE POLICY "Admins can view all profiles"
ON public.users
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));