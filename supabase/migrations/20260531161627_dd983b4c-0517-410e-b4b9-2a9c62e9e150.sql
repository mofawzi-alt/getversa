UPDATE public.poll_calendar pc
SET status = 'published',
    published_at = now(),
    published_poll_id = p.id
FROM public.polls p
WHERE pc.release_date IN ('2026-05-30','2026-05-31')
  AND pc.status = 'approved'
  AND p.question = pc.question
  AND p.option_a = pc.option_a
  AND p.option_b = pc.option_b
  AND p.starts_at > now() - interval '10 minutes';