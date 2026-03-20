-- Allow users to delete their own wallet_transactions
CREATE POLICY "Users can delete own transactions"
ON public.wallet_transactions
FOR DELETE
USING (auth.uid() = user_id);