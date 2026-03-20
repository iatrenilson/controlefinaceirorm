-- Fix wallet_transactions DELETE policy: change from public to authenticated role
DROP POLICY "Users can delete own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can delete own transactions"
ON public.wallet_transactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Fix function search_path issues
DO $$
DECLARE
  func_rec record;
BEGIN
  FOR func_rec IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname NOT IN ('has_role')
      AND (p.proconfig IS NULL OR NOT ('search_path=public' = ANY(p.proconfig)))
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public;',
      func_rec.nspname, func_rec.proname, func_rec.args);
  END LOOP;
END $$;