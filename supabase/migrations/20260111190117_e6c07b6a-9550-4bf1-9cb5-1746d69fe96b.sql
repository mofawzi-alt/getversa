-- Add new demographic fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS income_range text,
ADD COLUMN IF NOT EXISTS employment_status text,
ADD COLUMN IF NOT EXISTS industry text,
ADD COLUMN IF NOT EXISTS education_level text;

-- Add comment for documentation
COMMENT ON COLUMN public.users.income_range IS 'User income range for demographic targeting';
COMMENT ON COLUMN public.users.employment_status IS 'User employment status';
COMMENT ON COLUMN public.users.industry IS 'User industry/sector';
COMMENT ON COLUMN public.users.education_level IS 'User education level';