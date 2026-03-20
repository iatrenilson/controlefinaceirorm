-- Add CHECK constraint to prevent negative wallet balances
ALTER TABLE public.wallets ADD CONSTRAINT positive_balance CHECK (saldo >= 0);

-- Make avatars bucket private (require authentication to view)
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- Drop the old public SELECT policy and replace with authenticated-only
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');
