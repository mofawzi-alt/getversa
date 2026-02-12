
-- Add poll_type column with validation
ALTER TABLE public.polls 
ADD COLUMN poll_type text NOT NULL DEFAULT 'core_index';

-- Validate poll_type values
CREATE OR REPLACE FUNCTION public.validate_poll_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.poll_type NOT IN ('core_index', 'seasonal', 'campaign') THEN
    RAISE EXCEPTION 'Invalid poll_type: %. Must be one of: core_index, seasonal, campaign', NEW.poll_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_poll_type_trigger
BEFORE INSERT OR UPDATE ON public.polls
FOR EACH ROW
EXECUTE FUNCTION public.validate_poll_type();

-- Set existing polls with ends_at as seasonal, rest as core_index
UPDATE public.polls SET poll_type = 'seasonal' WHERE ends_at IS NOT NULL;
UPDATE public.polls SET poll_type = 'core_index' WHERE ends_at IS NULL;
