ALTER TABLE public.live_asks ALTER COLUMN reveal_at SET DEFAULT (now() + interval '15 minutes');
UPDATE public.live_asks SET reveal_at = created_at + interval '15 minutes' WHERE status = 'active';