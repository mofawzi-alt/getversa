-- Create poll_campaigns table to group related polls
CREATE TABLE public.poll_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for polls in campaigns
CREATE TABLE public.campaign_polls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.poll_campaigns(id) ON DELETE CASCADE,
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL, -- e.g., "Vodafone", "Orange", "Etisalat", "WE"
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, poll_id)
);

-- Enable RLS
ALTER TABLE public.poll_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_polls ENABLE ROW LEVEL SECURITY;

-- RLS Policies for poll_campaigns
CREATE POLICY "Users can view own campaigns" ON public.poll_campaigns
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Admins can view all campaigns" ON public.poll_campaigns
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own campaigns" ON public.poll_campaigns
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own campaigns" ON public.poll_campaigns
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete own campaigns" ON public.poll_campaigns
  FOR DELETE USING (created_by = auth.uid());

CREATE POLICY "Admins can manage all campaigns" ON public.poll_campaigns
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for campaign_polls
CREATE POLICY "Users can view polls in own campaigns" ON public.campaign_polls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.poll_campaigns pc 
      WHERE pc.id = campaign_id AND pc.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can view all campaign polls" ON public.campaign_polls
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can add polls to own campaigns" ON public.campaign_polls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.poll_campaigns pc 
      WHERE pc.id = campaign_id AND pc.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can remove polls from own campaigns" ON public.campaign_polls
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.poll_campaigns pc 
      WHERE pc.id = campaign_id AND pc.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all campaign polls" ON public.campaign_polls
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_poll_campaigns_updated_at
  BEFORE UPDATE ON public.poll_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();