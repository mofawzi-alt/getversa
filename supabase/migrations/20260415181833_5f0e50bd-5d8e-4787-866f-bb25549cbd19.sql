
-- Auto-tag polls with personality-relevant tags based on category
UPDATE polls SET option_a_tag = 'social', option_b_tag = 'experience' 
WHERE category = 'Entertainment' AND (option_a_tag IS NULL OR option_b_tag IS NULL);

UPDATE polls SET option_a_tag = 'price_sensitive', option_b_tag = 'growth' 
WHERE category = 'Fintech & Money' AND (option_a_tag IS NULL OR option_b_tag IS NULL);

UPDATE polls SET option_a_tag = 'social', option_b_tag = 'independent' 
WHERE category = 'The Pulse' AND (option_a_tag IS NULL OR option_b_tag IS NULL);

UPDATE polls SET option_a_tag = 'health', option_b_tag = 'indulgent' 
WHERE category = 'Wellness & Habits' AND (option_a_tag IS NULL OR option_b_tag IS NULL);

UPDATE polls SET option_a_tag = 'brand_oriented', option_b_tag = 'independent' 
WHERE category = 'Brands' AND (option_a_tag IS NULL OR option_b_tag IS NULL);

UPDATE polls SET option_a_tag = 'luxury', option_b_tag = 'practical' 
WHERE category = 'Style & Design' AND (option_a_tag IS NULL OR option_b_tag IS NULL);

UPDATE polls SET option_a_tag = 'experience', option_b_tag = 'quality' 
WHERE category = 'Sports' AND (option_a_tag IS NULL OR option_b_tag IS NULL);

UPDATE polls SET option_a_tag = 'innovation', option_b_tag = 'traditional' 
WHERE category = 'Business & Startups' AND (option_a_tag IS NULL OR option_b_tag IS NULL);

UPDATE polls SET option_a_tag = 'practical', option_b_tag = 'adventurous' 
WHERE option_a_tag IS NULL OR option_b_tag IS NULL;
