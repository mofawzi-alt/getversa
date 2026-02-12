-- Add demographic targeting columns to polls table
ALTER TABLE public.polls
ADD COLUMN target_gender text DEFAULT NULL,
ADD COLUMN target_age_range text DEFAULT NULL,
ADD COLUMN target_country text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.polls.target_gender IS 'Target gender for poll visibility (null = all)';
COMMENT ON COLUMN public.polls.target_age_range IS 'Target age range for poll visibility (null = all)';
COMMENT ON COLUMN public.polls.target_country IS 'Target country for poll visibility (null = all)';

-- Update RLS policy to filter polls by user demographics
DROP POLICY IF EXISTS "Users can view active polls from signup day onwards" ON public.polls;

CREATE POLICY "Users can view targeted active polls" 
ON public.polls 
FOR SELECT 
USING (
  (is_active = true) 
  AND (date(created_at) >= date((SELECT users.created_at FROM users WHERE users.id = auth.uid())))
  AND (
    target_gender IS NULL 
    OR target_gender = (SELECT gender FROM users WHERE id = auth.uid())
  )
  AND (
    target_age_range IS NULL 
    OR target_age_range = (SELECT age_range FROM users WHERE id = auth.uid())
  )
  AND (
    target_country IS NULL 
    OR target_country = (SELECT country FROM users WHERE id = auth.uid())
  )
);