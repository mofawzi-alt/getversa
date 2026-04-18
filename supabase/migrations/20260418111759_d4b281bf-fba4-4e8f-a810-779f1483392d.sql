-- 1. Campaign-level config: which attributes to collect, verbatim on/off
ALTER TABLE public.poll_campaigns
  ADD COLUMN IF NOT EXISTS attribute_config jsonb NOT NULL DEFAULT '{"enabled": false, "attributes": [], "verbatim": false}'::jsonb;

-- 2. Attribute ratings table (1-5 per attribute)
CREATE TABLE IF NOT EXISTS public.poll_attribute_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  choice text NOT NULL CHECK (choice IN ('A','B')),
  taste smallint CHECK (taste BETWEEN 1 AND 5),
  quality smallint CHECK (quality BETWEEN 1 AND 5),
  uniqueness smallint CHECK (uniqueness BETWEEN 1 AND 5),
  ease smallint CHECK (ease BETWEEN 1 AND 5),
  versatility smallint CHECK (versatility BETWEEN 1 AND 5),
  voter_gender text,
  voter_age_range text,
  voter_city text,
  voter_country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_par_poll ON public.poll_attribute_ratings(poll_id);

ALTER TABLE public.poll_attribute_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own ratings"
  ON public.poll_attribute_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own ratings"
  ON public.poll_attribute_ratings FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all ratings"
  ON public.poll_attribute_ratings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Brand clients view ratings for their campaigns"
  ON public.poll_attribute_ratings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM polls p
    WHERE p.id = poll_attribute_ratings.poll_id
      AND p.campaign_id IS NOT NULL
      AND is_campaign_client(auth.uid(), p.campaign_id)
  ));

-- 3. Verbatim feedback table
CREATE TABLE IF NOT EXISTS public.poll_verbatim_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  choice text NOT NULL CHECK (choice IN ('A','B')),
  feedback text NOT NULL CHECK (length(feedback) BETWEEN 1 AND 500),
  voter_gender text,
  voter_age_range text,
  voter_city text,
  voter_country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pvf_poll ON public.poll_verbatim_feedback(poll_id);

ALTER TABLE public.poll_verbatim_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own verbatim"
  ON public.poll_verbatim_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own verbatim"
  ON public.poll_verbatim_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all verbatim"
  ON public.poll_verbatim_feedback FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Brand clients view verbatim for their campaigns"
  ON public.poll_verbatim_feedback FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM polls p
    WHERE p.id = poll_verbatim_feedback.poll_id
      AND p.campaign_id IS NOT NULL
      AND is_campaign_client(auth.uid(), p.campaign_id)
  ));

