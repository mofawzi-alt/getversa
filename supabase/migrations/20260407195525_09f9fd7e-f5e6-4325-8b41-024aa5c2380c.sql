
CREATE OR REPLACE FUNCTION public.notify_new_poll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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

    -- Send real push notifications via edge function
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
