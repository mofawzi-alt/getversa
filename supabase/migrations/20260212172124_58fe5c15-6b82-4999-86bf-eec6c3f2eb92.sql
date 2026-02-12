
-- Add cultural index fields to polls
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS index_category text,
  ADD COLUMN IF NOT EXISTS internal_dimension_tag text,
  ADD COLUMN IF NOT EXISTS weight_score numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Create index for feed rotation queries
CREATE INDEX IF NOT EXISTS idx_polls_index_category ON public.polls(index_category);
CREATE INDEX IF NOT EXISTS idx_polls_archived ON public.polls(is_archived);

-- Validation trigger: index_category must be one of the allowed values
CREATE OR REPLACE FUNCTION public.validate_poll_index_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.index_category IS NOT NULL AND NEW.index_category NOT IN (
    'identity', 'social', 'consumption', 'tech', 'cultural'
  ) THEN
    RAISE EXCEPTION 'Invalid index_category: %. Must be one of: identity, social, consumption, tech, cultural', NEW.index_category;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_poll_index_category
BEFORE INSERT OR UPDATE ON public.polls
FOR EACH ROW
EXECUTE FUNCTION public.validate_poll_index_category();
