ALTER TABLE public.polls DROP CONSTRAINT IF EXISTS polls_category_check;
ALTER TABLE public.polls ADD CONSTRAINT polls_category_check CHECK (category IS NULL OR category IN ('Relationships','Money','Education','Digital Life','Food','Entertainment','Lifestyle','Egypt'));

ALTER TABLE public.poll_calendar DROP CONSTRAINT IF EXISTS poll_calendar_category_check;
ALTER TABLE public.poll_calendar ADD CONSTRAINT poll_calendar_category_check CHECK (category IS NULL OR category IN ('Relationships','Money','Education','Digital Life','Food','Entertainment','Lifestyle','Egypt'));

DELETE FROM public.categories WHERE is_preset = true AND name NOT IN ('Relationships','Money','Education','Digital Life','Food','Entertainment','Lifestyle','Egypt');