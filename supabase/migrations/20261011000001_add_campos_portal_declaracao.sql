-- Adiciona campos necessários para preenchimento automático do portal.pf.gov.br
ALTER TABLE declaracao_clientes
  ADD COLUMN IF NOT EXISTS local_nascimento TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS uf_nascimento    TEXT NOT NULL DEFAULT 'AM',
  ADD COLUMN IF NOT EXISTS telefone         TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS profissao        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email            TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nome_clube       TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS login_clube      TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS senha_clube      TEXT NOT NULL DEFAULT '';
