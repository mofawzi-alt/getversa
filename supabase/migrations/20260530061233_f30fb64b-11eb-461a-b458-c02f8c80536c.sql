
GRANT SELECT ON public.daily_pulse TO anon, authenticated;
GRANT ALL ON public.daily_pulse TO service_role;

GRANT SELECT ON public.pulse_settings TO anon, authenticated;
GRANT ALL ON public.pulse_settings TO service_role;

GRANT SELECT ON public.editorial_stories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.editorial_stories TO authenticated;
GRANT ALL ON public.editorial_stories TO service_role;

GRANT SELECT ON public.user_stories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_stories TO authenticated;
GRANT ALL ON public.user_stories TO service_role;
