
CREATE TABLE IF NOT EXISTS public.breakdown_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid NOT NULL,
  scan_at timestamptz NOT NULL DEFAULT now(),
  finding_type text NOT NULL CHECK (finding_type IN ('gender_split','age_gap','city_war','dominant_demo')),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  headline text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_votes int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  pinned boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_breakdown_findings_status_scan
  ON public.breakdown_findings (status, scan_at DESC);
CREATE INDEX IF NOT EXISTS idx_breakdown_findings_run
  ON public.breakdown_findings (scan_run_id);

ALTER TABLE public.breakdown_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved findings"
  ON public.breakdown_findings FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Admins manage all findings"
  ON public.breakdown_findings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
