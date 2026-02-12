-- Enable realtime for votes table to show live results
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;

-- Add a "daily_poll" flag to distinguish the featured daily poll
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS is_daily_poll boolean DEFAULT false;