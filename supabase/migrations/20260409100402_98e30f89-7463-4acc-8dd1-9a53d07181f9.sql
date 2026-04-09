-- Simplify polls policy: all active polls visible to everyone
DROP POLICY IF EXISTS "Anyone can view active polls" ON public.polls;
CREATE POLICY "Anyone can view active polls"
ON public.polls
FOR SELECT
TO public
USING (is_active = true);

-- Drop all org-related policies on organization_members
DROP POLICY IF EXISTS "Admins can manage all members" ON public.organization_members;
DROP POLICY IF EXISTS "Members can view members in their orgs" ON public.organization_members;
DROP POLICY IF EXISTS "Org owners can remove members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can join organizations" ON public.organization_members;
DROP POLICY IF EXISTS "Users can leave organizations" ON public.organization_members;

-- Simple admin-only policy for organization_members
CREATE POLICY "Admins can manage all members"
ON public.organization_members
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Drop all org-related policies on organizations
DROP POLICY IF EXISTS "Admins can manage all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Anyone can lookup org by invite code" ON public.organizations;
DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Owners can update their organizations" ON public.organizations;

-- Simple admin-only policy for organizations
CREATE POLICY "Admins can manage all organizations"
ON public.organizations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Drop helper functions (no longer needed)
DROP FUNCTION IF EXISTS public.is_organization_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_organization_owner(uuid, uuid);