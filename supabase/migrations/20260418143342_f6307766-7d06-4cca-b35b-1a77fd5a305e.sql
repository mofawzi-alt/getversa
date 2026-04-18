
-- 1. Extend poll_campaigns: add campaign_type, panel_incentive_points, allow 'panel_only' visibility
ALTER TABLE public.poll_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS panel_incentive_points integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS panel_size_target integer DEFAULT 50;

-- Validate campaign_type values
CREATE OR REPLACE FUNCTION public.validate_campaign_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.campaign_type NOT IN ('standard', 'focus_group') THEN
    RAISE EXCEPTION 'Invalid campaign_type: %. Must be standard or focus_group', NEW.campaign_type;
  END IF;
  IF NEW.visibility_mode NOT IN ('mixed', 'bundle_only', 'hero_only', 'panel_only') THEN
    RAISE EXCEPTION 'Invalid visibility_mode: %', NEW.visibility_mode;
  END IF;
  -- Force panel_only for focus_group campaigns
  IF NEW.campaign_type = 'focus_group' THEN
    NEW.visibility_mode := 'panel_only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_campaign_type_trg ON public.poll_campaigns;
CREATE TRIGGER validate_campaign_type_trg
  BEFORE INSERT OR UPDATE ON public.poll_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_type();

-- 2. campaign_panelists table
CREATE TABLE IF NOT EXISTS public.campaign_panelists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.poll_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  dropped_at timestamptz,
  UNIQUE(campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_panelists_campaign ON public.campaign_panelists(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_panelists_user ON public.campaign_panelists(user_id);

CREATE OR REPLACE FUNCTION public.validate_panelist_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('invited', 'accepted', 'completed', 'dropped') THEN
    RAISE EXCEPTION 'Invalid panelist status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_panelist_status_trg ON public.campaign_panelists;
CREATE TRIGGER validate_panelist_status_trg
  BEFORE INSERT OR UPDATE ON public.campaign_panelists
  FOR EACH ROW EXECUTE FUNCTION public.validate_panelist_status();

ALTER TABLE public.campaign_panelists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all panelists"
  ON public.campaign_panelists FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Brand clients view their campaign panelists"
  ON public.campaign_panelists FOR SELECT
  TO authenticated
  USING (is_campaign_client(auth.uid(), campaign_id));

CREATE POLICY "Panelists view own membership"
  ON public.campaign_panelists FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Panelists update own membership"
  ON public.campaign_panelists FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Helper: is current user a panelist for this campaign?
CREATE OR REPLACE FUNCTION public.is_campaign_panelist(_user_id uuid, _campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_panelists
    WHERE user_id = _user_id
      AND campaign_id = _campaign_id
      AND status IN ('invited', 'accepted', 'completed')
  );
$$;

-- 4. campaign_verbatim_themes table (AI-clustered themes cache)
CREATE TABLE IF NOT EXISTS public.campaign_verbatim_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.poll_campaigns(id) ON DELETE CASCADE,
  theme_label text NOT NULL,
  theme_summary text NOT NULL,
  supporting_quote_count integer NOT NULL DEFAULT 0,
  sample_quotes jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generation_run_id uuid NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verbatim_themes_campaign ON public.campaign_verbatim_themes(campaign_id, generated_at DESC);

ALTER TABLE public.campaign_verbatim_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all themes"
  ON public.campaign_verbatim_themes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Brand clients view themes for their campaigns"
  ON public.campaign_verbatim_themes FOR SELECT
  TO authenticated
  USING (is_campaign_client(auth.uid(), campaign_id));

-- 5. Tighten polls SELECT policy: focus-group polls are panel/admin/client only
DROP POLICY IF EXISTS "Anyone can view active polls" ON public.polls;

CREATE POLICY "Public can view non-focus-group active polls"
  ON public.polls FOR SELECT
  TO public
  USING (
    is_active = true
    AND (
      campaign_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.poll_campaigns pc
        WHERE pc.id = polls.campaign_id
          AND pc.campaign_type = 'focus_group'
      )
    )
  );

CREATE POLICY "Panelists view focus-group polls"
  ON public.polls FOR SELECT
  TO authenticated
  USING (
    campaign_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.poll_campaigns pc
      WHERE pc.id = polls.campaign_id
        AND pc.campaign_type = 'focus_group'
    )
    AND is_campaign_panelist(auth.uid(), campaign_id)
  );

