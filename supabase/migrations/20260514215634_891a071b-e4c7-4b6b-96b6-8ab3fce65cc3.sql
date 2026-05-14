ALTER TABLE public.live_asks ALTER COLUMN reveal_at SET DEFAULT (now() + interval '24 hours');
UPDATE public.live_asks SET reveal_at = created_at + interval '24 hours' WHERE status = 'active';