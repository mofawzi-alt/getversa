
-- 1. Poll reactions: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.poll_reactions;
CREATE POLICY "Authenticated can view reactions"
ON public.poll_reactions
FOR SELECT
TO authenticated
USING (true);

-- 2. di_report_views: restrict INSERT to authenticated
DROP POLICY IF EXISTS "Anyone can log views" ON public.di_report_views;
CREATE POLICY "Authenticated can log views"
ON public.di_report_views
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. poll-images storage upload: only admins
DROP POLICY IF EXISTS "Authenticated can upload to poll-images" ON storage.objects;
CREATE POLICY "Admins can upload to poll-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'poll-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
CREATE POLICY "Admins can update poll-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'poll-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
CREATE POLICY "Admins can delete poll-images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'poll-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 4. Explicit deny on email_unsubscribe_tokens for anon & authenticated
CREATE POLICY "Deny anon access to unsubscribe tokens"
ON public.email_unsubscribe_tokens
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- 5. Explicit deny on suppressed_emails for anon & authenticated
CREATE POLICY "Deny anon access to suppressed emails"
ON public.suppressed_emails
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