-- 6. Update generate_daily_queue to also exclude panel_only campaigns
CREATE OR REPLACE FUNCTION public.generate_daily_queue(p_user_id uuid)
 RETURNS TABLE(poll_id uuid, queue_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _queue_date date;
  _limit integer := 15;
  _first_day_limit integer := 20;
  _is_first_day boolean;
  _user_age_range text;
  _actual_limit integer;
  _cairo_hour integer;
  _batch_limit integer;
  _seed double precision;
BEGIN
  _queue_date := CASE 
    WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'Africa/Cairo') < 9 
    THEN ((now() AT TIME ZONE 'Africa/Cairo') - INTERVAL '1 day')::date
    ELSE (now() AT TIME ZONE 'Africa/Cairo')::date
  END;
  
  _cairo_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'Africa/Cairo')::integer;
  _seed := abs(hashtext(_queue_date::text || p_user_id::text)) / 2147483647.0;
  
  IF EXISTS (SELECT 1 FROM daily_poll_queues dpq WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date) THEN
    SELECT ds.daily_limit, ds.first_day_limit INTO _limit, _first_day_limit 
    FROM daily_poll_settings ds LIMIT 1;
    _limit := COALESCE(_limit, 15);
    _first_day_limit := COALESCE(_first_day_limit, 20);
    
    SELECT (u.first_vote_date IS NULL) INTO _is_first_day
    FROM users u WHERE u.id = p_user_id;
    _actual_limit := CASE WHEN COALESCE(_is_first_day, true) THEN _first_day_limit ELSE _limit END;
    
    IF _cairo_hour >= 19 THEN
      _batch_limit := _actual_limit;
    ELSIF _cairo_hour >= 14 THEN
      _batch_limit := CEIL(_actual_limit * 0.7);
    ELSE
      _batch_limit := CEIL(_actual_limit * 0.4);
    END IF;
    
    IF (SELECT COUNT(*) FROM daily_poll_queues dpq WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date) < _batch_limit THEN
      SELECT u.age_range INTO _user_age_range FROM users u WHERE u.id = p_user_id;
      
      INSERT INTO daily_poll_queues (user_id, poll_id, queue_date, queue_order)
      SELECT p_user_id, sub.id, _queue_date, 
        (SELECT COALESCE(MAX(dq2.queue_order), 0) FROM daily_poll_queues dq2 WHERE dq2.user_id = p_user_id AND dq2.queue_date = _queue_date) + ROW_NUMBER() OVER ()::integer
      FROM (
        SELECT p.id
        FROM polls p
        LEFT JOIN (SELECT v.poll_id, COUNT(*) as vote_count FROM votes v GROUP BY v.poll_id) vc ON vc.poll_id = p.id
        LEFT JOIN poll_campaigns pc ON pc.id = p.campaign_id
        WHERE p.is_active = true
          AND NOT public.is_poll_expired(p.expiry_type, p.ends_at)
          AND (p.campaign_id IS NULL OR (
            COALESCE(pc.visibility_mode, 'mixed') NOT IN ('bundle_only', 'panel_only')
            AND COALESCE(pc.campaign_type, 'standard') <> 'focus_group'
          ))
          AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.poll_id = p.id AND v.user_id = p_user_id)
          AND NOT EXISTS (SELECT 1 FROM skipped_polls s WHERE s.poll_id = p.id AND s.user_id = p_user_id)
          AND NOT EXISTS (SELECT 1 FROM daily_poll_queues dq WHERE dq.poll_id = p.id AND dq.user_id = p_user_id)
        ORDER BY
          CASE WHEN p.is_hot_take = true THEN 0 ELSE 1 END,
          CASE WHEN p.created_at >= (now() - INTERVAL '24 hours') THEN 0 ELSE 1 END,
          COALESCE(p.weight_score, 500) DESC,
          COALESCE(vc.vote_count, 0) DESC,
          md5(p.id::text || _queue_date::text || p_user_id::text)
        LIMIT (_batch_limit - (SELECT COUNT(*) FROM daily_poll_queues dpq WHERE dpq.user_id = p_user_id AND dpq.queue_date = _queue_date))
      ) sub;
    END IF;
    
    RETURN QUERY 
    SELECT dpq.poll_id, dpq.queue_order 
    FROM daily_poll_queues dpq 
    JOIN polls p ON p.id = dpq.poll_id
    WHERE dpq.user_id = p_user_id 
      AND dpq.queue_date = _queue_date
      AND dpq.queue_order <= _batch_limit
      AND p.is_active = true
      AND NOT public.is_poll_expired(p.expiry_type, p.ends_at)
    ORDER BY dpq.queue_order;
    RETURN;
  END IF;
  
  SELECT ds.daily_limit, ds.first_day_limit INTO _limit, _first_day_limit 
  FROM daily_poll_settings ds LIMIT 1;
  _limit := COALESCE(_limit, 15);
  _first_day_limit := COALESCE(_first_day_limit, 20);
  
  SELECT (u.first_vote_date IS NULL) INTO _is_first_day
  FROM users u WHERE u.id = p_user_id;
  _actual_limit := CASE WHEN COALESCE(_is_first_day, true) THEN _first_day_limit ELSE _limit END;
  
  SELECT u.age_range INTO _user_age_range FROM users u WHERE u.id = p_user_id;
  
  IF _cairo_hour >= 19 THEN
    _batch_limit := _actual_limit;
  ELSIF _cairo_hour >= 14 THEN
    _batch_limit := CEIL(_actual_limit * 0.7);
  ELSE
    _batch_limit := CEIL(_actual_limit * 0.4);
  END IF;
  
  INSERT INTO daily_poll_queues (user_id, poll_id, queue_date, queue_order)
  SELECT p_user_id, sub.id, _queue_date, ROW_NUMBER() OVER ()::integer
  FROM (
    SELECT p.id
    FROM polls p
    LEFT JOIN (SELECT v.poll_id, COUNT(*) as vote_count FROM votes v GROUP BY v.poll_id) vc ON vc.poll_id = p.id
    LEFT JOIN poll_campaigns pc ON pc.id = p.campaign_id
    WHERE p.is_active = true
      AND NOT public.is_poll_expired(p.expiry_type, p.ends_at)
      AND (p.campaign_id IS NULL OR (
        COALESCE(pc.visibility_mode, 'mixed') NOT IN ('bundle_only', 'panel_only')
        AND COALESCE(pc.campaign_type, 'standard') <> 'focus_group'
      ))
      AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.poll_id = p.id AND v.user_id = p_user_id)
      AND NOT EXISTS (SELECT 1 FROM skipped_polls s WHERE s.poll_id = p.id AND s.user_id = p_user_id)
      AND NOT EXISTS (SELECT 1 FROM daily_poll_queues dq WHERE dq.poll_id = p.id AND dq.user_id = p_user_id)
    ORDER BY
      CASE WHEN p.is_hot_take = true THEN 0 ELSE 1 END,
      CASE WHEN p.created_at >= (now() - INTERVAL '24 hours') THEN 0 ELSE 1 END,
      (
        COALESCE(p.weight_score, 500) * 0.4
        + LEAST(COALESCE(vc.vote_count, 0), 500) * 0.3
        + (abs(hashtext(p.id::text || _queue_date::text || p_user_id::text)) % 500) * 0.3
      ) DESC,
      md5(p.id::text || _queue_date::text || p_user_id::text)
    LIMIT _actual_limit
  ) sub;
  
  RETURN QUERY 
  SELECT dpq.poll_id, dpq.queue_order 
  FROM daily_poll_queues dpq 
  JOIN polls p ON p.id = dpq.poll_id
  WHERE dpq.user_id = p_user_id 
    AND dpq.queue_date = _queue_date
    AND dpq.queue_order <= _batch_limit
    AND p.is_active = true
    AND NOT public.is_poll_expired(p.expiry_type, p.ends_at)
  ORDER BY dpq.queue_order;
