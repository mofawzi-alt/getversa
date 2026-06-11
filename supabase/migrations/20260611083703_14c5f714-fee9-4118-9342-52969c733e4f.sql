GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_ask_reports TO authenticated;
GRANT ALL ON public.live_ask_reports TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_asks TO authenticated;
GRANT ALL ON public.live_asks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_ask_votes TO authenticated;
GRANT ALL ON public.live_ask_votes TO service_role;