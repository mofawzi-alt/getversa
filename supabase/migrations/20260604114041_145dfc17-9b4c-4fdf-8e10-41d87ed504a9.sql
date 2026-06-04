UPDATE public.polls
SET ends_at = NULL
WHERE expiry_type = 'evergreen'
  AND ends_at IS NOT NULL
  AND ends_at <= now();