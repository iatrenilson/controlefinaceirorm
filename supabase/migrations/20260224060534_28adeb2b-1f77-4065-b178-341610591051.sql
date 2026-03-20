
-- Create archive table for loan history
CREATE TABLE public.clientes_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  juros NUMERIC NOT NULL,
  telefone TEXT DEFAULT '',
  data_emprestimo DATE NOT NULL,
  data_pagamento DATE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'removido', -- 'pago' or 'removido'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history" ON public.clientes_historico
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON public.clientes_historico
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all history" ON public.clientes_historico
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
