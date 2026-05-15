-- Notify Live Ask askers on key vote milestones via push notification.
-- Triggered after each insert into live_ask_votes. Throttled milestones:
--   1, 5, 10, 25, 50, 100, 250, 500, 1000 votes.

CREATE OR REPLACE FUNCTION public.notify_live_ask_asker_on_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ask record;
  _new_count int;
  _milestones int[] := ARRAY[1, 5, 10, 25, 50, 100, 250, 500, 1000];
  _title text;
  _body text;
BEGIN
  -- Get the ask + the freshly-updated vote_count
  -- (live_ask_increment_votes fires on the same insert; row order isn't guaranteed,
  -- so compute the count directly from live_ask_votes for accuracy.)
  SELECT la.id, la.asker_id, la.question, la.option_a, la.option_b
  INTO _ask
  FROM public.live_asks la
  WHERE la.id = NEW.live_ask_id;

  IF _ask.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::int INTO _new_count
  FROM public.live_ask_votes
  WHERE live_ask_id = NEW.live_ask_id;

  -- Only notify on milestone counts
  IF NOT (_new_count = ANY(_milestones)) THEN
    RETURN NEW;
  END IF;

  IF _new_count = 1 THEN
    _title := '🎉 First vote on your Live Ask!';
    _body  := 'Someone just weighed in on "' || left(_ask.question, 60) || '"';
  ELSE
    _title := '🔥 ' || _new_count || ' votes on your Live Ask';
    _body  := 'Tap to see how Egypt is leaning on "' || left(_ask.question, 50) || '"';
  END IF;

  -- Fire-and-forget push (also writes an in-app notification inside the function)
  PERFORM net.http_post(
    url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
    body := jsonb_build_object(
      'title', _title,
      'body',  _body,
      'url',   '/live-ask/' || _ask.id::text,
      'user_ids', ARRAY[_ask.asker_id::text]
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a vote because of notification issues
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_live_ask_asker_on_vote ON public.live_ask_votes;
CREATE TRIGGER trg_notify_live_ask_asker_on_vote
AFTER INSERT ON public.live_ask_votes
FOR EACH ROW
EXECUTE FUNCTION public.notify_live_ask_asker_on_vote();