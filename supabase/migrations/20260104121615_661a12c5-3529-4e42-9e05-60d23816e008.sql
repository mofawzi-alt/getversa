-- Fix function search path security
CREATE OR REPLACE FUNCTION public.generate_redemption_code()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN 'VERSA-' || upper(substr(md5(random()::text), 1, 8));
END;
$$;