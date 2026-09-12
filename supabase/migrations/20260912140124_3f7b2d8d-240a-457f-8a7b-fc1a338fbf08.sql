CREATE OR REPLACE FUNCTION public.notify_new_poll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    -- Throttle device pushes: at most one new-poll push per 10 minutes
    SELECT count(*) INTO v_recent_push
    FROM notification_log
    WHERE notification_type = 'new_poll'
      AND sent_at > now() - interval '10 minutes';

    IF v_recent_push = 0 THEN
      INSERT INTO notification_log (user_id, notification_type, title, body, sent_at)
      VALUES (COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid),
              'new_poll',
              '🔥 New Poll!',
              'New battle just dropped: ' || LEFT(NEW.question, 60),
              now());

      PERFORM net.http_post(
        url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
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

DROP TRIGGER IF EXISTS notify_new_poll_insert ON public.polls;
CREATE TRIGGER notify_new_poll_insert
AFTER INSERT ON public.polls
FOR EACH ROW EXECUTE FUNCTION public.notify_new_poll();

DROP TRIGGER IF EXISTS notify_new_poll_activate ON public.polls;
CREATE TRIGGER notify_new_poll_activate
AFTER UPDATE OF is_active ON public.polls
FOR EACH ROW
WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.is_active = true)
EXECUTE FUNCTION public.notify_new_poll();