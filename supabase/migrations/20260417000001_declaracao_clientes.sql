-- Tabela de clientes das declarações (compartilhada entre admins/moderadores)
CREATE TABLE IF NOT EXISTS public.declaracao_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  rg text NOT NULL DEFAULT '',
  orgao_emissor text NOT NULL DEFAULT 'SSP-AM',
  data_expedicao text NOT NULL DEFAULT '',
  cpf text NOT NULL DEFAULT '',
  nome_pai text NOT NULL DEFAULT '',
  nome_mae text NOT NULL DEFAULT '',
  estado_civil text NOT NULL DEFAULT 'Solteiro(a)',
  data_nascimento text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '',
  numero text NOT NULL DEFAULT '',
  bairro text NOT NULL DEFAULT '',
  cep text NOT NULL DEFAULT '',
  cidade text NOT NULL DEFAULT 'Manaus',
  estado text NOT NULL DEFAULT 'AM',
  senha_gov text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.declaracao_clientes ENABLE ROW LEVEL SECURITY;

-- Admins e moderadores podem ver, inserir, editar e excluir todos os clientes
CREATE POLICY "Admins and moderators can select declaracao_clientes"
  ON public.declaracao_clientes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "Admins and moderators can insert declaracao_clientes"
  ON public.declaracao_clientes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "Admins and moderators can update declaracao_clientes"
  ON public.declaracao_clientes FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "Admins and moderators can delete declaracao_clientes"
  ON public.declaracao_clientes FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'moderator')
  );
