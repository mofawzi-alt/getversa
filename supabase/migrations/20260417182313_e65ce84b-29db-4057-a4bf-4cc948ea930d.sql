UPDATE public.polls
SET 
  image_a_url = REPLACE(image_a_url, 'https://cdn.lovable.dev', ''),
  image_b_url = REPLACE(image_b_url, 'https://cdn.lovable.dev', '')
WHERE campaign_id = '663dde25-4351-445e-8095-d9d15a90e55a';