CREATE OR REPLACE FUNCTION public.is_organization_member(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = _user_id
        AND om.organization_id = _organization_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_organization_owner(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = _organization_id
        AND o.created_by = _user_id
    );
$$;

DROP POLICY IF EXISTS "Members can view members in their orgs" ON public.organization_members;
CREATE POLICY "Members can view members in their orgs"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  public.is_organization_member(auth.uid(), organization_id)
  OR public.is_organization_owner(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Org owners can remove members" ON public.organization_members;
CREATE POLICY "Org owners can remove members"
ON public.organization_members
FOR DELETE
TO authenticated
USING (public.is_organization_owner(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can leave organizations" ON public.organization_members;
CREATE POLICY "Users can leave organizations"
ON public.organization_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can join organizations" ON public.organization_members;
CREATE POLICY "Users can join organizations"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
CREATE POLICY "Members can view their organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_organization_member(auth.uid(), id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Anyone can view active polls" ON public.polls;
CREATE POLICY "Anyone can view active polls"
ON public.polls
FOR SELECT
TO public
USING (
  is_active = true
  AND (
    organization_id IS NULL
    OR public.is_organization_member(auth.uid(), organization_id)
    OR public.is_organization_owner(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);