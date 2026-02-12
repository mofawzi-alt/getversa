-- Add poll intent tag column for internal categorization (visible to admins/buyers only)
ALTER TABLE public.polls
ADD COLUMN intent_tag text DEFAULT NULL;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.polls.intent_tag IS 'Internal tag for poll intent: brand_test, concept_test, cultural_signal, fun_engagement';