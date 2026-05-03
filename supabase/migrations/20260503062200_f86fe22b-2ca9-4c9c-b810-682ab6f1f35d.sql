
-- 1) Privacy check function
CREATE OR REPLACE FUNCTION public.can_view_user_stories(viewer_id uuid, author_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    viewer_id = author_id
    OR NOT (SELECT is_private FROM public.users WHERE id = author_id)
    OR EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND ((requester_id = viewer_id AND recipient_id = author_id)
          OR (requester_id = author_id AND recipient_id = viewer_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = viewer_id AND following_id = author_id
    )
$$;

-- 2) User stories table
CREATE TABLE public.user_stories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_type text NOT NULL CHECK (story_type IN ('poll_result', 'taste_profile', 'achievement', 'duel_result')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_url text,
  views_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own stories"
  ON public.user_stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories"
  ON public.user_stories FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "View stories respecting privacy"
  ON public.user_stories FOR SELECT
  USING (
    expires_at > now()
    AND can_view_user_stories(auth.uid(), user_id)
  );

CREATE POLICY "Anon view public stories"
  ON public.user_stories FOR SELECT
  TO anon
  USING (
    expires_at > now()
    AND NOT (SELECT is_private FROM public.users WHERE id = user_id)
  );

-- 3) Story views tracking
CREATE TABLE public.user_story_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES public.user_stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

ALTER TABLE public.user_story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can mark stories viewed"
  ON public.user_story_views FOR INSERT
  WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Users can see own views"
  ON public.user_story_views FOR SELECT
  USING (auth.uid() = viewer_id);

CREATE POLICY "Story authors can see who viewed"
  ON public.user_story_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_stories
      WHERE id = story_id AND user_id = auth.uid()
    )
  );

-- 4) Indexes
CREATE INDEX idx_user_stories_user_expires ON public.user_stories(user_id, expires_at DESC);
CREATE INDEX idx_user_stories_expires ON public.user_stories(expires_at DESC);
CREATE INDEX idx_user_story_views_viewer ON public.user_story_views(viewer_id, story_id);

-- 5) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_stories;
