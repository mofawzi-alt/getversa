ALTER TABLE public.poll_challenges REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_challenges;