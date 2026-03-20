
-- Drop existing admin-only policies on delay_clientes
DROP POLICY IF EXISTS "Admins can delete delay_clientes" ON public.delay_clientes;
DROP POLICY IF EXISTS "Admins can insert delay_clientes" ON public.delay_clientes;
DROP POLICY IF EXISTS "Admins can update delay_clientes" ON public.delay_clientes;
DROP POLICY IF EXISTS "Admins can view delay_clientes" ON public.delay_clientes;

-- Recreate with admin OR moderator
CREATE POLICY "Admins and mods can delete delay_clientes" ON public.delay_clientes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Admins and mods can insert delay_clientes" ON public.delay_clientes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Admins and mods can update delay_clientes" ON public.delay_clientes FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Admins and mods can view delay_clientes" ON public.delay_clientes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Drop existing admin-only policies on delay_transacoes
DROP POLICY IF EXISTS "Admins can delete delay_transacoes" ON public.delay_transacoes;
DROP POLICY IF EXISTS "Admins can insert delay_transacoes" ON public.delay_transacoes;
DROP POLICY IF EXISTS "Admins can update delay_transacoes" ON public.delay_transacoes;
DROP POLICY IF EXISTS "Admins can view delay_transacoes" ON public.delay_transacoes;

-- Recreate with admin OR moderator
CREATE POLICY "Admins and mods can delete delay_transacoes" ON public.delay_transacoes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Admins and mods can insert delay_transacoes" ON public.delay_transacoes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Admins and mods can update delay_transacoes" ON public.delay_transacoes FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Admins and mods can view delay_transacoes" ON public.delay_transacoes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Drop existing admin-only policies on delay_share_links
DROP POLICY IF EXISTS "Admins can manage share links" ON public.delay_share_links;

-- Recreate with admin OR moderator
CREATE POLICY "Admins and mods can manage share links" ON public.delay_share_links FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
