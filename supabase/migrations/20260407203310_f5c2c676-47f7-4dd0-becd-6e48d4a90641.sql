
-- Add missing SELECT policy for push_subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add missing UPDATE policy for push_subscriptions  
CREATE POLICY "Users can update their own subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
