-- Adiciona campo de data de entrada do processo aos clientes de declaração
ALTER TABLE public.declaracao_clientes
  ADD COLUMN IF NOT EXISTS data_entrada_processo date;
