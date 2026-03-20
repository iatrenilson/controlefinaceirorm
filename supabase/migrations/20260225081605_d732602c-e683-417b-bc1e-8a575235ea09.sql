-- 1. Fix notifications: users should only see notifications targeted to them or broadcast (null target)
DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (target_user_id = auth.uid() OR target_user_id IS NULL);

-- 2. Fix wallet_transactions: remove DELETE policy to maintain financial audit trail
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.wallet_transactions;

-- 3. Add INSERT policy for profiles so users can create their own profile
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile"
      ON public.profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;