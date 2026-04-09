
-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization_members table
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Add organization_id to polls (nullable = public poll)
ALTER TABLE public.polls ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Organization policies
CREATE POLICY "Admins can manage all organizations"
  ON public.organizations FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update their organizations"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- Allow anyone to read org by invite code (needed for join flow)
CREATE POLICY "Anyone can lookup org by invite code"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (true);

-- Organization members policies
CREATE POLICY "Admins can manage all members"
  ON public.organization_members FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members can view members in their orgs"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join organizations"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave organizations"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Org owners can remove members"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_members.organization_id
        AND o.created_by = auth.uid()
    )
  );

-- Update polls SELECT policy to include org-private polls for members
-- Drop the existing public read policy first
DROP POLICY IF EXISTS "Anyone can view active polls" ON public.polls;

-- Recreate with org visibility logic
CREATE POLICY "Anyone can view active polls"
  ON public.polls FOR SELECT
  TO public
  USING (
    is_active = true
    AND (
      organization_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = polls.organization_id
          AND om.user_id = auth.uid()
      )
    )
  );

-- Index for performance
CREATE INDEX idx_polls_organization_id ON public.polls(organization_id);
CREATE INDEX idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON public.organization_members(organization_id);
CREATE INDEX idx_organizations_invite_code ON public.organizations(invite_code);

-- Trigger for updated_at on organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
