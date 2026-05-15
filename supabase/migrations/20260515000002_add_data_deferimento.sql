-- Adiciona campo de data de deferimento aos clientes de declaração
ALTER TABLE public.declaracao_clientes
  ADD COLUMN IF NOT EXISTS data_deferimento date;
