
-- Reactivate both campaigns with fresh window
UPDATE poll_campaigns
SET is_active = true,
    release_at = now(),
    expires_at = now() + interval '30 days'
WHERE id IN ('69c6e32b-c83c-4016-86e5-76f95172b72d','663dde25-4351-445e-8095-d9d15a90e55a');

-- Reactivate all polls linked to these campaigns
UPDATE polls
SET is_active = true
WHERE id IN (
  SELECT poll_id FROM campaign_polls
  WHERE campaign_id IN ('69c6e32b-c83c-4016-86e5-76f95172b72d','663dde25-4351-445e-8095-d9d15a90e55a')
);

-- Clear votes & ratings & skips so all users get a fresh slate
DELETE FROM votes
WHERE poll_id IN (
  SELECT poll_id FROM campaign_polls
  WHERE campaign_id IN ('69c6e32b-c83c-4016-86e5-76f95172b72d','663dde25-4351-445e-8095-d9d15a90e55a')
);

DELETE FROM poll_attribute_ratings
WHERE poll_id IN (
  SELECT poll_id FROM campaign_polls
  WHERE campaign_id IN ('69c6e32b-c83c-4016-86e5-76f95172b72d','663dde25-4351-445e-8095-d9d15a90e55a')
);

DELETE FROM skipped_polls
WHERE poll_id IN (
  SELECT poll_id FROM campaign_polls
  WHERE campaign_id IN ('69c6e32b-c83c-4016-86e5-76f95172b72d','663dde25-4351-445e-8095-d9d15a90e55a')
);
