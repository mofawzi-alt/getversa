CREATE OR REPLACE FUNCTION public.is_poll_expired(p_expiry_type text, p_ends_at timestamptz)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_expiry_type = 'evergreen' THEN false
    WHEN p_ends_at IS NULL THEN false
    ELSE p_ends_at <= now()
  END;
$$;