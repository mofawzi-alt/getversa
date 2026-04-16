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

  -- Store in-app notifications for each friend (no push - daily digest handles that)
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

  -- Per-vote push notification removed. Friends now receive ONE daily digest
  -- via the friend-activity-digest edge function (cron 7 PM Cairo).
  
  RETURN NEW;
END;
$function$;