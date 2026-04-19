
-- 1. Credits column + daily tracker on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ask_credits integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS last_daily_credit_date date;

-- Bootstrap existing users
UPDATE public.users SET ask_credits = 10 WHERE ask_credits IS NULL OR ask_credits = 0;

-- 2. Query log table
CREATE TABLE IF NOT EXISTS public.ask_versa_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  question text NOT NULL,
  mode text NOT NULL DEFAULT 'decide',
  route text NOT NULL DEFAULT 'simple',  -- simple | medium | complex
  credits_charged integer NOT NULL DEFAULT 0,
  answered boolean NOT NULL DEFAULT false,
  low_data boolean NOT NULL DEFAULT false,
  model_used text,
  total_votes_considered integer DEFAULT 0,
  matched_poll_count integer DEFAULT 0,
  category_hint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ask_versa_queries_user ON public.ask_versa_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_ask_versa_queries_created ON public.ask_versa_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ask_versa_queries_route ON public.ask_versa_queries(route);
CREATE INDEX IF NOT EXISTS idx_ask_versa_queries_lowdata ON public.ask_versa_queries(low_data) WHERE low_data = true;

ALTER TABLE public.ask_versa_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own queries"
  ON public.ask_versa_queries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all queries"
  ON public.ask_versa_queries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Earn / spend helpers
CREATE OR REPLACE FUNCTION public.earn_ask_credits(p_user_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    SELECT ask_credits INTO _new_balance FROM users WHERE id = p_user_id;
    RETURN COALESCE(_new_balance, 0);
  END IF;
  UPDATE users
    SET ask_credits = COALESCE(ask_credits, 0) + p_amount
    WHERE id = p_user_id
    RETURNING ask_credits INTO _new_balance;
  RETURN COALESCE(_new_balance, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_ask_credits(p_user_id uuid, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _balance integer;
BEGIN
  SELECT ask_credits INTO _balance FROM users WHERE id = p_user_id FOR UPDATE;
  IF _balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_user', 'balance', 0);
  END IF;
  IF _balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient', 'balance', _balance);
  END IF;
  UPDATE users SET ask_credits = _balance - p_amount WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true, 'balance', _balance - p_amount);
END;
$$;

-- 4. Vote trigger: 1 base + daily-first bonus + streak bonus
CREATE OR REPLACE FUNCTION public.handle_vote_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today_cairo date;
  _last_daily date;
  _bonus integer := 0;
  _prev_streak integer;
  _curr_streak integer;
BEGIN
  _today_cairo := (now() AT TIME ZONE 'Africa/Cairo')::date;

  SELECT last_daily_credit_date, current_streak
    INTO _last_daily, _prev_streak
    FROM users WHERE id = NEW.user_id;

  -- +1 base
  _bonus := 1;

  -- +1 if first vote of the Cairo day
  IF _last_daily IS NULL OR _last_daily <> _today_cairo THEN
    _bonus := _bonus + 1;
    UPDATE users SET last_daily_credit_date = _today_cairo WHERE id = NEW.user_id;
  END IF;

  -- +2 if streak ticked up (compare after handle_vote_rewards has updated streak)
  -- We read fresh value
  SELECT current_streak INTO _curr_streak FROM users WHERE id = NEW.user_id;
  IF _curr_streak IS NOT NULL AND _prev_streak IS NOT NULL AND _curr_streak > _prev_streak THEN
    _bonus := _bonus + 2;
  END IF;

  PERFORM public.earn_ask_credits(NEW.user_id, _bonus);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vote_ask_credits ON public.votes;
CREATE TRIGGER trg_vote_ask_credits
  AFTER INSERT ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_vote_credits();

-- 5. Challenge completion: +5 credits each side once completed
CREATE OR REPLACE FUNCTION public.handle_challenge_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.earn_ask_credits(NEW.challenger_id, 5);
    PERFORM public.earn_ask_credits(NEW.challenged_id, 5);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenge_ask_credits ON public.poll_challenges;
CREATE TRIGGER trg_challenge_ask_credits
  AFTER UPDATE ON public.poll_challenges
  FOR EACH ROW EXECUTE FUNCTION public.handle_challenge_credits();

-- 6. Predictions: +6 credits per prediction made
CREATE OR REPLACE FUNCTION public.handle_prediction_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.earn_ask_credits(NEW.user_id, 6);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prediction_ask_credits ON public.predictions;
CREATE TRIGGER trg_prediction_ask_credits
  AFTER INSERT ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.handle_prediction_credits();

-- 7. Admin analytics RPC
CREATE OR REPLACE FUNCTION public.get_ask_versa_analytics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
  _since timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  _since := now() - (p_days || ' days')::interval;

  SELECT jsonb_build_object(
    'total_queries', (SELECT COUNT(*) FROM ask_versa_queries WHERE created_at >= _since),
    'answered', (SELECT COUNT(*) FROM ask_versa_queries WHERE created_at >= _since AND answered),
    'low_data_count', (SELECT COUNT(*) FROM ask_versa_queries WHERE created_at >= _since AND low_data),
    'total_credits_spent', (SELECT COALESCE(SUM(credits_charged), 0) FROM ask_versa_queries WHERE created_at >= _since),
    'avg_credits_per_query', (SELECT ROUND(AVG(credits_charged)::numeric, 2) FROM ask_versa_queries WHERE created_at >= _since AND credits_charged > 0),
    'route_breakdown', (
      SELECT COALESCE(jsonb_object_agg(route, c), '{}'::jsonb)
      FROM (SELECT route, COUNT(*) as c FROM ask_versa_queries WHERE created_at >= _since GROUP BY route) t
    ),
    'top_questions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('question', question, 'count', c) ORDER BY c DESC), '[]'::jsonb)
      FROM (
        SELECT lower(question) as question, COUNT(*) as c
        FROM ask_versa_queries
        WHERE created_at >= _since
        GROUP BY lower(question)
        ORDER BY c DESC
        LIMIT 15
      ) q
    ),
    'low_data_questions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('question', question, 'count', c) ORDER BY c DESC), '[]'::jsonb)
      FROM (
        SELECT lower(question) as question, COUNT(*) as c
        FROM ask_versa_queries
        WHERE created_at >= _since AND low_data
        GROUP BY lower(question)
        ORDER BY c DESC
        LIMIT 15
      ) q
    ),
    'top_categories', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category_hint, 'count', c) ORDER BY c DESC), '[]'::jsonb)
      FROM (
        SELECT category_hint, COUNT(*) as c
        FROM ask_versa_queries
        WHERE created_at >= _since AND category_hint IS NOT NULL
        GROUP BY category_hint
        ORDER BY c DESC
        LIMIT 10
      ) q
    )
  ) INTO _result;

  RETURN _result;
END;
$$;
