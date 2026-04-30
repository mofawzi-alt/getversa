-- Link the 2 entries whose polls already exist
UPDATE poll_calendar SET status = 'published', published_poll_id = '0f4f5828-1e29-4f75-9a43-c73221f4b283', published_at = now()
WHERE id = '30008628-07fa-476a-92ca-0e5e413bbb77';

UPDATE poll_calendar SET status = 'published', published_poll_id = '6409ade1-2693-44b0-88e5-215678b8e9dc', published_at = now()
WHERE id = 'b6f8bfa7-e8b2-4d20-a3a0-87764f1913ae';

-- Publish the remaining 2 as new polls
WITH approved AS (
  SELECT * FROM poll_calendar
  WHERE id IN ('cb421d57-d441-4e8b-98ec-2f5244279876','f1a36bf6-74e5-463a-b084-b2c4ab4e8630')
),
inserted AS (
  INSERT INTO polls (question, option_a, option_b, image_a_url, image_b_url, category, target_country, target_age_range, target_gender, is_active, poll_type, expiry_type, created_by, starts_at)
  SELECT question, option_a, option_b, image_a_url, image_b_url, category, target_country, target_age_range, target_gender, true, 'core_index', 'evergreen', created_by, now()
  FROM approved
  RETURNING id, question
)
UPDATE poll_calendar pc
SET status = 'published', published_poll_id = i.id, published_at = now()
FROM inserted i, approved a
WHERE pc.id = a.id AND a.question = i.question;