
-- Add update policy for delay_transacoes so admins can edit transactions
CREATE POLICY "Admins can update delay_transacoes"
  ON public.delay_transacoes FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
