
-- Ensure pg_cron + pg_net available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedules with these names
DO $$
BEGIN
  PERFORM cron.unschedule('release-daily-calendar');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('calendar-pre-release-check');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Daily 5 AM UTC = 7 AM Cairo
SELECT cron.schedule(
  'release-daily-calendar',
  '0 5 * * *',
  $$ SELECT net.http_post(
    url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/release-daily-calendar',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

-- Hourly admin warnings
SELECT cron.schedule(
  'calendar-pre-release-check',
  '0 * * * *',
  $$ SELECT net.http_post(
    url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/calendar-pre-release-check',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);
