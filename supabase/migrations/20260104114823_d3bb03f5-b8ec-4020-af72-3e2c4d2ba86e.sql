-- Add 'creator' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'creator';

-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_monthly numeric NOT NULL,
  features jsonb DEFAULT '[]'::jsonb,
  max_polls_per_month integer,
  analytics_access boolean DEFAULT false,
  demographic_targeting boolean DEFAULT false,
  export_data boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Create user_subscriptions table
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text DEFAULT 'active',
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

-- Create badges table
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  icon_url text,
  badge_type text NOT NULL,
  requirement_value integer DEFAULT 1,
  points_reward integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Create user_badges table
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Create favorite_polls table
CREATE TABLE public.favorite_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  poll_id uuid REFERENCES public.polls(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, poll_id)
);

-- Add streak columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_vote_date date;

-- Enable RLS on all new tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_polls ENABLE ROW LEVEL SECURITY;

-- RLS for subscription_plans (anyone can view active plans)
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage plans" ON public.subscription_plans
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS for user_subscriptions
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage subscriptions" ON public.user_subscriptions
FOR ALL USING (true);

-- RLS for badges (anyone can view)
CREATE POLICY "Anyone can view badges" ON public.badges
FOR SELECT USING (true);

CREATE POLICY "Admins can manage badges" ON public.badges
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS for user_badges
CREATE POLICY "Anyone can view user badges" ON public.user_badges
FOR SELECT USING (true);

CREATE POLICY "System can manage user badges" ON public.user_badges
FOR ALL USING (true);

-- RLS for favorite_polls
CREATE POLICY "Users can view own favorites" ON public.favorite_polls
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own favorites" ON public.favorite_polls
FOR ALL USING (user_id = auth.uid());

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, description, price_monthly, features, max_polls_per_month, analytics_access, demographic_targeting, export_data)
VALUES 
  ('Basic', 'Perfect for individual creators', 9, '["Create up to 10 polls/month", "Basic analytics", "Share results"]'::jsonb, 10, true, false, false),
  ('Pro', 'For growing brands and influencers', 29, '["Create up to 50 polls/month", "Advanced analytics", "Demographic targeting", "Export data"]'::jsonb, 50, true, true, true),
  ('Business', 'For agencies and enterprises', 99, '["Unlimited polls", "Full analytics suite", "Priority support", "Custom branding", "API access"]'::jsonb, NULL, true, true, true);

-- Insert default badges
INSERT INTO public.badges (name, description, badge_type, requirement_value, points_reward)
VALUES 
  ('First Vote', 'Cast your first vote', 'votes', 1, 10),
  ('Regular Voter', 'Cast 10 votes', 'votes', 10, 25),
  ('Active Voter', 'Cast 50 votes', 'votes', 50, 50),
  ('Super Voter', 'Cast 100 votes', 'votes', 100, 100),
  ('Voting Legend', 'Cast 500 votes', 'votes', 500, 250),
  ('Week Warrior', 'Maintain a 7-day streak', 'streak', 7, 50),
  ('Streak Master', 'Maintain a 30-day streak', 'streak', 30, 200),
  ('Century Streak', 'Maintain a 100-day streak', 'streak', 100, 500),
  ('Early Adopter', 'Be among the first 1000 users', 'special', 1, 100),
  ('Social Butterfly', 'Share 10 polls', 'shares', 10, 75);