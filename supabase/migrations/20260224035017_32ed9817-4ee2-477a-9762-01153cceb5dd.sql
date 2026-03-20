
-- Create wallet transactions log table
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('deposito', 'retirada', 'emprestimo', 'pagamento', 'estorno')),
  valor NUMERIC NOT NULL,
  saldo_anterior NUMERIC NOT NULL,
  saldo_posterior NUMERIC NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
ON public.wallet_transactions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert own transactions
CREATE POLICY "Users can insert own transactions"
ON public.wallet_transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions"
ON public.wallet_transactions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
