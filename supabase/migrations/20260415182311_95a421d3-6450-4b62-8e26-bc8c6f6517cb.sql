
-- Create core dimensions
INSERT INTO dimensions (id, name, description) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Tradition vs Innovation', 'Do you lean toward the tried-and-true or the cutting edge?'),
  ('d1000000-0000-0000-0000-000000000002', 'Practicality vs Experience', 'Do you prioritize function and value, or feelings and moments?'),
  ('d1000000-0000-0000-0000-000000000003', 'Local vs Global', 'Do you favor homegrown choices or international brands?'),
  ('d1000000-0000-0000-0000-000000000004', 'Budget vs Premium', 'Do you optimize for savings or splurge on quality?'),
  ('d1000000-0000-0000-0000-000000000005', 'Health vs Indulgence', 'Do you choose wellness or treat yourself?');

-- Link polls to dimensions based on category
-- Entertainment → Experience side of Practicality vs Experience
INSERT INTO poll_dimensions (poll_id, dimension_id, weight_a, weight_b)
SELECT p.id, 'd1000000-0000-0000-0000-000000000002', 1.0, -1.0
FROM polls p WHERE p.category = 'Entertainment';

-- Fintech & Money → Budget vs Premium
INSERT INTO poll_dimensions (poll_id, dimension_id, weight_a, weight_b)
SELECT p.id, 'd1000000-0000-0000-0000-000000000004', 1.0, -1.0
FROM polls p WHERE p.category = 'Fintech & Money';

-- The Pulse → Local vs Global
INSERT INTO poll_dimensions (poll_id, dimension_id, weight_a, weight_b)
SELECT p.id, 'd1000000-0000-0000-0000-000000000003', 1.0, -1.0
FROM polls p WHERE p.category = 'The Pulse';

-- Wellness & Habits → Health vs Indulgence
INSERT INTO poll_dimensions (poll_id, dimension_id, weight_a, weight_b)
SELECT p.id, 'd1000000-0000-0000-0000-000000000005', 1.0, -1.0
FROM polls p WHERE p.category = 'Wellness & Habits';

-- Brands → Tradition vs Innovation
INSERT INTO poll_dimensions (poll_id, dimension_id, weight_a, weight_b)
SELECT p.id, 'd1000000-0000-0000-0000-000000000001', 1.0, -1.0
FROM polls p WHERE p.category = 'Brands';

-- Style & Design → Budget vs Premium
INSERT INTO poll_dimensions (poll_id, dimension_id, weight_a, weight_b)
SELECT p.id, 'd1000000-0000-0000-0000-000000000004', -1.0, 1.0
FROM polls p WHERE p.category = 'Style & Design';

-- Business & Startups → Tradition vs Innovation
INSERT INTO poll_dimensions (poll_id, dimension_id, weight_a, weight_b)
SELECT p.id, 'd1000000-0000-0000-0000-000000000001', -1.0, 1.0
FROM polls p WHERE p.category = 'Business & Startups';

-- Sports → Practicality vs Experience
INSERT INTO poll_dimensions (poll_id, dimension_id, weight_a, weight_b)
SELECT p.id, 'd1000000-0000-0000-0000-000000000002', -1.0, 1.0
FROM polls p WHERE p.category = 'Sports';

-- Now backfill user_dimension_scores from all existing votes
INSERT INTO user_dimension_scores (user_id, dimension_id, score, vote_count, updated_at)
SELECT 
  v.user_id,
  pd.dimension_id,
  SUM(CASE WHEN v.choice = 'A' THEN pd.weight_a ELSE pd.weight_b END),
  COUNT(*),
  now()
FROM votes v
JOIN poll_dimensions pd ON pd.poll_id = v.poll_id
GROUP BY v.user_id, pd.dimension_id
ON CONFLICT (user_id, dimension_id) DO UPDATE SET
  score = EXCLUDED.score,
  vote_count = EXCLUDED.vote_count,
  updated_at = now();
