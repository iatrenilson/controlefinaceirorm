
-- Create clientes table
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  juros NUMERIC NOT NULL,
  data_emprestimo DATE NOT NULL,
  data_pagamento DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only access their own clients
CREATE POLICY "Users can view their own clientes"
  ON public.clientes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clientes"
  ON public.clientes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clientes"
  ON public.clientes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clientes"
  ON public.clientes FOR DELETE
  USING (auth.uid() = user_id);
