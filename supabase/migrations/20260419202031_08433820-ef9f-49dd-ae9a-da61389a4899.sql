-- Notify all admins when a new poll suggestion is created
CREATE OR REPLACE FUNCTION public.notify_admins_new_suggestion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
  preview TEXT;
BEGIN
  preview := left(NEW.question, 90);
  FOR admin_record IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
  LOOP
    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      admin_record.user_id,
      '💡 New poll suggestion',
      preview,
      'admin_poll_suggestion',
      jsonb_build_object(
        'suggestion_id', NEW.id,
        'source', NEW.source,
        'url', '/admin?tab=suggestions'
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_suggestion ON public.poll_suggestions;
CREATE TRIGGER trg_notify_admins_new_suggestion
AFTER INSERT ON public.poll_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_new_suggestion();