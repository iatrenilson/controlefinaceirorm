-- Atualiza get_carteira_v2 para retornar CPF do cliente
CREATE OR REPLACE FUNCTION public.get_carteira_v2(p_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'id',   c.id,
    'nome', c.nome,
    'cpf',  c.cpf,
    'docs', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id',              d.id,
          'tipo',            d.tipo,
          'arquivo_path',    d.arquivo_path,
          'arquivo_nome',    d.arquivo_nome,
          'data_expedicao',  d.data_expedicao,
          'data_validade',   d.data_validade,
          'numero_serie',    d.numero_serie,
          'nome_arma',       d.nome_arma,
          'sort_order',      d.sort_order
        ) ORDER BY d.sort_order NULLS LAST, d.tipo
      )
      FROM public.carteira_docs d WHERE d.carteira_cliente_id = c.id
    ), '[]'::json)
  ) INTO result FROM public.carteira_clientes c WHERE c.id = p_id;
  RETURN result;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_carteira_v2(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_carteira_v2(UUID) TO authenticated;