END;
$function$;

-- 7. Helper: assemble panel by demographic filter (admin-only)
CREATE OR REPLACE FUNCTION public.assemble_focus_group_panel(
  p_campaign_id uuid,
  p_target_size integer,
  p_age_range text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_city text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inserted integer;
  _capped integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can assemble panels';
  END IF;

  -- Cap panel size at 100 for v1 (predictable AI synthesis cost)
  _capped := LEAST(GREATEST(p_target_size, 1), 100);

  WITH eligible AS (
    SELECT u.id
    FROM users u
    WHERE u.id NOT IN (SELECT user_id FROM campaign_panelists WHERE campaign_id = p_campaign_id)
      AND (p_age_range IS NULL OR u.age_range = p_age_range)
      AND (p_gender IS NULL OR u.gender = p_gender)
      AND (p_city IS NULL OR u.city = p_city)
    ORDER BY random()
    LIMIT _capped
  )
  INSERT INTO campaign_panelists (campaign_id, user_id, status)
  SELECT p_campaign_id, e.id, 'invited'
  FROM eligible e;

  GET DIAGNOSTICS _inserted = ROW_COUNT;
  RETURN _inserted;
END;
$$;

-- 8. Helper: count eligible users for a demographic filter (admin-only, for builder preview)
CREATE OR REPLACE FUNCTION public.count_eligible_panelists(
  p_age_range text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_city text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can preview eligible panelists';
  END IF;

  SELECT COUNT(*)::integer INTO _count
  FROM users u
  WHERE (p_age_range IS NULL OR u.age_range = p_age_range)
    AND (p_gender IS NULL OR u.gender = p_gender)
    AND (p_city IS NULL OR u.city = p_city);

  RETURN _count;
END;
$$;

-- 9. Helper: get focus group panel stats (admin + brand client)
CREATE OR REPLACE FUNCTION public.get_focus_group_stats(p_campaign_id uuid)
RETURNS TABLE(
  total_panelists bigint,
  invited_count bigint,
  accepted_count bigint,
  completed_count bigint,
  dropped_count bigint,
  completion_rate integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR is_campaign_client(auth.uid(), p_campaign_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE status = 'invited')::bigint,
    COUNT(*) FILTER (WHERE status = 'accepted')::bigint,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint,
    COUNT(*) FILTER (WHERE status = 'dropped')::bigint,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)) * 100)::integer
      ELSE 0 END
  FROM campaign_panelists
  WHERE campaign_id = p_campaign_id;
END;
$$;
