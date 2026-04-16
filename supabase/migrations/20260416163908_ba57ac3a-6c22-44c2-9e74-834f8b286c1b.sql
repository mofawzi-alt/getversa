
-- Update notify_friends_on_vote to also send push notifications via edge function
CREATE OR REPLACE FUNCTION public.notify_friends_on_vote()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _friend record;
  _poll_question text;
  _voter_username text;
  _friend_ids uuid[];
BEGIN
  -- Get poll question
  SELECT question INTO _poll_question FROM polls WHERE id = NEW.poll_id;
  
  -- Get voter username
  SELECT username INTO _voter_username FROM users WHERE id = NEW.user_id;
  
  -- Collect friend IDs who haven't voted on this poll
  _friend_ids := ARRAY(
    SELECT 
      CASE 
        WHEN f.requester_id = NEW.user_id THEN f.recipient_id
        ELSE f.requester_id
      END
    FROM friendships f
    WHERE f.status = 'accepted'
      AND (f.requester_id = NEW.user_id OR f.recipient_id = NEW.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM votes v 
        WHERE v.poll_id = NEW.poll_id 
          AND v.user_id = CASE 
            WHEN f.requester_id = NEW.user_id THEN f.recipient_id
            ELSE f.requester_id
          END
      )
  );

  -- Store in-app notifications for each friend
  FOR _friend IN 
    SELECT unnest(_friend_ids) as friend_id
  LOOP
    INSERT INTO notifications (user_id, title, body, type, data)
    VALUES (
      _friend.friend_id,
      'Your friend voted!',
      COALESCE(_voter_username, 'A friend') || ' just voted on: ' || LEFT(_poll_question, 50),
      'friend_voted',
      jsonb_build_object(
        'poll_id', NEW.poll_id,
        'voter_id', NEW.user_id,
        'voter_username', _voter_username
      )
    );
  END LOOP;

  -- Send real push notifications via edge function
  IF array_length(_friend_ids, 1) > 0 THEN
    PERFORM net.http_post(
      url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/friend-voted-push',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
      body := jsonb_build_object(
        'voter_username', _voter_username,
        'voter_id', NEW.user_id::text,
        'poll_id', NEW.poll_id::text,
        'poll_question', _poll_question,
        'friend_ids', _friend_ids
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Schedule personalized poll push every 4 hours
SELECT cron.schedule(
  'personalized-poll-push',
  '0 */4 * * *',
  $$SELECT net.http_post(
    url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/personalized-poll-push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

-- Schedule weekly recap push — Sundays at 4 PM UTC (6 PM Cairo)
SELECT cron.schedule(
  'weekly-recap-push',
  '0 16 * * 0',
  $$SELECT net.http_post(
    url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/weekly-recap-push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

-- Schedule social proof nudge — daily at 1 PM UTC (3 PM Cairo)
SELECT cron.schedule(
  'social-proof-nudge',
  '0 13 * * *',
  $$SELECT net.http_post(
    url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/social-proof-nudge',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
    body := '{}'::jsonb
  );$$
);
