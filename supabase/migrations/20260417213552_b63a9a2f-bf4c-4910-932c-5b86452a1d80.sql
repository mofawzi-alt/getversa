-- Phase 2: Notification Governance
-- 1. User notification preferences table
CREATE TABLE public.user_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_reminder boolean NOT NULL DEFAULT true,
  friend_activity boolean NOT NULL DEFAULT true,
  challenge_waiting boolean NOT NULL DEFAULT true,
  controversial_poll boolean NOT NULL DEFAULT true,
  compatibility_change boolean NOT NULL DEFAULT true,
  weekly_taste_report boolean NOT NULL DEFAULT true,
  new_category boolean NOT NULL DEFAULT true,
  missed_poll boolean NOT NULL DEFAULT true,
  predict_reveal boolean NOT NULL DEFAULT true,
  last_chance_poll boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification prefs"
  ON public.user_notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification prefs"
  ON public.user_notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notification prefs"
  ON public.user_notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all notification prefs"
  ON public.user_notification_preferences
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_notification_prefs_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Notification log table for analytics + daily cap
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  priority integer NOT NULL DEFAULT 99,
  sent_at timestamptz NOT NULL DEFAULT now(),
  opened boolean NOT NULL DEFAULT false,
  opened_at timestamptz,
  channel text NOT NULL DEFAULT 'in_app',
  data jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_notif_log_user_sent ON public.notification_log (user_id, sent_at DESC);
CREATE INDEX idx_notif_log_type_sent ON public.notification_log (notification_type, sent_at DESC);
CREATE INDEX idx_notif_log_sent_at ON public.notification_log (sent_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification log"
  ON public.notification_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notification log opened state"
  ON public.notification_log
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all notification log"
  ON public.notification_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Governance function: check whether a notification can be sent right now.
-- Returns: { allowed: boolean, reason: text, sent_today: int, displaced_id: uuid | null }
-- - Respects per-user prefs (notification_type maps to a column in user_notification_preferences)
-- - Enforces 3/day cap
-- - Enforces quiet hours (Cairo 23:00–08:00) — exception: challenge_waiting until midnight
-- - Streak protection (priority 1) bypasses cap by displacing lowest-priority entry from today
CREATE OR REPLACE FUNCTION public.can_send_notification(
  p_user_id uuid,
  p_notification_type text,
  p_priority integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pref_enabled boolean;
  _sent_today int;
  _cairo_hour int;
  _displaced_id uuid := NULL;
  _today_start timestamptz;
  _lowest_priority int;
BEGIN
  -- Cairo time
  _cairo_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'Africa/Cairo')::int;

  -- Quiet hours: 23:00–08:00 Cairo. Exception: challenge_waiting allowed until midnight (i.e. block 0–7 only).
  IF p_notification_type = 'challenge_waiting' THEN
    IF _cairo_hour >= 0 AND _cairo_hour < 8 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'quiet_hours');
    END IF;
  ELSE
    IF _cairo_hour >= 23 OR _cairo_hour < 8 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'quiet_hours');
    END IF;
  END IF;

  -- Preference check (column lookup)
  EXECUTE format(
    'SELECT COALESCE((SELECT %I FROM public.user_notification_preferences WHERE user_id = $1), true)',
    p_notification_type
  )
  INTO _pref_enabled
  USING p_user_id;

  IF NOT _pref_enabled THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'pref_disabled');
  END IF;

  -- Count today (Cairo day boundary)
  _today_start := date_trunc('day', now() AT TIME ZONE 'Africa/Cairo') AT TIME ZONE 'Africa/Cairo';
  SELECT COUNT(*) INTO _sent_today
  FROM public.notification_log
  WHERE user_id = p_user_id AND sent_at >= _today_start;

  IF _sent_today < 3 THEN
    RETURN jsonb_build_object('allowed', true, 'sent_today', _sent_today);
  END IF;

  -- Cap reached. Streak (priority 1) bypasses by displacing the lowest-priority log row from today.
  IF p_priority = 1 THEN
    SELECT id, priority INTO _displaced_id, _lowest_priority
    FROM public.notification_log
    WHERE user_id = p_user_id AND sent_at >= _today_start
    ORDER BY priority DESC, sent_at DESC
    LIMIT 1;

    IF _displaced_id IS NOT NULL AND _lowest_priority > 1 THEN
      DELETE FROM public.notification_log WHERE id = _displaced_id;
      RETURN jsonb_build_object('allowed', true, 'displaced_id', _displaced_id, 'sent_today', _sent_today - 1);
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'daily_cap_reached', 'sent_today', _sent_today);
END;
$$;

-- 4. Log a sent notification (called by edge functions after successful send)
CREATE OR REPLACE FUNCTION public.log_notification_sent(
  p_user_id uuid,
  p_notification_type text,
  p_priority integer,
  p_channel text DEFAULT 'in_app',
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.notification_log (user_id, notification_type, priority, channel, data)
  VALUES (p_user_id, p_notification_type, p_priority, p_channel, p_data)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- 5. Auto-create preferences row for new users
CREATE OR REPLACE FUNCTION public.create_default_notification_prefs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_notification_prefs_on_user ON public.users;
CREATE TRIGGER create_notification_prefs_on_user
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_prefs();

-- 6. Backfill prefs for existing users
INSERT INTO public.user_notification_preferences (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- 7. Admin analytics helper: notification stats summary
CREATE OR REPLACE FUNCTION public.get_notification_analytics(p_days int DEFAULT 30)
RETURNS TABLE (
  total_today bigint,
  total_period bigint,
  users_disabled_all bigint,
  by_type jsonb,
  daily_volume jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today_start timestamptz;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  _today_start := date_trunc('day', now() AT TIME ZONE 'Africa/Cairo') AT TIME ZONE 'Africa/Cairo';

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM notification_log WHERE sent_at >= _today_start)::bigint AS total_today,
    (SELECT COUNT(*) FROM notification_log WHERE sent_at >= now() - (p_days || ' days')::interval)::bigint AS total_period,
    (SELECT COUNT(*) FROM user_notification_preferences
       WHERE NOT (streak_reminder OR friend_activity OR challenge_waiting OR controversial_poll
         OR compatibility_change OR weekly_taste_report OR new_category OR missed_poll
         OR predict_reveal OR last_chance_poll))::bigint AS users_disabled_all,
    (SELECT COALESCE(jsonb_object_agg(notification_type, stats), '{}'::jsonb)
       FROM (
         SELECT notification_type,
                jsonb_build_object(
                  'sent', COUNT(*),
                  'opened', COUNT(*) FILTER (WHERE opened),
                  'open_rate', CASE WHEN COUNT(*) > 0
                    THEN ROUND((COUNT(*) FILTER (WHERE opened)::numeric / COUNT(*)) * 100)
                    ELSE 0 END
                ) AS stats
         FROM notification_log
         WHERE sent_at >= now() - (p_days || ' days')::interval
         GROUP BY notification_type
       ) t) AS by_type,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('date', day, 'count', cnt) ORDER BY day), '[]'::jsonb)
       FROM (
         SELECT date_trunc('day', sent_at AT TIME ZONE 'Africa/Cairo')::date AS day, COUNT(*) AS cnt
         FROM notification_log
         WHERE sent_at >= now() - (p_days || ' days')::interval
         GROUP BY day
       ) d) AS daily_volume;
END;
$$;