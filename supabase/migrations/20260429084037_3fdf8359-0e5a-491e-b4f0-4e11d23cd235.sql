-- Mark April 29 calendar rows as published and link to newly created polls
WITH matched AS (
  SELECT pc.id AS cal_id, p.id AS poll_id
  FROM poll_calendar pc
  JOIN polls p
    ON p.question = pc.question
   AND p.option_a = pc.option_a
   AND p.option_b = pc.option_b
   AND p.poll_type = 'core_index'
   AND p.is_active = true
   AND p.created_at >= now() - interval '10 minutes'
  WHERE pc.release_date = '2026-04-29'
    AND pc.status = 'approved'
)
UPDATE poll_calendar pc
SET status = 'published',
    published_poll_id = matched.poll_id,
    published_at = now()
FROM matched
WHERE pc.id = matched.cal_id;