-- 4. RPC: Top-2-Box attribute scores per poll
CREATE OR REPLACE FUNCTION public.get_campaign_attribute_scores(p_campaign_id uuid)
RETURNS TABLE(
  poll_id uuid,
  question text,
  attribute text,
  total_responses bigint,
  t2b_score integer,
  mean_score numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR is_campaign_client(auth.uid(), p_campaign_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.id AS pid, p.question AS q, r.taste, r.quality, r.uniqueness, r.ease, r.versatility
    FROM polls p
    LEFT JOIN poll_attribute_ratings r ON r.poll_id = p.id
    WHERE p.campaign_id = p_campaign_id
  ),
  unpiv AS (
    SELECT pid, q, 'taste'::text AS attribute, taste AS score FROM base WHERE taste IS NOT NULL
    UNION ALL SELECT pid, q, 'quality', quality FROM base WHERE quality IS NOT NULL
    UNION ALL SELECT pid, q, 'uniqueness', uniqueness FROM base WHERE uniqueness IS NOT NULL
    UNION ALL SELECT pid, q, 'ease', ease FROM base WHERE ease IS NOT NULL
    UNION ALL SELECT pid, q, 'versatility', versatility FROM base WHERE versatility IS NOT NULL
  )
  SELECT
    u.pid,
    u.q,
    u.attribute,
    COUNT(*)::bigint,
    ROUND((COUNT(*) FILTER (WHERE u.score >= 4)::numeric / NULLIF(COUNT(*),0)) * 100)::integer,
    ROUND(AVG(u.score)::numeric, 2)
  FROM unpiv u
  GROUP BY u.pid, u.q, u.attribute
  ORDER BY u.q, u.attribute;
END;
$$;

-- 5. RPC: Verbatim quotes per poll/option
CREATE OR REPLACE FUNCTION public.get_campaign_verbatims(p_campaign_id uuid, p_limit_per_poll integer DEFAULT 20)
RETURNS TABLE(
  poll_id uuid,
  question text,
  choice text,
  option_label text,
  feedback text,
  voter_gender text,
  voter_age_range text,
  voter_city text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR is_campaign_client(auth.uid(), p_campaign_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT
      p.id AS poll_id,
      p.question,
      f.choice,
      CASE WHEN f.choice = 'A' THEN p.option_a ELSE p.option_b END AS option_label,
      f.feedback,
      f.voter_gender,
      f.voter_age_range,
      f.voter_city,
      f.created_at,
      ROW_NUMBER() OVER (PARTITION BY p.id, f.choice ORDER BY f.created_at DESC) AS rn
    FROM poll_verbatim_feedback f
    JOIN polls p ON p.id = f.poll_id
    WHERE p.campaign_id = p_campaign_id
  ) t
  WHERE t.rn <= p_limit_per_poll
  ORDER BY t.poll_id, t.choice, t.created_at DESC;
END;
$$;

-- 6. RPC: Rank-shift matrix with significance flags (90% confidence z-test vs campaign baseline)
CREATE OR REPLACE FUNCTION public.get_campaign_rank_matrix(p_campaign_id uuid)
RETURNS TABLE(
  poll_id uuid,
  question text,
  segment_type text,
  segment_value text,
  total_in_segment bigint,
  pct_a integer,
  baseline_pct_a integer,
  delta integer,
  significant boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR is_campaign_client(auth.uid(), p_campaign_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH baseline AS (
    SELECT
      v.poll_id AS pid,
      COUNT(*)::numeric AS n_total,
      COUNT(*) FILTER (WHERE v.choice = 'A')::numeric AS n_a
    FROM votes v
    JOIN polls p ON p.id = v.poll_id
    WHERE p.campaign_id = p_campaign_id
    GROUP BY v.poll_id
  ),
  segs AS (
    SELECT v.poll_id AS pid, 'gender'::text AS stype, COALESCE(v.voter_gender,'unknown') AS sval, v.choice
    FROM votes v JOIN polls p ON p.id = v.poll_id WHERE p.campaign_id = p_campaign_id
    UNION ALL
    SELECT v.poll_id, 'age', COALESCE(v.voter_age_range,'unknown'), v.choice
    FROM votes v JOIN polls p ON p.id = v.poll_id WHERE p.campaign_id = p_campaign_id
    UNION ALL
    SELECT v.poll_id, 'city', COALESCE(v.voter_city,'unknown'), v.choice
    FROM votes v JOIN polls p ON p.id = v.poll_id WHERE p.campaign_id = p_campaign_id
  ),
  agg AS (
    SELECT
      s.pid,
      s.stype,
      s.sval,
      COUNT(*)::numeric AS n_seg,
      COUNT(*) FILTER (WHERE s.choice = 'A')::numeric AS n_seg_a
    FROM segs s
    GROUP BY s.pid, s.stype, s.sval
  )
  SELECT
    a.pid,
    p.question,
    a.stype,
    a.sval,
    a.n_seg::bigint,
    ROUND((a.n_seg_a / NULLIF(a.n_seg,0)) * 100)::integer AS pct_a,
    ROUND((b.n_a / NULLIF(b.n_total,0)) * 100)::integer AS baseline_pct_a,
    (ROUND((a.n_seg_a / NULLIF(a.n_seg,0)) * 100) - ROUND((b.n_a / NULLIF(b.n_total,0)) * 100))::integer AS delta,
    -- z-test (1-prop vs baseline) at 90% confidence (|z|>1.645)
    CASE
      WHEN a.n_seg < 10 OR b.n_total < 30 THEN false
      WHEN (b.n_a / NULLIF(b.n_total,0)) IN (0,1) THEN false
      ELSE abs(
        ((a.n_seg_a / a.n_seg) - (b.n_a / b.n_total))
        / NULLIF(sqrt((b.n_a / b.n_total) * (1 - (b.n_a / b.n_total)) / a.n_seg), 0)
      ) > 1.645
    END AS significant
  FROM agg a
  JOIN baseline b ON b.pid = a.pid
  JOIN polls p ON p.id = a.pid
  WHERE a.sval <> 'unknown'
  ORDER BY a.pid, a.stype, a.n_seg DESC;
END;
$$;