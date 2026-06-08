
-- 1. di_report_views: restrict INSERT to reports the user can access
DROP POLICY IF EXISTS "Authenticated can log views" ON public.di_report_views;
CREATE POLICY "Users can log views for accessible reports"
ON public.di_report_views
FOR INSERT
TO authenticated, anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.decision_intelligence_reports r
    WHERE r.id = di_report_views.report_id
      AND (
        (r.share_token IS NOT NULL AND r.report_status = 'complete')
        OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role))
        OR (auth.uid() IS NOT NULL AND r.campaign_id IS NOT NULL AND public.is_campaign_client(auth.uid(), r.campaign_id))
      )
  )
);
GRANT INSERT ON public.di_report_views TO anon;

-- 2. email_send_log: admin SELECT for operational visibility
CREATE POLICY "Admins can read email send log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. organizations: members can read their own organization
CREATE POLICY "Members can view their organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
  )
);
