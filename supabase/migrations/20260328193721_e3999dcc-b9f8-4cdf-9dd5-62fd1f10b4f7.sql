
-- Add per-option behavioral tags to polls
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS tag_a text DEFAULT NULL;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS tag_b text DEFAULT NULL;

-- Function to aggregate user voting traits from option tags
CREATE OR REPLACE FUNCTION public.get_user_voting_traits(p_user_id uuid)
RETURNS TABLE(tag text, vote_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT trait_tag, COUNT(*) as vote_count
  FROM (
    SELECT CASE WHEN v.choice = 'A' THEN p.tag_a ELSE p.tag_b END AS trait_tag
    FROM votes v
    JOIN polls p ON p.id = v.poll_id
    WHERE v.user_id = p_user_id
      AND CASE WHEN v.choice = 'A' THEN p.tag_a ELSE p.tag_b END IS NOT NULL
  ) tagged_votes
  GROUP BY trait_tag
  ORDER BY vote_count DESC
  LIMIT 10;
$$;
