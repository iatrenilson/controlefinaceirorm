-- Adiciona colunas de parcelas à tabela clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS parcelas integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parcela_atual integer NOT NULL DEFAULT 1;
