
-- Decision Intelligence Reports
CREATE TABLE public.decision_intelligence_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid REFERENCES public.polls(id) ON DELETE CASCADE,
  campaign_id uuid,
  concept_score numeric(5,2) NOT NULL DEFAULT 0,
  winner_option text NOT NULL DEFAULT 'A',
  loser_option text NOT NULL DEFAULT 'B',
  winner_pct numeric(5,2) NOT NULL DEFAULT 50,
  loser_pct numeric(5,2) NOT NULL DEFAULT 50,
  total_votes integer NOT NULL DEFAULT 0,
  drivers_of_choice jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  trend_momentum jsonb NOT NULL DEFAULT '{}'::jsonb,
  brand_recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  personality_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  executive_summary text,
  methodology_note text,
  share_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  report_status text NOT NULL DEFAULT 'generating',
  generated_by uuid,
  generated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.decision_intelligence_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all DI reports"
  ON public.decision_intelligence_reports FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Brand clients view campaign DI reports"
  ON public.decision_intelligence_reports FOR SELECT
  TO authenticated
  USING (campaign_id IS NOT NULL AND is_campaign_client(auth.uid(), campaign_id));

CREATE POLICY "Public access via share token"
  ON public.decision_intelligence_reports FOR SELECT
  TO public
  USING (share_token IS NOT NULL AND report_status = 'complete');

CREATE INDEX idx_di_reports_poll ON public.decision_intelligence_reports(poll_id);
CREATE INDEX idx_di_reports_campaign ON public.decision_intelligence_reports(campaign_id);
CREATE INDEX idx_di_reports_share_token ON public.decision_intelligence_reports(share_token);

-- DI Report View Tracking
CREATE TABLE public.di_report_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.decision_intelligence_reports(id) ON DELETE CASCADE,
  viewer_ip_hash text,
  viewed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.di_report_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log views"
  ON public.di_report_views FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins read all views"
  ON public.di_report_views FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
