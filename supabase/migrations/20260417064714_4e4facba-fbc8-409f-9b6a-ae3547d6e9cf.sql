-- 1. Add game_context to votes for B2B segmentation
ALTER TABLE public.votes
  ADD COLUMN IF NOT EXISTS game_context text NOT NULL DEFAULT 'solo';

CREATE INDEX IF NOT EXISTS idx_votes_game_context ON public.votes(game_context);

-- 2. Predictions table (Predict the Crowd game)
CREATE TABLE IF NOT EXISTS public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  poll_id uuid NOT NULL,
  predicted_choice text NOT NULL CHECK (predicted_choice IN ('A','B')),
  actual_majority text,
  is_correct boolean,
  voter_age_range text,
  voter_gender text,
  voter_country text,
  voter_city text,
  decision_time_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, poll_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_poll ON public.predictions(poll_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON public.predictions(user_id);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own predictions"
  ON public.predictions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own predictions"
  ON public.predictions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all predictions"
  ON public.predictions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Extend poll_challenges for multi-poll duels
ALTER TABLE public.poll_challenges
  ADD COLUMN IF NOT EXISTS poll_ids uuid[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS challenger_score integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS challenged_score integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS match_rate integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS game_type text NOT NULL DEFAULT 'single';

-- 4. Perception Gap helper function (for admin B2B report)
CREATE OR REPLACE FUNCTION public.get_perception_gap(p_poll_id uuid)
RETURNS TABLE(
  total_predictions bigint,
  predicted_a_pct integer,
  predicted_b_pct integer,
  actual_a_pct integer,
  actual_b_pct integer,
  gap_a integer,
  gap_b integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pred_total bigint;
  _pred_a_pct integer;
  _pred_b_pct integer;
  _act_a_pct integer;
  _act_b_pct integer;
BEGIN
  SELECT COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE predicted_choice = 'A')::numeric / COUNT(*)) * 100)::integer ELSE 0 END,
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE predicted_choice = 'B')::numeric / COUNT(*)) * 100)::integer ELSE 0 END
  INTO _pred_total, _pred_a_pct, _pred_b_pct
  FROM predictions WHERE poll_id = p_poll_id;

  SELECT
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE choice = 'A')::numeric / COUNT(*)) * 100)::integer ELSE 0 END,
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE choice = 'B')::numeric / COUNT(*)) * 100)::integer ELSE 0 END
  INTO _act_a_pct, _act_b_pct
  FROM votes WHERE poll_id = p_poll_id;

  RETURN QUERY SELECT
    _pred_total,
    _pred_a_pct,
    _pred_b_pct,
    _act_a_pct,
    _act_b_pct,
    (_pred_a_pct - _act_a_pct),
    (_pred_b_pct - _act_b_pct);
END;
$$;