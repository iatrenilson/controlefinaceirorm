-- Create financial transactions table
CREATE TABLE public.financeiro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'em_aberto' CHECK (status IN ('paga', 'vencida', 'em_aberto')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own financeiro"
ON public.financeiro FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own financeiro"
ON public.financeiro FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own financeiro"
ON public.financeiro FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own financeiro"
ON public.financeiro FOR DELETE
USING (auth.uid() = user_id);