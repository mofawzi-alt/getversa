
-- Add expiry_type column to polls
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS expiry_type text NOT NULL DEFAULT 'evergreen';

-- Create poll_cycles table for Brand Battle monthly cycle history
CREATE TABLE public.poll_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  cycle_number integer NOT NULL DEFAULT 1,
  cycle_start timestamp with time zone NOT NULL,
  cycle_end timestamp with time zone NOT NULL,
  votes_a integer NOT NULL DEFAULT 0,
  votes_b integer NOT NULL DEFAULT 0,
  total_votes integer NOT NULL DEFAULT 0,
  percent_a integer NOT NULL DEFAULT 0,
  percent_b integer NOT NULL DEFAULT 0,
  demographic_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on poll_cycles
ALTER TABLE public.poll_cycles ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage poll cycles" ON public.poll_cycles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read cycles
CREATE POLICY "Anyone can view poll cycles" ON public.poll_cycles
  FOR SELECT TO authenticated
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_poll_cycles_poll_id ON public.poll_cycles(poll_id);
CREATE INDEX idx_polls_expiry_type ON public.polls(expiry_type);

-- Validation trigger for expiry_type
CREATE OR REPLACE FUNCTION public.validate_poll_expiry_type()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.expiry_type NOT IN ('evergreen', 'trending', 'brand_battle') THEN
    RAISE EXCEPTION 'Invalid expiry_type: %. Must be one of: evergreen, trending, brand_battle', NEW.expiry_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_expiry_type_trigger
  BEFORE INSERT OR UPDATE ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_poll_expiry_type();
