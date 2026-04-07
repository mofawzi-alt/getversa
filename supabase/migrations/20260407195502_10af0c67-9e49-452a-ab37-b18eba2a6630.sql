
-- Replace the notify_new_poll function to also trigger real push via pg_net
CREATE OR REPLACE FUNCTION public.notify_new_poll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only notify for active polls
  IF NEW.is_active = true THEN
    -- Store in-app notification for all users
    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT 
      u.id,
      '🔥 New Poll!',
      'New battle just dropped: ' || LEFT(NEW.question, 60),
      'new_poll',
      jsonb_build_object('poll_id', NEW.id)
    FROM users u
    WHERE u.id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);

    -- Trigger real push notification via edge function
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
      ),
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
