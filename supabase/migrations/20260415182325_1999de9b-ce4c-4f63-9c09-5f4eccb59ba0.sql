
CREATE POLICY "Anyone can view dimensions"
ON public.dimensions FOR SELECT
TO authenticated
USING (true);
