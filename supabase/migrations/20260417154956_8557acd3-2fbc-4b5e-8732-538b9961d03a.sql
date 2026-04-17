
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);

CREATE FUNCTION public.get_public_profiles(user_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, username text, points integer, current_streak integer, longest_streak integer, created_at timestamp with time zone, avatar_url text, is_private boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.id, u.username, u.points, u.current_streak, u.longest_streak, u.created_at, u.avatar_url, u.is_private
  FROM users u
  WHERE user_ids IS NULL OR u.id = ANY(user_ids);
$function$;
