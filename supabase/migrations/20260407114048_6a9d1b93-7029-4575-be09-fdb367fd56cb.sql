-- Backfill all votes that have NULL demographics from the users table
UPDATE votes v
SET 
  voter_gender = u.gender,
  voter_age_range = u.age_range,
  voter_city = u.city,
  voter_country = u.country
FROM users u
WHERE v.user_id = u.id
  AND v.voter_gender IS NULL
  AND u.gender IS NOT NULL;