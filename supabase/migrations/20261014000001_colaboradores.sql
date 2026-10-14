-- Tabela de colaboradores (links sem login)
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       TEXT    NOT NULL,
  token      TEXT    NOT NULL UNIQUE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='colaboradores' AND policyname='colab_owner') THEN
    CREATE POLICY "colab_owner" ON public.colaboradores
      USING (owner_user_id = auth.uid())
      WITH CHECK (owner_user_id = auth.uid());
  END IF;
END $$;

-- Coluna de vínculo em cac_cadastros
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS colaborador_token TEXT;

-- Info do colaborador pelo token (público)
CREATE OR REPLACE FUNCTION public.get_colaborador_info(p_token TEXT)
RETURNS TABLE(id UUID, nome TEXT, ativo BOOLEAN)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY SELECT c.id, c.nome, c.ativo FROM colaboradores c WHERE c.token = p_token LIMIT 1;
END;
$$;

-- Listar clientes do colaborador
CREATE OR REPLACE FUNCTION public.get_cac_cadastros_by_token(p_token TEXT)
RETURNS TABLE(
  id UUID, nome TEXT, cpf TEXT, endereco TEXT, numero TEXT, complemento TEXT,
  bairro TEXT, cidade TEXT, estado TEXT, tipo_sinarm TEXT, armas TEXT,
  psicologico_url TEXT, created_at TIMESTAMPTZ, colaborador_token TEXT
)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    SELECT c.id, c.nome, c.cpf, c.endereco, c.numero, c.complemento,
           c.bairro, c.cidade, c.estado, c.tipo_sinarm, c.armas,
           c.psicologico_url, c.created_at, c.colaborador_token
    FROM cac_cadastros c
    WHERE c.colaborador_token = p_token
    ORDER BY c.created_at DESC;
END;
$$;

-- Inserir cliente pelo colaborador
CREATE OR REPLACE FUNCTION public.insert_cac_cadastro_by_token(
  p_token TEXT, p_nome TEXT, p_cpf TEXT, p_endereco TEXT, p_numero TEXT,
  p_complemento TEXT, p_bairro TEXT, p_cidade TEXT, p_estado TEXT,
  p_tipo_sinarm TEXT, p_armas TEXT, p_psicologico_url TEXT
) RETURNS UUID
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM colaboradores WHERE token = p_token AND ativo = true) THEN
    RAISE EXCEPTION 'Link inválido ou desativado';
  END IF;
  INSERT INTO cac_cadastros (nome, cpf, endereco, numero, complemento, bairro, cidade, estado, tipo_sinarm, armas, psicologico_url, colaborador_token)
  VALUES (p_nome, p_cpf, p_endereco, p_numero, p_complemento, p_bairro, p_cidade, p_estado, p_tipo_sinarm, p_armas, p_psicologico_url, p_token)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Atualizar cliente pelo colaborador
CREATE OR REPLACE FUNCTION public.update_cac_cadastro_by_token(
  p_token TEXT, p_id UUID, p_nome TEXT, p_cpf TEXT, p_endereco TEXT, p_numero TEXT,
  p_complemento TEXT, p_bairro TEXT, p_cidade TEXT, p_estado TEXT,
  p_tipo_sinarm TEXT, p_armas TEXT
) RETURNS VOID
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM colaboradores WHERE token = p_token AND ativo = true) THEN
    RAISE EXCEPTION 'Link inválido ou desativado';
  END IF;
  UPDATE cac_cadastros SET
    nome = p_nome, cpf = p_cpf, endereco = p_endereco, numero = p_numero,
    complemento = p_complemento, bairro = p_bairro, cidade = p_cidade,
    estado = p_estado, tipo_sinarm = p_tipo_sinarm, armas = p_armas
  WHERE id = p_id AND colaborador_token = p_token;
END;
$$;

-- Excluir cliente pelo colaborador
CREATE OR REPLACE FUNCTION public.delete_cac_cadastro_by_token(p_token TEXT, p_id UUID)
RETURNS VOID
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM colaboradores WHERE token = p_token AND ativo = true) THEN
    RAISE EXCEPTION 'Link inválido ou desativado';
  END IF;
  DELETE FROM cac_cadastros WHERE id = p_id AND colaborador_token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_colaborador_info(TEXT)                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cac_cadastros_by_token(TEXT)                   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_cac_cadastro_by_token(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_cac_cadastro_by_token(TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_cac_cadastro_by_token(TEXT,UUID)            TO anon, authenticated;
