-- Link de colaborador do laudo (2026-11-27, o usuário pediu): sem o laudo psicológico; telefone do cliente obrigatório
-- (exigido pela PF: o número do próprio cliente, não o do despachante).
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS telefone text;

DROP FUNCTION IF EXISTS public.get_cac_cadastros_by_token(text);
CREATE FUNCTION public.get_cac_cadastros_by_token(p_token text)
 RETURNS TABLE(id uuid, nome text, cpf text, telefone text, endereco text, numero text, complemento text, bairro text, cidade text,
               estado text, tipo_sinarm text, armas text, psicologico_url text, created_at timestamp with time zone, colaborador_token text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN RETURN QUERY SELECT c.id, c.nome, c.cpf, c.telefone, c.endereco, c.numero, c.complemento, c.bairro, c.cidade, c.estado,
  c.tipo_sinarm, c.armas, c.psicologico_url, c.created_at, c.colaborador_token
  FROM cac_cadastros c WHERE c.colaborador_token = p_token ORDER BY c.created_at DESC; END; $$;
GRANT EXECUTE ON FUNCTION public.get_cac_cadastros_by_token(text) TO anon, authenticated;

-- a antiga (com p_psicologico_url) tem o mesmo número de parâmetros texto: precisa sair antes
DROP FUNCTION IF EXISTS public.insert_cac_cadastro_by_token(text, text, text, text, text, text, text, text, text, text, text, text);
CREATE FUNCTION public.insert_cac_cadastro_by_token(p_token text, p_nome text, p_cpf text, p_telefone text, p_endereco text,
  p_numero text, p_complemento text, p_bairro text, p_cidade text, p_estado text, p_tipo_sinarm text, p_armas text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE v_id UUID; BEGIN
  IF NOT EXISTS (SELECT 1 FROM colaboradores WHERE token = p_token AND ativo = true) THEN RAISE EXCEPTION 'Link invalido ou desativado'; END IF;
  IF length(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g')) < 10 THEN RAISE EXCEPTION 'Informe o telefone do cliente com DDD'; END IF;
  INSERT INTO cac_cadastros (nome, cpf, telefone, endereco, numero, complemento, bairro, cidade, estado, tipo_sinarm, armas, colaborador_token)
  VALUES (p_nome, p_cpf, p_telefone, p_endereco, p_numero, p_complemento, p_bairro, p_cidade, p_estado, p_tipo_sinarm, p_armas, p_token)
  RETURNING id INTO v_id; RETURN v_id; END; $$;
GRANT EXECUTE ON FUNCTION public.insert_cac_cadastro_by_token(text, text, text, text, text, text, text, text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_cac_cadastro_by_token(p_token text, p_id uuid, p_nome text, p_cpf text, p_telefone text, p_endereco text,
  p_numero text, p_complemento text, p_bairro text, p_cidade text, p_estado text, p_tipo_sinarm text, p_armas text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM colaboradores WHERE token = p_token AND ativo = true) THEN RAISE EXCEPTION 'Link invalido ou desativado'; END IF;
  UPDATE cac_cadastros SET nome = p_nome, cpf = p_cpf, telefone = p_telefone, endereco = p_endereco, numero = p_numero, complemento = p_complemento,
    bairro = p_bairro, cidade = p_cidade, estado = p_estado, tipo_sinarm = p_tipo_sinarm, armas = p_armas
  WHERE id = p_id AND colaborador_token = p_token; END; $$;
GRANT EXECUTE ON FUNCTION public.update_cac_cadastro_by_token(text, uuid, text, text, text, text, text, text, text, text, text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
