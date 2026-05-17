
CREATE OR REPLACE FUNCTION public.fire_campaign_launch_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true
     AND COALESCE(OLD.is_active, false) = false
  THEN
    -- Activate all polls in this campaign so they're picked up by the feed
    UPDATE public.polls
    SET is_active = true
    WHERE campaign_id = NEW.id AND is_active = false;

    -- Fire push notification once per campaign launch
    IF COALESCE(NEW.launch_notification_sent, false) = false THEN
      PERFORM net.http_post(
        url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/notify-campaign-launch',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
        body := jsonb_build_object('campaign_id', NEW.id)
      );
    END IF;
  END IF;

  -- When campaign is paused, also pause its polls so they leave the feed
  IF NEW.is_active = false AND COALESCE(OLD.is_active, true) = true THEN
    UPDATE public.polls
    SET is_active = false
    WHERE campaign_id = NEW.id AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$;
