-- Schedule the 9 PM Cairo evening verdict push notification (6 PM UTC)
SELECT cron.schedule(
  'evening-verdict-push',
  '0 18 * * *',
  $$SELECT net.http_post(
    url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/evening-verdict-push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
    body := '{}'::jsonb
  );$$
);