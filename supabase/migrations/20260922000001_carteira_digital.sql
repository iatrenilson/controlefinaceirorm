-- Função pública para exibir dados não-sensíveis do cliente na Carteira Digital
-- SECURITY DEFINER = bypassa RLS, acessível pelo role anon (sem login)
CREATE OR REPLACE FUNCTION public.get_carteira_cliente(p_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id',                   id,
    'nome',                 nome,
    'status',               status,
    'dataEntradaProcesso',  "dataEntradaProcesso",
    'dataDeferimento',      "dataDeferimento",
    'cidade',               cidade,
    'estado',               estado
  ) INTO result
  FROM public.declaracao_clientes
  WHERE id = p_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_carteira_cliente(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_carteira_cliente(UUID) TO authenticated;
