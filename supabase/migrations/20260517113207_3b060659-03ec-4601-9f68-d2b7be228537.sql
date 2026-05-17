
-- 1. Default new campaigns to paused
ALTER TABLE public.poll_campaigns ALTER COLUMN is_active SET DEFAULT false;

-- 2. Demographic targeting columns
ALTER TABLE public.poll_campaigns
  ADD COLUMN IF NOT EXISTS target_gender text,
  ADD COLUMN IF NOT EXISTS target_age_ranges text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_countries text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_cities text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS launch_notification_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS launch_notification_sent_at timestamptz;

-- 3. Trigger function: when campaign flips from inactive→active and notification not yet sent,
-- call edge function via pg_net.
CREATE OR REPLACE FUNCTION public.fire_campaign_launch_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true
     AND COALESCE(OLD.is_active, false) = false
     AND COALESCE(NEW.launch_notification_sent, false) = false
  THEN
    PERFORM net.http_post(
      url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/notify-campaign-launch',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
      body := jsonb_build_object('campaign_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fire_campaign_launch_notification ON public.poll_campaigns;
CREATE TRIGGER trg_fire_campaign_launch_notification
AFTER UPDATE OF is_active ON public.poll_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.fire_campaign_launch_notification();
