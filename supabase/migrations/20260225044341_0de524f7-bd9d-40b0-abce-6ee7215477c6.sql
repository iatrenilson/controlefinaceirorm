
-- Create delay transactions history table
CREATE TABLE public.delay_transacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.delay_clientes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'deposito', -- 'deposito' or 'saque'
  valor NUMERIC NOT NULL DEFAULT 0,
  custo NUMERIC NOT NULL DEFAULT 0,
  lucro NUMERIC NOT NULL DEFAULT 0,
  casa TEXT NOT NULL DEFAULT '',
  dividir_lucro BOOLEAN NOT NULL DEFAULT false,
  data_transacao DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delay_transacoes ENABLE ROW LEVEL SECURITY;

-- RLS policies - admin only (same as delay_clientes)
CREATE POLICY "Admins can view delay_transacoes"
  ON public.delay_transacoes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert delay_transacoes"
  ON public.delay_transacoes FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete delay_transacoes"
  ON public.delay_transacoes FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for faster queries
CREATE INDEX idx_delay_transacoes_cliente ON public.delay_transacoes(cliente_id);
CREATE INDEX idx_delay_transacoes_user ON public.delay_transacoes(user_id);
