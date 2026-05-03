ALTER TABLE public.decision_intelligence_reports
  ADD COLUMN IF NOT EXISTS confidence_level text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS business_application jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS real_vote_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_decision_time_ms numeric DEFAULT NULL;