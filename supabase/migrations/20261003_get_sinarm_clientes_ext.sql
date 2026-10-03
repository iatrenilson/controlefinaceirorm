-- Função para a extensão Chrome buscar clientes do Sinarm CAC
-- SECURITY DEFINER para bypassar RLS, restrito a admin/moderator
CREATE OR REPLACE FUNCTION public.get_sinarm_clientes_ext()
RETURNS TABLE(id uuid, nome text, cpf text, nome_mae text, data_nascimento text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só permite admin, moderator ou o dono do sistema
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'moderator') OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'iat.renilson.martins@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
    SELECT
      dc.id,
      dc.nome::text,
      dc.cpf::text,
      dc.nome_mae::text,
      dc.data_nascimento::text
    FROM declaracao_clientes dc
    ORDER BY dc.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sinarm_clientes_ext() TO authenticated;
