
-- Internal dimensions (hidden from users)
CREATE TABLE public.dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dimensions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage dimensions
CREATE POLICY "Admins can manage dimensions"
ON public.dimensions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- No public SELECT policy - dimensions are internal only

-- Map polls to 1-2 dimensions with a weight direction
CREATE TABLE public.poll_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  dimension_id uuid NOT NULL REFERENCES public.dimensions(id) ON DELETE CASCADE,
  weight_a numeric NOT NULL DEFAULT 1.0,
  weight_b numeric NOT NULL DEFAULT -1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, dimension_id)
);

ALTER TABLE public.poll_dimensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage poll dimensions"
ON public.poll_dimensions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Aggregated user scores per dimension (internal only)
CREATE TABLE public.user_dimension_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dimension_id uuid NOT NULL REFERENCES public.dimensions(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  vote_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, dimension_id)
);

ALTER TABLE public.user_dimension_scores ENABLE ROW LEVEL SECURITY;

-- Users can only read their own scores (used server-side for summary generation)
CREATE POLICY "Users can view own dimension scores"
ON public.user_dimension_scores FOR SELECT
USING (user_id = auth.uid());

-- System inserts/updates via trigger (security definer)
CREATE POLICY "Admins can manage dimension scores"
ON public.user_dimension_scores FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger function: after vote, update user_dimension_scores
CREATE OR REPLACE FUNCTION public.update_dimension_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dim record;
  _weight numeric;
BEGIN
  FOR _dim IN
    SELECT pd.dimension_id, pd.weight_a, pd.weight_b
    FROM poll_dimensions pd
    WHERE pd.poll_id = NEW.poll_id
  LOOP
    _weight := CASE WHEN NEW.choice = 'A' THEN _dim.weight_a ELSE _dim.weight_b END;

    INSERT INTO user_dimension_scores (user_id, dimension_id, score, vote_count, updated_at)
    VALUES (NEW.user_id, _dim.dimension_id, _weight, 1, now())
    ON CONFLICT (user_id, dimension_id)
    DO UPDATE SET
      score = user_dimension_scores.score + _weight,
      vote_count = user_dimension_scores.vote_count + 1,
      updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_dimension_scores
AFTER INSERT ON public.votes
FOR EACH ROW
EXECUTE FUNCTION public.update_dimension_scores();

-- RPC to get insight summary (only returns text labels, not raw scores)
CREATE OR REPLACE FUNCTION public.get_insight_profile(p_user_id uuid)
RETURNS TABLE(dimension_name text, tendency text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow users to see their own profile
  IF p_user_id != auth.uid() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.name as dimension_name,
    CASE
      WHEN uds.score > 3 THEN 'strong_a'
      WHEN uds.score > 0 THEN 'lean_a'
      WHEN uds.score = 0 THEN 'balanced'
      WHEN uds.score > -3 THEN 'lean_b'
      ELSE 'strong_b'
    END as tendency
  FROM user_dimension_scores uds
  JOIN dimensions d ON d.id = uds.dimension_id
  WHERE uds.user_id = p_user_id
    AND uds.vote_count >= 2
  ORDER BY uds.vote_count DESC;
END;
$$;
