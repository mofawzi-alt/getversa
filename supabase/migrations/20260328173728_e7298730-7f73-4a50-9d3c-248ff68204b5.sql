
-- Add target_countries array to polls for multi-country targeting
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS target_countries text[] DEFAULT '{}'::text[];

-- Add voter_country to votes for geographic segmentation
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS voter_country text;
