
-- Remap existing polls to the new 10 categories
UPDATE polls SET category = 'The Pulse' WHERE category = 'The Pulse';
UPDATE polls SET category = 'Financial Services' WHERE category IN ('Fintech & Money', 'Business & Startups');
UPDATE polls SET category = 'Media & Entertainment' WHERE category IN ('Entertainment', 'Sports');
UPDATE polls SET category = 'FMCG & Food' WHERE lower(category) IN ('food', 'food & drinks');
UPDATE polls SET category = 'Retail & E-commerce' WHERE lower(category) = 'brands';
UPDATE polls SET category = 'Lifestyle & Society' WHERE category IN ('Wellness & Habits', 'Style & Design', 'Style', 'Personality', 'Lifestyle', 'Relationships');
UPDATE polls SET category = 'Telco & Tech' WHERE category = 'Telecom';
UPDATE polls SET category = 'Beauty & Personal Care' WHERE category = 'Beauty';

-- Replace categories table presets with the new 10
DELETE FROM categories WHERE is_preset = true;
INSERT INTO categories (name, is_preset) VALUES
  ('FMCG & Food', true),
  ('Beauty & Personal Care', true),
  ('Financial Services', true),
  ('Media & Entertainment', true),
  ('Retail & E-commerce', true),
  ('Telco & Tech', true),
  ('Food Delivery & Dining', true),
  ('Automotive & Mobility', true),
  ('Lifestyle & Society', true),
  ('The Pulse', true);
