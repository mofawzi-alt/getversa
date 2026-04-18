CREATE OR REPLACE FUNCTION public.notify_new_poll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_visibility text;
  v_campaign_type text;
BEGIN
  IF NEW.is_active = true THEN
    -- Check if poll belongs to a private/panel campaign
    IF NEW.campaign_id IS NOT NULL THEN
      SELECT visibility_mode, campaign_type
        INTO v_visibility, v_campaign_type
      FROM poll_campaigns
      WHERE id = NEW.campaign_id;

      -- Skip broadcast for focus groups / panel-only campaigns entirely
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

    PERFORM net.http_post(
      url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/send-push-notification',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
      body := jsonb_build_object(
        'title', '🔥 New Poll!',
        'body', 'New battle just dropped: ' || LEFT(NEW.question, 60),
        'url', '/home',
        'poll_id', NEW.id::text
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;