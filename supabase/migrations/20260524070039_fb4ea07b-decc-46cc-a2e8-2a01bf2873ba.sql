
-- 1) USERS: remove anonymous public access to emails & demographics.
-- Keep authenticated users able to read profiles (app needs username/avatar/etc.).
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.users;
CREATE POLICY "Authenticated users can view profiles"
ON public.users FOR SELECT
TO authenticated
USING (true);

-- 2) LIVE_ASK_VOTES: restrict reads to own votes; admins keep full access via existing policy.
DROP POLICY IF EXISTS "Authenticated can view live ask votes" ON public.live_ask_votes;
CREATE POLICY "Users view own live ask votes"
ON public.live_ask_votes FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3) VOTES: restrict direct reads to own votes. Aggregate results are exposed via
-- existing SECURITY DEFINER RPCs (get_poll_results, get_shared_vote_history, etc.)
-- which bypass RLS, so public results screens keep working.
DROP POLICY IF EXISTS "Users can view all votes" ON public.votes;
DROP POLICY IF EXISTS "Users view own votes" ON public.votes;
CREATE POLICY "Users view own votes"
ON public.votes FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 4) POLL-IMAGES storage bucket: require authentication for uploads.
DROP POLICY IF EXISTS "Allow public uploads to poll-images" ON storage.objects;
CREATE POLICY "Authenticated can upload to poll-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'poll-images');

-- 5) POLL_CAMPAIGNS: don't expose internal targeting/drip config to the public internet.
-- Public can no longer read the table directly; logged-in users still see active campaigns
-- (needed by the app to display brand polls).
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON public.poll_campaigns;
CREATE POLICY "Authenticated can view active campaigns"
ON public.poll_campaigns FOR SELECT
TO authenticated
USING (is_active = true OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
