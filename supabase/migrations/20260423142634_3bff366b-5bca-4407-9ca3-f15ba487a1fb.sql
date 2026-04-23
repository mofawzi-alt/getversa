-- App Store compliance: support anonymization of analytics-critical user data on account deletion.
-- We allow user_id to be NULL on analytics tables so personal identity can be severed
-- without losing aggregate vote/poll integrity.
ALTER TABLE public.votes ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.predictions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.poll_attribute_ratings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.poll_verbatim_feedback ALTER COLUMN user_id DROP NOT NULL;