CREATE OR REPLACE FUNCTION public.can_send_notification(p_user_id uuid, p_notification_type text, p_priority integer, p_title text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _pref_enabled boolean;
  _sent_today int;
  _cairo_hour int;
  _displaced_id uuid := NULL;
  _today_start timestamptz;
  _lowest_priority int;
  _dup_count int;
BEGIN
  _cairo_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'Africa/Cairo')::int;

  IF p_notification_type = 'challenge_waiting' THEN
    IF _cairo_hour >= 0 AND _cairo_hour < 7 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'quiet_hours');
    END IF;
  ELSE
    IF _cairo_hour >= 22 OR _cairo_hour < 7 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'quiet_hours');
    END IF;
  END IF;

  -- Preference check: if this type has no preference column, treat as enabled.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_notification_preferences'
      AND column_name = p_notification_type
  ) THEN
    EXECUTE format(
      'SELECT COALESCE((SELECT %I FROM public.user_notification_preferences WHERE user_id = $1), true)',
      p_notification_type
    )
    INTO _pref_enabled
    USING p_user_id;
  ELSE
    _pref_enabled := true;
  END IF;

  IF NOT _pref_enabled THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'pref_disabled');
  END IF;

  IF p_title IS NOT NULL THEN
    SELECT COUNT(*) INTO _dup_count
    FROM public.notification_log
    WHERE user_id = p_user_id
      AND notification_type = p_notification_type
      AND COALESCE(data->>'title', '') = p_title
      AND sent_at >= now() - interval '6 hours';

    IF _dup_count > 0 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'duplicate');
    END IF;
  END IF;

  _today_start := date_trunc('day', now() AT TIME ZONE 'Africa/Cairo') AT TIME ZONE 'Africa/Cairo';
  SELECT COUNT(*) INTO _sent_today
  FROM public.notification_log
  WHERE user_id = p_user_id AND sent_at >= _today_start;

  IF _sent_today < 3 THEN
    RETURN jsonb_build_object('allowed', true, 'sent_today', _sent_today);
  END IF;

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
$function$;