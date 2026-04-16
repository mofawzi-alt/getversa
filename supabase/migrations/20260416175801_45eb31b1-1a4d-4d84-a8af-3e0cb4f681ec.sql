CREATE OR REPLACE FUNCTION public.handle_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _recipient_id uuid;
  _sender_username text;
  _push_title text;
  _push_body text;
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  SELECT CASE WHEN user1_id = NEW.sender_id THEN user2_id ELSE user1_id END
  INTO _recipient_id
  FROM public.conversations WHERE id = NEW.conversation_id;

  SELECT username INTO _sender_username FROM public.users WHERE id = NEW.sender_id;

  _push_title := COALESCE(_sender_username, 'A friend') || ' messaged you';
  _push_body := CASE
      WHEN NEW.message_type = 'poll_share' THEN '📊 Shared a poll with you'
      ELSE LEFT(COALESCE(NEW.content, ''), 80)
    END;

  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (
    _recipient_id,
    _push_title,
    _push_body,
    'new_message',
    jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id)
  );

  -- Send web push notification to recipient's devices (skip duplicate in-app insert)
  PERFORM net.http_post(
    url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcHd1emlmeWR4bGJycmNvZmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTcxMzAsImV4cCI6MjA4NjQ3MzEzMH0.B3LkHkHCdiyRGLg4OLM_V4c0zonDAI_Fkqz0mC1khYs"}'::jsonb,
    body := jsonb_build_object(
      'title', _push_title,
      'body', _push_body,
      'url', '/messages/' || NEW.conversation_id::text,
      'user_ids', ARRAY[_recipient_id::text],
      'skip_in_app', true
    )
  );

  RETURN NEW;
END;
$function$;