
CREATE TABLE IF NOT EXISTS public.editorial_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_type text NOT NULL CHECK (story_type IN ('egypt_today','generation_gap','city_divide','brand_intel','trend_alert','this_week')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','expired')),
  headline text NOT NULL,
  cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  poll_id uuid REFERENCES public.polls(id) ON DELETE SET NULL,
  cta_poll_id uuid REFERENCES public.polls(id) ON DELETE SET NULL,
  total_real_votes integer DEFAULT 0,
  publish_at timestamptz,
  expires_at timestamptz,
  views integer NOT NULL DEFAULT 0,
  completions integer NOT NULL DEFAULT 0,
  vote_taps integer NOT NULL DEFAULT 0,
  card_dropoff jsonb NOT NULL DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editorial_stories_published ON public.editorial_stories (status, publish_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_editorial_stories_type_date ON public.editorial_stories (story_type, publish_at DESC);

ALTER TABLE public.editorial_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published non-expired stories"
  ON public.editorial_stories FOR SELECT
  USING (status = 'published' AND publish_at <= now() AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Admins can read all stories"
  ON public.editorial_stories FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert stories"
  ON public.editorial_stories FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update stories"
  ON public.editorial_stories FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete stories"
  ON public.editorial_stories FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER editorial_stories_updated_at
  BEFORE UPDATE ON public.editorial_stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service-role function for auto-generators to upsert without RLS friction
CREATE OR REPLACE FUNCTION public.upsert_auto_editorial_story(
  p_story_type text,
  p_headline text,
  p_cards jsonb,
  p_poll_id uuid,
  p_cta_poll_id uuid,
  p_total_real_votes integer,
  p_expires_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.editorial_stories
    (story_type, source, status, headline, cards, poll_id, cta_poll_id, total_real_votes, publish_at, expires_at)
  VALUES
    (p_story_type, 'auto', 'published', p_headline, p_cards, p_poll_id, p_cta_poll_id, p_total_real_votes, now(), p_expires_at)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_editorial_story_event(
  p_story_id uuid,
  p_event text,
  p_card_index integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_event = 'view' THEN
    UPDATE public.editorial_stories SET views = views + 1 WHERE id = p_story_id;
  ELSIF p_event = 'complete' THEN
    UPDATE public.editorial_stories SET completions = completions + 1 WHERE id = p_story_id;
  ELSIF p_event = 'vote_tap' THEN
    UPDATE public.editorial_stories SET vote_taps = vote_taps + 1 WHERE id = p_story_id;
  ELSIF p_event = 'dropoff' AND p_card_index IS NOT NULL THEN
    UPDATE public.editorial_stories
      SET card_dropoff = jsonb_set(
        card_dropoff,
        ARRAY[p_card_index::text],
        to_jsonb(COALESCE((card_dropoff->>(p_card_index::text))::int, 0) + 1)
      )
      WHERE id = p_story_id;
  END IF;
END;
$$;
