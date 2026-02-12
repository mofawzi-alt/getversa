-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Users table (profiles)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  age_range TEXT,
  gender TEXT,
  country TEXT,
  points INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Polls table
CREATE TABLE public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  category TEXT,
  image_a_url TEXT,
  image_b_url TEXT,
  created_by UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes table
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('A', 'B')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, poll_id)
);

-- Sponsored polls table
CREATE TABLE public.sponsored_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  sponsor_name TEXT NOT NULL,
  sponsor_logo_url TEXT,
  campaign_start TIMESTAMP WITH TIME ZONE NOT NULL,
  campaign_end TIMESTAMP WITH TIME ZONE NOT NULL,
  target_gender TEXT,
  target_age_range TEXT,
  target_country TEXT,
  budget NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Follows table
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (follower_id, following_id)
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Challenges table
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  goal_value INT NOT NULL,
  reward_points INT DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rewards table
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cost_points INT NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User challenges table
CREATE TABLE public.user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
  progress INT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, challenge_id)
);

-- User rewards table
CREATE TABLE public.user_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  reward_id UUID REFERENCES public.rewards(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'unlocked' CHECK (status IN ('unlocked', 'redeemed')),
  redeemed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, reward_id)
);

-- Collaboration requests table
CREATE TABLE public.collaboration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  brand_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Poll boosts table
CREATE TABLE public.poll_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  sponsor_name TEXT NOT NULL,
  boost_type TEXT NOT NULL,
  boost_value INT DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profile customizations table
CREATE TABLE public.profile_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  theme_primary TEXT NOT NULL,
  theme_secondary TEXT NOT NULL,
  badge_icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User customizations table
CREATE TABLE public.user_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  profile_customization_id UUID REFERENCES public.profile_customizations(id) ON DELETE CASCADE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Automation settings table
CREATE TABLE public.automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  daily_poll_reminder BOOLEAN DEFAULT TRUE,
  reminder_time TEXT DEFAULT '09:00',
  sponsored_opt_in BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsored_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Users: users can read all profiles, update their own
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles: users can view their own roles, admins can manage all
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Polls: all authenticated users can read active polls, admins can manage
CREATE POLICY "Anyone can view active polls" ON public.polls FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage polls" ON public.polls FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Votes: users can read all votes, insert their own
CREATE POLICY "Anyone can view votes" ON public.votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own votes" ON public.votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Sponsored polls: all can read active, admins can manage
CREATE POLICY "Anyone can view active sponsored polls" ON public.sponsored_polls FOR SELECT TO authenticated USING (campaign_start <= NOW() AND campaign_end >= NOW());
CREATE POLICY "Admins can manage sponsored polls" ON public.sponsored_polls FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Follows: users can manage their own follows
CREATE POLICY "Anyone can view follows" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own follows" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can delete own follows" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- Notifications: users can read/update their own
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Challenges: all can read active, admins can manage
CREATE POLICY "Anyone can view active challenges" ON public.challenges FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage challenges" ON public.challenges FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Rewards: all can read active, admins can manage
CREATE POLICY "Anyone can view active rewards" ON public.rewards FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage rewards" ON public.rewards FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- User challenges: users can manage their own
CREATE POLICY "Users can view own challenges" ON public.user_challenges FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own challenges" ON public.user_challenges FOR ALL TO authenticated USING (user_id = auth.uid());

-- User rewards: users can manage their own
CREATE POLICY "Users can view own rewards" ON public.user_rewards FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own rewards" ON public.user_rewards FOR ALL TO authenticated USING (user_id = auth.uid());

-- Collaboration requests: users can create their own, admins can manage all
CREATE POLICY "Users can view own requests" ON public.collaboration_requests FOR SELECT TO authenticated USING (requester_id = auth.uid());
CREATE POLICY "Users can create requests" ON public.collaboration_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Admins can manage all requests" ON public.collaboration_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Poll boosts: all can read, admins can manage
CREATE POLICY "Anyone can view poll boosts" ON public.poll_boosts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage poll boosts" ON public.poll_boosts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profile customizations: all can read, admins can manage
CREATE POLICY "Anyone can view customizations" ON public.profile_customizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage customizations" ON public.profile_customizations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- User customizations: users can manage their own
CREATE POLICY "Users can view own customizations" ON public.user_customizations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own customizations" ON public.user_customizations FOR ALL TO authenticated USING (user_id = auth.uid());

-- Automation settings: users can manage their own
CREATE POLICY "Users can view own settings" ON public.automation_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own settings" ON public.automation_settings FOR ALL TO authenticated USING (user_id = auth.uid());