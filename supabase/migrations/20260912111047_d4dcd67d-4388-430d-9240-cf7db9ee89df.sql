ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_release text;
GRANT SELECT, UPDATE (last_seen_release) ON public.users TO authenticated;