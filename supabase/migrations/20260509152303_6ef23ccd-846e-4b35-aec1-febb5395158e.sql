
CREATE TABLE IF NOT EXISTS public.onesignal_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_onesignal_subscriptions_user ON public.onesignal_subscriptions(user_id);

ALTER TABLE public.onesignal_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onesignal subs"
  ON public.onesignal_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onesignal subs"
  ON public.onesignal_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onesignal subs"
  ON public.onesignal_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own onesignal subs"
  ON public.onesignal_subscriptions FOR DELETE
  USING (auth.uid() = user_id);
