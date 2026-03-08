UPDATE public.polls 
SET image_a_url = REPLACE(image_a_url, '.jpg', '.png')
WHERE image_a_url LIKE '/polls/ramadan/%.jpg';

UPDATE public.polls 
SET image_b_url = REPLACE(image_b_url, '.jpg', '.png')
WHERE image_b_url LIKE '/polls/ramadan/%.jpg';