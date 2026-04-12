
CREATE OR REPLACE FUNCTION public.set_public_vote_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  SELECT verified_public_figure INTO NEW.is_public_vote
  FROM public.users
  WHERE id = NEW.user_id;
  
  NEW.is_public_vote := COALESCE(NEW.is_public_vote, false);
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_public_vote_on_insert
BEFORE INSERT ON public.votes
FOR EACH ROW
EXECUTE FUNCTION public.set_public_vote_flag();
