
-- Add enrichment columns to votes table
ALTER TABLE public.votes 
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS voter_age_range text,
  ADD COLUMN IF NOT EXISTS voter_gender text,
  ADD COLUMN IF NOT EXISTS voter_city text,
  ADD COLUMN IF NOT EXISTS session_duration_ms integer;

-- Add enrichment columns to skipped_polls table  
ALTER TABLE public.skipped_polls
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS voter_age_range text,
  ADD COLUMN IF NOT EXISTS voter_gender text,
  ADD COLUMN IF NOT EXISTS voter_city text,
  ADD COLUMN IF NOT EXISTS voter_country text,
  ADD COLUMN IF NOT EXISTS session_duration_ms integer;
