CREATE OR REPLACE FUNCTION public.notify_new_poll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_visibility text;
  v_campaign_type text;
  v_recent_push int;
BEGIN
  IF NEW.is_active = true THEN
    IF NEW.campaign_id IS NOT NULL THEN
      SELECT visibility_mode, campaign_type
        INTO v_visibility, v_campaign_type
      FROM poll_campaigns
      WHERE id = NEW.campaign_id;

      IF v_campaign_type = 'focus_group' OR v_visibility = 'panel_only' THEN
        RETURN NEW;
      END IF;
    END IF;

    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT
      u.id,
      '🔥 New Poll!',
      'New battle just dropped: ' || LEFT(NEW.question, 60),
      'new_poll',
      jsonb_build_object('poll_id', NEW.id)
    FROM users u
    WHERE u.id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);

    SELECT count(*) INTO v_recent_push
    FROM notification_log
    WHERE notification_type = 'new_poll'
      AND sent_at > now() - interval '10 minutes';

    IF v_recent_push = 0 THEN
      INSERT INTO notification_log (user_id, notification_type, priority, channel, sent_at, data)
      VALUES (COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid),
              'new_poll',
              5,
              'push',
              now(),
              jsonb_build_object('poll_id', NEW.id, 'title', '🔥 New Poll!'));

      PERFORM net.http_post(
        url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'title', '🔥 New Poll!',
          'body', 'New battle just dropped: ' || LEFT(NEW.question, 60),
          'url', '/home',
          'poll_id', NEW.id::text
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_new_poll() FROM PUBLIC, anon, authenticated;