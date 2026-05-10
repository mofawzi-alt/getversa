-- Auto-finalize Live Asks once their 15-min voting window passes
CREATE OR REPLACE FUNCTION public.auto_finalize_live_asks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.live_asks
  SET status = 'finalized',
      finalized_at = now(),
      updated_at = now()
  WHERE status = 'active'
    AND reveal_at <= now();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Backfill any existing active asks whose window already closed
SELECT public.auto_finalize_live_asks();

-- Make sure pg_cron is available, then schedule every 2 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-finalize-live-asks') THEN
    PERFORM cron.unschedule('auto-finalize-live-asks');
  END IF;
END $$;

SELECT cron.schedule(
  'auto-finalize-live-asks',
  '*/2 * * * *',
  $$ SELECT public.auto_finalize_live_asks(); $$
);