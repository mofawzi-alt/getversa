ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS cultural_context text;
ALTER TABLE public.poll_calendar ADD COLUMN IF NOT EXISTS cultural_context text;

ALTER TABLE public.polls DROP CONSTRAINT IF EXISTS polls_cultural_context_check;
ALTER TABLE public.polls ADD CONSTRAINT polls_cultural_context_check
  CHECK (cultural_context IS NULL OR cultural_context IN
    ('Cairo street','Sahel beach','Egyptian home','Egyptian office','Egyptian café','Generic global'));

ALTER TABLE public.poll_calendar DROP CONSTRAINT IF EXISTS poll_calendar_cultural_context_check;
ALTER TABLE public.poll_calendar ADD CONSTRAINT poll_calendar_cultural_context_check
  CHECK (cultural_context IS NULL OR cultural_context IN
    ('Cairo street','Sahel beach','Egyptian home','Egyptian office','Egyptian café','Generic global'));