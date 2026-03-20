
-- Add user-level RLS policies for delay_clientes so owners can access their own records
CREATE POLICY "Users can view own delay_clientes"
ON public.delay_clientes FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own delay_clientes"
ON public.delay_clientes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own delay_clientes"
ON public.delay_clientes FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own delay_clientes"
ON public.delay_clientes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Add user-level RLS policies for delay_transacoes
CREATE POLICY "Users can view own delay_transacoes"
ON public.delay_transacoes FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own delay_transacoes"
ON public.delay_transacoes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own delay_transacoes"
ON public.delay_transacoes FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own delay_transacoes"
ON public.delay_transacoes FOR DELETE TO authenticated
USING (auth.uid() = user_id);
