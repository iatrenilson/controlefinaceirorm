
-- Tabela de clientes de delay esportivo
CREATE TABLE public.delay_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  casa TEXT NOT NULL DEFAULT 'Bet365',
  login TEXT,
  senha TEXT,
  fornecedor TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  operacao TEXT NOT NULL DEFAULT 'operando',
  tipo TEXT DEFAULT '50/50',
  depositos NUMERIC NOT NULL DEFAULT 0,
  saques NUMERIC NOT NULL DEFAULT 0,
  custos NUMERIC NOT NULL DEFAULT 0,
  lucro NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delay_clientes ENABLE ROW LEVEL SECURITY;

-- Only admins can CRUD
CREATE POLICY "Admins can view delay_clientes"
ON public.delay_clientes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert delay_clientes"
ON public.delay_clientes FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update delay_clientes"
ON public.delay_clientes FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete delay_clientes"
ON public.delay_clientes FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_delay_clientes_updated_at
BEFORE UPDATE ON public.delay_clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
