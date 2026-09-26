CREATE OR REPLACE FUNCTION public.notify_new_poll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_visibility text;
  v_campaign_type text;
  v_countries text[];
  v_targeted boolean;
  v_ids uuid[];
BEGIN
  IF NEW.is_active = true THEN
    IF NEW.campaign_id IS NOT NULL THEN
      SELECT visibility_mode, campaign_type INTO v_visibility, v_campaign_type
      FROM poll_campaigns WHERE id = NEW.campaign_id;
      IF v_campaign_type = 'focus_group' OR v_visibility = 'panel_only' THEN
        RETURN NEW;
      END IF;
    END IF;

    v_countries := CASE
      WHEN NEW.target_countries IS NOT NULL AND array_length(NEW.target_countries,1) > 0 THEN NEW.target_countries
      WHEN NEW.target_country IS NOT NULL AND NEW.target_country <> 'All' AND NEW.target_country <> '' THEN ARRAY[NEW.target_country]
      ELSE NULL END;
    v_targeted := v_countries IS NOT NULL
      OR (NEW.target_gender IS NOT NULL AND NEW.target_gender NOT IN ('All',''))
      OR (NEW.target_age_range IS NOT NULL AND NEW.target_age_range NOT IN ('All',''));

    SELECT array_agg(u.id) INTO v_ids
    FROM users u
    WHERE u.id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (v_countries IS NULL OR u.country IS NULL OR u.country = ANY(v_countries))
      AND (NEW.target_gender IS NULL OR NEW.target_gender IN ('All','') OR u.gender IS NULL
           OR u.gender = ANY(string_to_array(replace(NEW.target_gender,' ',''), ',')))
      AND (NEW.target_age_range IS NULL OR NEW.target_age_range IN ('All','') OR u.age_range IS NULL
           OR u.age_range = ANY(string_to_array(replace(NEW.target_age_range,' ',''), ',')));

    IF v_ids IS NULL OR array_length(v_ids,1) IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT uid, '🔥 New Poll!', 'New battle just dropped: ' || LEFT(NEW.question, 60), 'new_poll',
           jsonb_build_object('poll_id', NEW.id)
    FROM unnest(v_ids) AS uid;

    INSERT INTO notification_log (user_id, notification_type, priority, channel, sent_at, data)
    VALUES (COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid),
            'new_poll', 5, 'push', now(),
            jsonb_build_object('poll_id', NEW.id, 'title', '🔥 New Poll!'));

    PERFORM net.http_post(
      url := 'https://jfpwuzifydxlbrrcofjh.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'title', '🔥 New Poll!',
        'body', 'New battle just dropped: ' || LEFT(NEW.question, 60),
        'url', '/home',
        'poll_id', NEW.id::text,
        'notification_type', 'new_poll',
        'governance_checked', true
      ) || CASE WHEN v_targeted THEN jsonb_build_object('user_ids', to_jsonb(v_ids::text[])) ELSE '{}'::jsonb END
    );
  END IF;
  RETURN NEW;
END;
$function$;