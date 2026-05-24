UPDATE public.polls
SET image_a_url = CASE
    WHEN lower(coalesce(image_a_url, '')) LIKE '%.webp%' THEN '/polls/lipton-office-fix.png'
    ELSE image_a_url
  END,
  image_b_url = CASE
    WHEN lower(coalesce(image_b_url, '')) LIKE '%.webp%' THEN '/polls/lipton-office-fix.png'
    ELSE image_b_url
  END
WHERE is_active = true
  AND (
    lower(coalesce(image_a_url, '')) LIKE '%.webp%'
    OR lower(coalesce(image_b_url, '')) LIKE '%.webp%'
  );