
-- 1. Calendar table
CREATE TABLE public.poll_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_date DATE NOT NULL,
  category TEXT,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  image_a_url TEXT,
  image_b_url TEXT,
  ai_image_a_preview TEXT,
  ai_image_b_preview TEXT,
  why_viral TEXT,
  source TEXT,
  target_country TEXT,
  target_age_range TEXT,
  target_gender TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  published_poll_id UUID,
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT poll_calendar_status_check CHECK (status IN ('draft','image_pending','approved','published','skipped'))
);

CREATE INDEX idx_poll_calendar_release_date ON public.poll_calendar(release_date);
CREATE INDEX idx_poll_calendar_status ON public.poll_calendar(status);
CREATE INDEX idx_poll_calendar_date_status ON public.poll_calendar(release_date, status);

ALTER TABLE public.poll_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view calendar"
  ON public.poll_calendar FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert calendar"
  ON public.poll_calendar FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update calendar"
  ON public.poll_calendar FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete calendar"
  ON public.poll_calendar FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_poll_calendar_updated_at
  BEFORE UPDATE ON public.poll_calendar
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add release_hour_cairo to daily_poll_settings
ALTER TABLE public.daily_poll_settings
  ADD COLUMN IF NOT EXISTS release_hour_cairo INTEGER NOT NULL DEFAULT 7;

-- 3. Storage bucket for calendar images
INSERT INTO storage.buckets (id, name, public)
VALUES ('poll-calendar-images', 'poll-calendar-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read calendar images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'poll-calendar-images');

CREATE POLICY "Admins can upload calendar images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'poll-calendar-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update calendar images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'poll-calendar-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete calendar images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'poll-calendar-images' AND public.has_role(auth.uid(), 'admin'));
