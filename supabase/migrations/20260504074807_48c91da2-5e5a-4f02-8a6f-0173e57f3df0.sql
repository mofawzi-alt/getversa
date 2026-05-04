CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_username text;
  safe_username text;
BEGIN
  raw_username := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(COALESCE(NEW.email, 'user'), '@', 1),
    'user'
  );

  safe_username := lower(regexp_replace(raw_username, '[^a-zA-Z0-9_]+', '', 'g'));
  IF safe_username IS NULL OR length(safe_username) < 3 THEN
    safe_username := 'user';
  END IF;
  safe_username := left(safe_username, 20) || '_' || substr(replace(NEW.id::text, '-', ''), 1, 6);

  INSERT INTO public.users (
    id,
    email,
    username,
    age_range,
    gender,
    country,
    city,
    nationality,
    city_of_residence,
    points,
    current_streak,
    longest_streak,
    total_days_active
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    safe_username,
    NULLIF(NEW.raw_user_meta_data ->> 'age_range', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'gender', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'country', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'city', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'nationality', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'city_of_residence', ''),
    0,
    0,
    0,
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(public.users.username, EXCLUDED.username),
    age_range = COALESCE(public.users.age_range, EXCLUDED.age_range),
    gender = COALESCE(public.users.gender, EXCLUDED.gender),
    country = COALESCE(public.users.country, EXCLUDED.country),
    city = COALESCE(public.users.city, EXCLUDED.city),
    nationality = COALESCE(public.users.nationality, EXCLUDED.nationality),
    city_of_residence = COALESCE(public.users.city_of_residence, EXCLUDED.city_of_residence);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;