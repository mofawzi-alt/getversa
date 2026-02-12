-- Update has_role function to prevent role enumeration
-- Only allow checking own roles, or admins can check any role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If checking someone else's role
  IF _user_id != auth.uid() THEN
    -- Only allow if caller is admin
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
      -- Non-admins can't check other users' roles
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- Fix overly permissive RLS policies

-- 1. Fix user_subscriptions - drop dangerous policy with USING (true)
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.user_subscriptions;

-- Create proper admin-only management policy
CREATE POLICY "Admins can manage subscriptions"
ON public.user_subscriptions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2. Fix user_badges - drop overly permissive management policy  
DROP POLICY IF EXISTS "System can manage user badges" ON public.user_badges;

-- Create admin-only management policy for badges
CREATE POLICY "Admins can manage user badges"
ON public.user_badges
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3. Fix notifications - drop overly permissive insert policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create admin-only insert policy for notifications
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 4. Configure poll-images bucket with file type and size restrictions
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    file_size_limit = 5242880
WHERE id = 'poll-images';