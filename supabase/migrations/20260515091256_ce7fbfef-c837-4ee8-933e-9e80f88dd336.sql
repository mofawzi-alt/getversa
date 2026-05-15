
INSERT INTO storage.buckets (id, name, public)
VALUES ('poll-videos', 'poll-videos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view poll videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'poll-videos');

CREATE POLICY "Admins can upload poll videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'poll-videos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update poll videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'poll-videos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete poll videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'poll-videos' AND public.has_role(auth.uid(), 'admin'));
