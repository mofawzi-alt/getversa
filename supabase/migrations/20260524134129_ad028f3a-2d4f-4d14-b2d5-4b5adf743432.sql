UPDATE public.polls
SET is_active = false
WHERE is_active = true
  AND (
    image_a_url ILIKE '%.jpg' OR image_a_url ILIKE '%.jpeg'
    OR image_b_url ILIKE '%.jpg' OR image_b_url ILIKE '%.jpeg'
  );