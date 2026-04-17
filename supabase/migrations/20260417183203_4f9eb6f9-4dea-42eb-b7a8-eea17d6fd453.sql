-- Add brand_client to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'brand_client';

-- Create campaign_clients link table
CREATE TABLE IF NOT EXISTS public.campaign_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.poll_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_clients_user ON public.campaign_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_clients_campaign ON public.campaign_clients(campaign_id);

ALTER TABLE public.campaign_clients ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins manage campaign clients"
ON public.campaign_clients FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Clients can see their own assignments
CREATE POLICY "Clients view own assignments"
ON public.campaign_clients FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Helper function: is this user a client of this campaign?
CREATE OR REPLACE FUNCTION public.is_campaign_client(_user_id uuid, _campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_clients
    WHERE user_id = _user_id AND campaign_id = _campaign_id
  );
$$;

-- Allow brand clients to view polls in their campaigns (in addition to existing public/admin policies)
CREATE POLICY "Brand clients view campaign polls"
ON public.polls FOR SELECT
TO authenticated
USING (
  campaign_id IS NOT NULL
  AND public.is_campaign_client(auth.uid(), campaign_id)
);

-- Campaign-scoped analytics RPC: returns aggregate vote stats per poll for a campaign
CREATE OR REPLACE FUNCTION public.get_campaign_analytics(p_campaign_id uuid)
RETURNS TABLE (
  poll_id uuid,
  question text,
  option_a text,
  option_b text,
  total_votes bigint,
  votes_a bigint,
  votes_b bigint,
  percent_a integer,
  percent_b integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization: admin OR assigned brand client
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.is_campaign_client(auth.uid(), p_campaign_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this campaign';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.question,
    p.option_a,
    p.option_b,
    COUNT(v.id)::bigint,
    COUNT(v.id) FILTER (WHERE v.choice = 'A')::bigint,
    COUNT(v.id) FILTER (WHERE v.choice = 'B')::bigint,
    CASE WHEN COUNT(v.id) > 0
      THEN ROUND((COUNT(v.id) FILTER (WHERE v.choice = 'A')::numeric / COUNT(v.id)) * 100)::integer
      ELSE 0 END,
    CASE WHEN COUNT(v.id) > 0
      THEN ROUND((COUNT(v.id) FILTER (WHERE v.choice = 'B')::numeric / COUNT(v.id)) * 100)::integer
      ELSE 0 END
  FROM polls p
  LEFT JOIN votes v ON v.poll_id = p.id
  WHERE p.campaign_id = p_campaign_id
  GROUP BY p.id, p.question, p.option_a, p.option_b, p.created_at
  ORDER BY p.created_at;
END;
$$;

-- Demographic breakdown for a campaign (gender + age)
CREATE OR REPLACE FUNCTION public.get_campaign_demographics(p_campaign_id uuid)
RETURNS TABLE (
  segment_type text,
  segment_value text,
  choice text,
  vote_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.is_campaign_client(auth.uid(), p_campaign_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this campaign';
  END IF;

  RETURN QUERY
  SELECT 'gender'::text, COALESCE(v.voter_gender, 'unknown'), v.choice, COUNT(*)::bigint
  FROM votes v
  JOIN polls p ON p.id = v.poll_id
  WHERE p.campaign_id = p_campaign_id
  GROUP BY v.voter_gender, v.choice
  UNION ALL
  SELECT 'age'::text, COALESCE(v.voter_age_range, 'unknown'), v.choice, COUNT(*)::bigint
  FROM votes v
  JOIN polls p ON p.id = v.poll_id
  WHERE p.campaign_id = p_campaign_id
  GROUP BY v.voter_age_range, v.choice
  UNION ALL
  SELECT 'city'::text, COALESCE(v.voter_city, 'unknown'), v.choice, COUNT(*)::bigint
  FROM votes v
  JOIN polls p ON p.id = v.poll_id
  WHERE p.campaign_id = p_campaign_id
  GROUP BY v.voter_city, v.choice;
END;
$$;

-- List campaigns the current user is a client of
CREATE OR REPLACE FUNCTION public.get_my_client_campaigns()
RETURNS TABLE (
  campaign_id uuid,
  name text,
  brand_name text,
  brand_logo_url text,
  description text,
  is_active boolean,
  release_at timestamp with time zone,
  expires_at timestamp with time zone,
  poll_count bigint,
  total_votes bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id,
    pc.name,
    pc.brand_name,
    pc.brand_logo_url,
    pc.description,
    pc.is_active,
    pc.release_at,
    pc.expires_at,
    COUNT(DISTINCT p.id)::bigint,
    COUNT(v.id)::bigint
  FROM poll_campaigns pc
  JOIN campaign_clients cc ON cc.campaign_id = pc.id
  LEFT JOIN polls p ON p.campaign_id = pc.id
  LEFT JOIN votes v ON v.poll_id = p.id
  WHERE cc.user_id = auth.uid()
  GROUP BY pc.id;
END;
$$;