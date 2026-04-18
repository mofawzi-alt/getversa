ALTER TABLE public.poll_campaigns
  ADD COLUMN IF NOT EXISTS drip_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS drip_start_date date,
  ADD COLUMN IF NOT EXISTS drip_polls_per_day integer;

-- Index to speed up the daily activation cron
CREATE INDEX IF NOT EXISTS idx_polls_drip_pending
  ON public.polls (campaign_id, starts_at)
  WHERE is_active = false;

-- Preview helper: returns the scheduled release date for each poll in a campaign,
-- based on its current ordering (created_at, id) and the campaign's drip settings.
CREATE OR REPLACE FUNCTION public.get_campaign_drip_preview(p_campaign_id uuid)
RETURNS TABLE(
  poll_id uuid,
  question text,
  release_day integer,
  release_date date,
  series_order integer,
  is_active boolean,
  starts_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _per_day integer;
  _start date;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.is_campaign_client(auth.uid(), p_campaign_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this campaign';
  END IF;

  SELECT drip_polls_per_day, drip_start_date
    INTO _per_day, _start
  FROM public.poll_campaigns
  WHERE id = p_campaign_id;

  RETURN QUERY
  WITH ordered AS (
    SELECT
      p.id,
      p.question,
      p.is_active,
      p.starts_at,
      ROW_NUMBER() OVER (ORDER BY p.created_at NULLS LAST, p.id) AS rn
    FROM public.polls p
    WHERE p.campaign_id = p_campaign_id
  )
  SELECT
    o.id,
    o.question,
    CASE WHEN _per_day IS NULL OR _per_day < 1 THEN 1
         ELSE FLOOR((o.rn - 1) / _per_day)::int + 1
    END AS release_day,
    CASE WHEN _start IS NULL OR _per_day IS NULL OR _per_day < 1 THEN NULL
         ELSE _start + (FLOOR((o.rn - 1) / _per_day))::int
    END AS release_date,
    ((o.rn - 1) % GREATEST(COALESCE(_per_day, 1), 1))::int + 1 AS series_order,
    o.is_active,
    o.starts_at
  FROM ordered o
  ORDER BY o.rn;
END;
$$;

-- Apply the drip schedule: stamps starts_at + series_order on each poll,
-- deactivates polls whose release day is in the future.
CREATE OR REPLACE FUNCTION public.apply_campaign_drip_schedule(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _per_day integer;
  _start date;
  _enabled boolean;
  _today date;
  _updated integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT drip_enabled, drip_polls_per_day, drip_start_date
    INTO _enabled, _per_day, _start
  FROM public.poll_campaigns
  WHERE id = p_campaign_id;

  IF NOT _enabled THEN
    RAISE EXCEPTION 'Drip is not enabled on this campaign';
  END IF;
  IF _per_day IS NULL OR _per_day < 1 THEN
    RAISE EXCEPTION 'drip_polls_per_day must be >= 1';
  END IF;
  IF _start IS NULL THEN
    RAISE EXCEPTION 'drip_start_date is required';
  END IF;

  _today := (now() AT TIME ZONE 'Africa/Cairo')::date;

  WITH ordered AS (
    SELECT
      p.id,
      ROW_NUMBER() OVER (ORDER BY p.created_at NULLS LAST, p.id) AS rn
    FROM public.polls p
    WHERE p.campaign_id = p_campaign_id
  ),
  scheduled AS (
    SELECT
      o.id,
      ((o.rn - 1) % _per_day)::int + 1 AS s_order,
      (_start + (FLOOR((o.rn - 1) / _per_day))::int) AS r_date
    FROM ordered o
  )
  UPDATE public.polls p
  SET
    series_order = s.s_order,
    starts_at = (s.r_date::timestamp AT TIME ZONE 'Africa/Cairo') + INTERVAL '9 hours',
    is_active = (s.r_date <= _today)
  FROM scheduled s
  WHERE p.id = s.id;

  GET DIAGNOSTICS _updated = ROW_COUNT;

  RETURN jsonb_build_object('updated', _updated, 'start_date', _start, 'polls_per_day', _per_day);
END;
$$;