ALTER TABLE declaracao_clientes
  ADD COLUMN IF NOT EXISTS complemento TEXT NOT NULL DEFAULT '';
