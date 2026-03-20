
-- Fix all RLS policies to explicitly restrict to authenticated users only

-- ========== profiles ==========
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ========== clientes ==========
DROP POLICY IF EXISTS "Users can view their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can insert their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can update their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can delete their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admins can view all clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admins can delete clientes" ON public.clientes;

CREATE POLICY "Users can view their own clientes" ON public.clientes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clientes" ON public.clientes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clientes" ON public.clientes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all clientes" ON public.clientes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete clientes" ON public.clientes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== clientes_historico ==========
DROP POLICY IF EXISTS "Users can view own history" ON public.clientes_historico;
DROP POLICY IF EXISTS "Users can insert own history" ON public.clientes_historico;
DROP POLICY IF EXISTS "Admins can view all history" ON public.clientes_historico;
DROP POLICY IF EXISTS "Users can delete own history" ON public.clientes_historico;

CREATE POLICY "Users can view own history" ON public.clientes_historico FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own history" ON public.clientes_historico FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all history" ON public.clientes_historico FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can delete own history" ON public.clientes_historico FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========== delay_clientes ==========
DROP POLICY IF EXISTS "Admins can view delay_clientes" ON public.delay_clientes;
DROP POLICY IF EXISTS "Admins can insert delay_clientes" ON public.delay_clientes;
DROP POLICY IF EXISTS "Admins can update delay_clientes" ON public.delay_clientes;
DROP POLICY IF EXISTS "Admins can delete delay_clientes" ON public.delay_clientes;

CREATE POLICY "Admins can view delay_clientes" ON public.delay_clientes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert delay_clientes" ON public.delay_clientes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update delay_clientes" ON public.delay_clientes FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete delay_clientes" ON public.delay_clientes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== delay_transacoes ==========
DROP POLICY IF EXISTS "Admins can view delay_transacoes" ON public.delay_transacoes;
DROP POLICY IF EXISTS "Admins can insert delay_transacoes" ON public.delay_transacoes;
DROP POLICY IF EXISTS "Admins can delete delay_transacoes" ON public.delay_transacoes;
DROP POLICY IF EXISTS "Admins can update delay_transacoes" ON public.delay_transacoes;

CREATE POLICY "Admins can view delay_transacoes" ON public.delay_transacoes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert delay_transacoes" ON public.delay_transacoes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete delay_transacoes" ON public.delay_transacoes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update delay_transacoes" ON public.delay_transacoes FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== financeiro ==========
DROP POLICY IF EXISTS "Users can view own financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Users can insert own financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Users can update own financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Users can delete own financeiro" ON public.financeiro;

CREATE POLICY "Users can view own financeiro" ON public.financeiro FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own financeiro" ON public.financeiro FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own financeiro" ON public.financeiro FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own financeiro" ON public.financeiro FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========== wallet_transactions ==========
DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.wallet_transactions;

CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.wallet_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== wallets ==========
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.wallets;

CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet" ON public.wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all wallets" ON public.wallets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== notification_preferences ==========
DROP POLICY IF EXISTS "Users can view own preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.notification_preferences;

CREATE POLICY "Users can view own preferences" ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.notification_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ========== notifications ==========
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete notifications" ON public.notifications FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING ((target_user_id = auth.uid()) OR (target_user_id IS NULL));

-- ========== user_notifications ==========
DROP POLICY IF EXISTS "Users can view own notification status" ON public.user_notifications;
DROP POLICY IF EXISTS "Users can insert own notification status" ON public.user_notifications;
DROP POLICY IF EXISTS "Users can update own notification status" ON public.user_notifications;

CREATE POLICY "Users can view own notification status" ON public.user_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notification status" ON public.user_notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification status" ON public.user_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ========== user_roles ==========
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
