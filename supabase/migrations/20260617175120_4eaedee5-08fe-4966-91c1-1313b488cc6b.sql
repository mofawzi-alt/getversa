
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.users;

CREATE POLICY "Authenticated can read public profile fields"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.users FROM authenticated;
REVOKE SELECT ON public.users FROM anon;

GRANT SELECT (
  id,
  username,
  avatar_url,
  is_private,
  verified_public_figure,
  verified_category,
  points,
  current_streak,
  longest_streak,
  total_days_active,
  prediction_accuracy,
  prediction_total,
  ask_credits,
  has_seen_welcome_tour,
  created_at
) ON public.users TO authenticated;

GRANT ALL ON public.users TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_user_full(_user_id uuid)
RETURNS SETOF public.users
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY SELECT * FROM public.users WHERE id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_user_full(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_users_full(_limit int DEFAULT 1000, _offset int DEFAULT 0)
RETURNS SETOF public.users
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY SELECT * FROM public.users ORDER BY created_at DESC LIMIT _limit OFFSET _offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users_full(int, int) TO authenticated;
