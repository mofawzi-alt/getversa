-- Extend poll_suggestions to support Ask Versa flow + reward on publish
ALTER TABLE public.poll_suggestions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'profile',
  ADD COLUMN IF NOT EXISTS ask_query_id uuid REFERENCES public.ask_versa_queries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_poll_id uuid REFERENCES public.polls(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS awarded_credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Make option_a / option_b nullable (Ask-sourced suggestions may only have a question)
ALTER TABLE public.poll_suggestions ALTER COLUMN option_a DROP NOT NULL;
ALTER TABLE public.poll_suggestions ALTER COLUMN option_b DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_poll_suggestions_status ON public.poll_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_poll_suggestions_user ON public.poll_suggestions(user_id);

-- Trigger: when a suggestion is approved AND linked to a published poll, award the suggester +5 credits + notify
CREATE OR REPLACE FUNCTION public.award_suggestion_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _reward integer := 5;
BEGIN
  -- Fire only when transitioning to 'approved' with a published_poll_id, and not yet awarded
  IF NEW.status = 'approved'
     AND NEW.published_poll_id IS NOT NULL
     AND COALESCE(NEW.awarded_credits, 0) = 0
     AND (OLD.status IS DISTINCT FROM 'approved' OR OLD.published_poll_id IS DISTINCT FROM NEW.published_poll_id) THEN
    PERFORM public.earn_ask_credits(NEW.user_id, _reward);
    NEW.awarded_credits := _reward;
    NEW.published_at := COALESCE(NEW.published_at, now());

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'suggestion_published',
      'Your poll is live! 🎉',
      'You earned +' || _reward || ' Ask credits. Tap to vote on it.',
      jsonb_build_object('poll_id', NEW.published_poll_id, 'suggestion_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_suggestion_on_publish ON public.poll_suggestions;
CREATE TRIGGER trg_award_suggestion_on_publish
BEFORE UPDATE ON public.poll_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.award_suggestion_on_publish();