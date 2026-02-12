-- Create storage bucket for poll images
INSERT INTO storage.buckets (id, name, public)
VALUES ('poll-images', 'poll-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload poll images
CREATE POLICY "Admins can upload poll images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'poll-images' AND
  public.has_role(auth.uid(), 'admin')
);

-- Allow public access to view poll images
CREATE POLICY "Anyone can view poll images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'poll-images');

-- Allow admins to delete poll images
CREATE POLICY "Admins can delete poll images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'poll-images' AND
  public.has_role(auth.uid(), 'admin')
);