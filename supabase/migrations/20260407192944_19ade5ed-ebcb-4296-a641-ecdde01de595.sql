
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to notify users when a new poll is created
CREATE OR REPLACE FUNCTION public.notify_new_poll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only notify for active polls
  IF NEW.is_active = true THEN
    -- Store notification for all users
    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT 
      u.id,
      '🔥 New Poll!',
      'New battle just dropped: ' || LEFT(NEW.question, 60),
      'new_poll',
      jsonb_build_object('poll_id', NEW.id)
    FROM users u
    WHERE u.id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on polls table
DROP TRIGGER IF EXISTS on_new_poll_notify ON polls;
CREATE TRIGGER on_new_poll_notify
  AFTER INSERT ON polls
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_poll();
