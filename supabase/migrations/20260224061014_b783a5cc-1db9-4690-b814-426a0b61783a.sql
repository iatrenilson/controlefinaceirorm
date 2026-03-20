CREATE POLICY "Users can delete own history"
ON public.clientes_historico
FOR DELETE
USING (auth.uid() = user_id);