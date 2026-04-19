
-- 1. Kill the immediate per-poll blast trigger (this was sending 60+ notifications per poll insert)
DROP TRIGGER IF EXISTS on_new_poll_notify ON public.polls;

-- 2. Add new pref column for the daily 7am poll-batch notification
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS daily_poll_batch boolean NOT NULL DEFAULT true;

-- 3. Update governance analytics to include the new pref column in the "disabled all" check
CREATE OR REPLACE FUNCTION public.get_notification_analytics(p_days integer DEFAULT 30)
 RETURNS TABLE(total_today bigint, total_period bigint, users_disabled_all bigint, by_type jsonb, daily_volume jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         OR predict_reveal OR last_chance_poll OR daily_poll_batch))::bigint AS users_disabled_all,
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
$function$;
