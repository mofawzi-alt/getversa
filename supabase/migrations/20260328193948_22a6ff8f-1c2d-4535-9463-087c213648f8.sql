
ALTER TABLE public.polls RENAME COLUMN tag_a TO option_a_tag;
ALTER TABLE public.polls RENAME COLUMN tag_b TO option_b_tag;

CREATE OR REPLACE FUNCTION public.get_user_voting_traits(p_user_id uuid)
RETURNS TABLE(tag text, vote_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT trait_tag, COUNT(*) as vote_count
  FROM (
    SELECT CASE WHEN v.choice = 'A' THEN p.option_a_tag ELSE p.option_b_tag END AS trait_tag
    FROM votes v
    JOIN polls p ON p.id = v.poll_id
    WHERE v.user_id = p_user_id
      AND CASE WHEN v.choice = 'A' THEN p.option_a_tag ELSE p.option_b_tag END IS NOT NULL
  ) tagged_votes
  GROUP BY trait_tag
  ORDER BY vote_count DESC
  LIMIT 10;
$$;
