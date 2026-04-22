-- Adiciona colunas de status aos clientes de declaração
ALTER TABLE public.declaracao_clientes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'doc',
  ADD COLUMN IF NOT EXISTS status2 text NOT NULL DEFAULT 'doc';
