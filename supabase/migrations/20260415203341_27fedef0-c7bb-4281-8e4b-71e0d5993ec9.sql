
-- Weekly leaderboard snapshots
CREATE TABLE public.weekly_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  weekly_points integer NOT NULL DEFAULT 0,
  rank integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE public.weekly_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view weekly leaderboard"
  ON public.weekly_leaderboard FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert leaderboard entries"
  ON public.weekly_leaderboard FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Poll suggestions
CREATE TABLE public.poll_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.poll_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create suggestions"
  ON public.poll_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own suggestions"
  ON public.poll_suggestions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all suggestions"
  ON public.poll_suggestions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Prediction accuracy columns on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS prediction_accuracy integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prediction_total integer DEFAULT 0;

-- Function to update prediction accuracy (deferred — runs async after vote)
CREATE OR REPLACE FUNCTION public.update_prediction_accuracy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_votes bigint;
  _majority_votes bigint;
BEGIN
  -- Count user's votes that ended up with the majority
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE sub.is_majority)
  INTO _total_votes, _majority_votes
  FROM (
    SELECT 
      v.choice,
      CASE 
        WHEN v.choice = 'A' AND (SELECT COUNT(*) FILTER (WHERE v2.choice = 'A') FROM votes v2 WHERE v2.poll_id = v.poll_id) >= 
             (SELECT COUNT(*) FILTER (WHERE v2.choice = 'B') FROM votes v2 WHERE v2.poll_id = v.poll_id) THEN true
        WHEN v.choice = 'B' AND (SELECT COUNT(*) FILTER (WHERE v2.choice = 'B') FROM votes v2 WHERE v2.poll_id = v.poll_id) >= 
             (SELECT COUNT(*) FILTER (WHERE v2.choice = 'A') FROM votes v2 WHERE v2.poll_id = v.poll_id) THEN true
        ELSE false
      END as is_majority
    FROM votes v
    WHERE v.user_id = NEW.user_id
    -- Only check polls with 5+ votes for meaningful accuracy
    AND (SELECT COUNT(*) FROM votes v3 WHERE v3.poll_id = v.poll_id) >= 5
    -- Limit to last 100 votes for performance
    ORDER BY v.created_at DESC
    LIMIT 100
  ) sub;

  IF _total_votes > 0 THEN
    UPDATE users
    SET prediction_accuracy = ROUND((_majority_votes::numeric / _total_votes) * 100)::integer,
        prediction_total = _total_votes::integer
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_prediction_accuracy
  AFTER INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_prediction_accuracy();

-- Function to award category badges automatically
CREATE OR REPLACE FUNCTION public.award_category_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _category text;
  _cat_count bigint;
  _badge_name text;
  _badge_id uuid;
BEGIN
  _category := NEW.category;
  IF _category IS NULL THEN RETURN NEW; END IF;

  -- Count votes in this category
  SELECT COUNT(*) INTO _cat_count
  FROM votes WHERE user_id = NEW.user_id AND category = _category;

  -- Award at 20 votes in a category
  IF _cat_count >= 20 THEN
    _badge_name := initcap(_category) || ' Expert';
    
    -- Upsert badge definition
    INSERT INTO badges (name, description, badge_type, requirement_value, points_reward)
    VALUES (_badge_name, 'Voted on 20+ ' || _category || ' polls', 'category', 20, 15)
    ON CONFLICT DO NOTHING;

    SELECT id INTO _badge_id FROM badges WHERE name = _badge_name LIMIT 1;

    IF _badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM user_badges WHERE user_id = NEW.user_id AND badge_id = _badge_id
    ) THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (NEW.user_id, _badge_id);
      UPDATE users SET points = COALESCE(points, 0) + 15 WHERE id = NEW.user_id;
      
      INSERT INTO notifications (user_id, title, body, type, data)
      VALUES (NEW.user_id, '🏅 New Badge!', 'You earned ' || _badge_name || '!', 'badge_earned',
              jsonb_build_object('badge_name', _badge_name));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_category_badges
  AFTER INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.award_category_badges();
