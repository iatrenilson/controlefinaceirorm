-- Make avatars bucket private
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- Update SELECT policy to restrict to owner + admins
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Users can view own avatar"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars' AND (
  auth.uid()::text = (storage.foldername(name))[1]
  OR public.has_role(auth.uid(), 'admin')
));