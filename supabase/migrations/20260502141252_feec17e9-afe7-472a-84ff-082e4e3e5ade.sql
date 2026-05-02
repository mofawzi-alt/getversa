
ALTER TABLE public.polls
ADD COLUMN IF NOT EXISTS needs_manual_image boolean NOT NULL DEFAULT false;

ALTER TABLE public.poll_calendar
ADD COLUMN IF NOT EXISTS image_rejection_count integer NOT NULL DEFAULT 0;
