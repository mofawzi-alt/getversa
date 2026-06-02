DELETE FROM public.daily_poll_queues dpq
WHERE dpq.queue_date = ((now() AT TIME ZONE 'Africa/Cairo')::date)
  AND NOT EXISTS (
    SELECT 1 FROM public.votes v WHERE v.poll_id = dpq.poll_id AND v.user_id = dpq.user_id
  );