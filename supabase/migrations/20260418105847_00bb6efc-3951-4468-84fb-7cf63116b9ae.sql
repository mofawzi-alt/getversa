UPDATE votes v
SET voter_gender = u.gender,
    voter_age_range = u.age_range,
    voter_city = u.city,
    voter_country = u.country
FROM users u, polls p
WHERE v.user_id = u.id
  AND v.poll_id = p.id
  AND p.campaign_id IS NOT NULL
  AND (v.voter_gender IS NULL OR v.voter_age_range IS NULL OR v.voter_city IS NULL);