-- Reset Pemina Concept Test — UAE campaign: clear all vote-related data so it appears unvoted
DO $$
DECLARE
  _campaign_id uuid := '5ceaeaeb-9346-4496-80d6-aa057aea2aa2';
  _poll_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO _poll_ids FROM polls WHERE campaign_id = _campaign_id;

  IF _poll_ids IS NULL OR array_length(_poll_ids, 1) = 0 THEN
    RAISE NOTICE 'No polls found for campaign';
    RETURN;
  END IF;

  DELETE FROM votes WHERE poll_id = ANY(_poll_ids);
  DELETE FROM predictions WHERE poll_id = ANY(_poll_ids);
  DELETE FROM skipped_polls WHERE poll_id = ANY(_poll_ids);
  DELETE FROM poll_attribute_ratings WHERE poll_id = ANY(_poll_ids);
  DELETE FROM poll_verbatim_feedback WHERE poll_id = ANY(_poll_ids);
  DELETE FROM poll_cycles WHERE poll_id = ANY(_poll_ids);
  DELETE FROM daily_poll_queues WHERE poll_id = ANY(_poll_ids);
END $$;