-- Acompanhamento: além do Portal PF, o Passarinho lê "Listar Processo" do Sinarm CAC (servicos.pf.gov.br/sisgcorp).
-- origem: 'portal' (portal.pf.gov.br) ou 'sinarm' (Sinarm CAC). Campos só do Sinarm: motivo, GRU e posição na fila.
ALTER TABLE public.processos_pf ADD COLUMN IF NOT EXISTS origem       text NOT NULL DEFAULT 'portal';
ALTER TABLE public.processos_pf ADD COLUMN IF NOT EXISTS motivo       text NOT NULL DEFAULT '';
ALTER TABLE public.processos_pf ADD COLUMN IF NOT EXISTS gru          text NOT NULL DEFAULT '';
ALTER TABLE public.processos_pf ADD COLUMN IF NOT EXISTS posicao_fila text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.get_acompanhamento(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'nome',   btrim(regexp_replace(c.nome, '\([^)]*\)', '', 'g')),
    'etapa',  c.status,
    'processos', COALESCE((
      SELECT json_agg(json_build_object(
        'protocolo', p.protocolo, 'servico', p.servico, 'descricao', p.descricao, 'status', p.status,
        'data_solicitacao', p.data_solicitacao, 'status_desde', p.status_desde, 'consultado_em', p.consultado_em,
        'origem', p.origem, 'motivo', p.motivo, 'gru', p.gru, 'posicao_fila', p.posicao_fila
      ) ORDER BY (CASE WHEN p.data_solicitacao ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date(p.data_solicitacao, 'DD/MM/YYYY') END)
                 DESC NULLS LAST, p.protocolo DESC)
      FROM public.processos_pf p WHERE p.cliente_id = c.id
    ), '[]'::json)
  ) INTO result FROM public.declaracao_clientes c WHERE c.id = p_id;
  RETURN result;
END; $$;

NOTIFY pgrst, 'reload schema';
