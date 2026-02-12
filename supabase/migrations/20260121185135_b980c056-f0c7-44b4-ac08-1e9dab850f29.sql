-- Create a security definer function to get all polls for history
-- This bypasses RLS while still only returning safe data
CREATE OR REPLACE FUNCTION public.get_all_polls_for_history()
RETURNS TABLE (
  id uuid,
  question text,
  option_a text,
  option_b text,
  category text,
  image_a_url text,
  image_b_url text,
  is_active boolean,
  is_daily_poll boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz,
  created_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.question,
    p.option_a,
    p.option_b,
    p.category,
    p.image_a_url,
    p.image_b_url,
    p.is_active,
    p.is_daily_poll,
    p.starts_at,
    p.ends_at,
    p.created_at,
    p.created_by
  FROM polls p
  ORDER BY p.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_polls_for_history() TO authenticated;

-- Also update the polls RLS policy to allow viewing expired polls
-- Drop the restrictive policy and create a more permissive one for active users
DROP POLICY IF EXISTS "Users can view targeted active polls" ON public.polls;

CREATE POLICY "Users can view all polls" 
ON public.polls 
FOR SELECT 
USING (
  -- Admin sees all
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Regular users can see polls created on or after their signup date
  (date(created_at) >= date((SELECT u.created_at FROM users u WHERE u.id = auth.uid())))
);