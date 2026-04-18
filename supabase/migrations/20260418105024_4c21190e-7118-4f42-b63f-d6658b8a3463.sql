DO $$
DECLARE
  v_campaign_id uuid;
  v_img1 text := 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=1200&q=85&auto=format&fit=crop';
  v_img2 text := 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=1200&q=85&auto=format&fit=crop';
  v_img3 text := 'https://images.unsplash.com/photo-1513185158878-8d8c2a2a3da3?w=1200&q=85&auto=format&fit=crop';
  v_img4 text := 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&q=85&auto=format&fit=crop';
  v_img5 text := 'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=1200&q=85&auto=format&fit=crop';
  v_img6 text := 'https://images.unsplash.com/photo-1610614819513-58e34989848b?w=1200&q=85&auto=format&fit=crop';
  v_img7 text := 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&q=85&auto=format&fit=crop';
  v_img8 text := 'https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=1200&q=85&auto=format&fit=crop';
  v_img9 text := 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=1200&q=85&auto=format&fit=crop';
  v_img10 text := 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=1200&q=85&auto=format&fit=crop';
BEGIN
  SELECT id INTO v_campaign_id FROM poll_campaigns WHERE name = 'Pemina Concept Test — UAE' LIMIT 1;

  UPDATE polls SET image_a_url=v_img1, image_b_url=v_img1 WHERE campaign_id=v_campaign_id AND question ILIKE '%Marinated Chicken Breast%';
  UPDATE polls SET image_a_url=v_img2, image_b_url=v_img2 WHERE campaign_id=v_campaign_id AND question ILIKE '%KFC-Style Chicken%';
  UPDATE polls SET image_a_url=v_img3, image_b_url=v_img3 WHERE campaign_id=v_campaign_id AND question ILIKE '%Persian-Style Zinger%';
  UPDATE polls SET image_a_url=v_img4, image_b_url=v_img4 WHERE campaign_id=v_campaign_id AND question ILIKE '%Sour Chicken Kebab%';
  UPDATE polls SET image_a_url=v_img5, image_b_url=v_img5 WHERE campaign_id=v_campaign_id AND question ILIKE '%Buffalo Wings%';
  UPDATE polls SET image_a_url=v_img6, image_b_url=v_img6 WHERE campaign_id=v_campaign_id AND question ILIKE '%Saffron Chicken Kebab%';
  UPDATE polls SET image_a_url=v_img7, image_b_url=v_img7 WHERE campaign_id=v_campaign_id AND question ILIKE '%Cordon Bleu%';
  UPDATE polls SET image_a_url=v_img8, image_b_url=v_img8 WHERE campaign_id=v_campaign_id AND question ILIKE '%Tenderloin Beef Kabab%';
  UPDATE polls SET image_a_url=v_img9, image_b_url=v_img9 WHERE campaign_id=v_campaign_id AND question ILIKE '%Healthy Chicken Breast Strips%';
  UPDATE polls SET image_a_url=v_img10, image_b_url=v_img10 WHERE campaign_id=v_campaign_id AND question ILIKE '%Chicken Breast Schnitzel%';
END $$;