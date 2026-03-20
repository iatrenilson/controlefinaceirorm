
-- Allow users to delete their own wallet transactions
CREATE POLICY "Users can delete own transactions"
ON public.wallet_transactions
FOR DELETE
USING (auth.uid() = user_id);
