ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS question_ar text,
  ADD COLUMN IF NOT EXISTS option_a_ar text,
  ADD COLUMN IF NOT EXISTS option_b_ar text,
  ADD COLUMN IF NOT EXISTS subtitle_ar text;

ALTER TABLE public.poll_calendar
  ADD COLUMN IF NOT EXISTS question_ar text,
  ADD COLUMN IF NOT EXISTS option_a_ar text,
  ADD COLUMN IF NOT EXISTS option_b_ar text,
  ADD COLUMN IF NOT EXISTS subtitle_ar text;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en';

COMMENT ON COLUMN public.polls.question_ar IS 'Arabic translation of the question; falls back to question when null';
COMMENT ON COLUMN public.users.preferred_language IS 'UI language: en or ar';