-- Remove compatibility badge triggers
DROP TRIGGER IF EXISTS check_compatibility_badges_trigger ON public.friendships;
DROP TRIGGER IF EXISTS check_vote_compatibility_badges_trigger ON public.votes;

-- Remove compatibility badge functions
DROP FUNCTION IF EXISTS public.check_compatibility_badges();
DROP FUNCTION IF EXISTS public.check_vote_compatibility_badges();

-- Remove compatibility badges from badges table
DELETE FROM public.badges WHERE badge_type = 'compatibility';