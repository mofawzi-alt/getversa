CREATE INDEX IF NOT EXISTS idx_votes_poll_id_choice ON public.votes (poll_id, choice);
CREATE INDEX IF NOT EXISTS idx_votes_poll_created ON public.votes (poll_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_user_created ON public.votes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON public.votes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_polls_active_weight_created ON public.polls (is_active, weight_score DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polls_active_created ON public.polls (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polls_active_ends ON public.polls (is_active, ends_at);
CREATE INDEX IF NOT EXISTS idx_polls_active_category ON public.polls (is_active, category);

CREATE INDEX IF NOT EXISTS idx_daily_poll_queues_user_date ON public.daily_poll_queues (user_id, queue_date, queue_order);
CREATE INDEX IF NOT EXISTS idx_daily_poll_queues_user_poll_date ON public.daily_poll_queues (user_id, poll_id, queue_date);

CREATE INDEX IF NOT EXISTS idx_skipped_polls_user_poll ON public.skipped_polls (user_id, poll_id);
CREATE INDEX IF NOT EXISTS idx_skipped_polls_poll_user ON public.skipped_polls (poll_id, user_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id, following_id);

ANALYZE public.votes;
ANALYZE public.polls;
ANALYZE public.daily_poll_queues;
ANALYZE public.skipped_polls;
ANALYZE public.follows;