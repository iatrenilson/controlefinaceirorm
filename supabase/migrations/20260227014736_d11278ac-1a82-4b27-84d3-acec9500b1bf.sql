
-- Revoke all anonymous access to sensitive tables
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.clientes FROM anon;
REVOKE ALL ON public.delay_clientes FROM anon;
REVOKE ALL ON public.wallet_transactions FROM anon;
REVOKE ALL ON public.wallets FROM anon;
REVOKE ALL ON public.clientes_historico FROM anon;
REVOKE ALL ON public.delay_transacoes FROM anon;
REVOKE ALL ON public.financeiro FROM anon;
REVOKE ALL ON public.notification_preferences FROM anon;
