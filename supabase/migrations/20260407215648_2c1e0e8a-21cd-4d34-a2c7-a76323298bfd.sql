CREATE POLICY "Allow public uploads to poll-images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'poll-images');

CREATE POLICY "Allow public read poll-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'poll-images');