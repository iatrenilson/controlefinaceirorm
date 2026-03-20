
-- Update delay_clientes SELECT policy: admins see all, moderators see only their own
DROP POLICY IF EXISTS "Admins and mods can view delay_clientes" ON public.delay_clientes;
CREATE POLICY "Admins and mods can view delay_clientes" ON public.delay_clientes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (has_role(auth.uid(), 'moderator'::app_role) AND auth.uid() = user_id)
);

-- Update delay_clientes mutation policies: moderators can only modify their own
DROP POLICY IF EXISTS "Admins and mods can insert delay_clientes" ON public.delay_clientes;
CREATE POLICY "Admins and mods can insert delay_clientes" ON public.delay_clientes FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'moderator'::app_role) AND auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Admins and mods can update delay_clientes" ON public.delay_clientes;
CREATE POLICY "Admins and mods can update delay_clientes" ON public.delay_clientes FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'moderator'::app_role) AND auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Admins and mods can delete delay_clientes" ON public.delay_clientes;
CREATE POLICY "Admins and mods can delete delay_clientes" ON public.delay_clientes FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'moderator'::app_role) AND auth.uid() = user_id)
);

-- Update delay_transacoes: moderators see only their own transactions
DROP POLICY IF EXISTS "Admins and mods can view delay_transacoes" ON public.delay_transacoes;
CREATE POLICY "Admins and mods can view delay_transacoes" ON public.delay_transacoes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'moderator'::app_role) AND auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Admins and mods can insert delay_transacoes" ON public.delay_transacoes;
CREATE POLICY "Admins and mods can insert delay_transacoes" ON public.delay_transacoes FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'moderator'::app_role) AND auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Admins and mods can update delay_transacoes" ON public.delay_transacoes;
CREATE POLICY "Admins and mods can update delay_transacoes" ON public.delay_transacoes FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'moderator'::app_role) AND auth.uid() = user_id)
);

DROP POLICY IF EXISTS "Admins and mods can delete delay_transacoes" ON public.delay_transacoes;
CREATE POLICY "Admins and mods can delete delay_transacoes" ON public.delay_transacoes FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'moderator'::app_role) AND auth.uid() = user_id)
);
