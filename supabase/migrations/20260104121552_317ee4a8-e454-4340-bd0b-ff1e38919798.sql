-- Add partner info columns to rewards table
ALTER TABLE public.rewards 
ADD COLUMN IF NOT EXISTS partner_name text,
ADD COLUMN IF NOT EXISTS partner_logo_url text,
ADD COLUMN IF NOT EXISTS redemption_type text DEFAULT 'internal',
ADD COLUMN IF NOT EXISTS external_url text,
ADD COLUMN IF NOT EXISTS terms_conditions text;

-- Add redemption code to user_rewards for partner tracking
ALTER TABLE public.user_rewards
ADD COLUMN IF NOT EXISTS redemption_code text,
ADD COLUMN IF NOT EXISTS partner_confirmation text;

-- Create function to generate unique redemption codes
CREATE OR REPLACE FUNCTION public.generate_redemption_code()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'VERSA-' || upper(substr(md5(random()::text), 1, 8));
END;
$$;