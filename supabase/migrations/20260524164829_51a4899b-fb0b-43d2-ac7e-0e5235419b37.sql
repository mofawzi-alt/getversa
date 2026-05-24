UPDATE public.polls p
SET is_active = true
WHERE p.is_active = false
  AND (
    p.image_a_url ILIKE '%.jpg' OR p.image_a_url ILIKE '%.jpeg'
    OR p.image_b_url ILIKE '%.jpg' OR p.image_b_url ILIKE '%.jpeg'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.polls p2
    WHERE p2.is_active = true
      AND p2.question = p.question
      AND p2.option_a = p.option_a
      AND p2.option_b = p.option_b
  );