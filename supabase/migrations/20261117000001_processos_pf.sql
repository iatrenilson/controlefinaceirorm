-- Acompanhamento de processos: o Passarinho lê "Minhas solicitações" no Portal PF (na conta gov do cliente)
-- e grava aqui o status de cada protocolo. O cliente vê pelo link público /acompanhamento/<id do cliente>.
CREATE TABLE IF NOT EXISTS public.processos_pf (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       uuid NOT NULL REFERENCES public.declaracao_clientes(id) ON DELETE CASCADE,
  protocolo        text NOT NULL,
  servico          text NOT NULL DEFAULT '',
  descricao        text NOT NULL DEFAULT '',   -- ex.: "Rascunho"
  status           text NOT NULL DEFAULT '',   -- ex.: "Aguardando documentação", "Em análise"
  data_solicitacao text,                       -- como aparece na PF (dd/mm/aaaa)
  status_desde     timestamptz NOT NULL DEFAULT now(),  -- quando a extensão viu este status pela 1ª vez
  consultado_em    timestamptz NOT NULL DEFAULT now(),  -- última vez que a extensão leu na PF
  UNIQUE (cliente_id, protocolo)
);

ALTER TABLE public.processos_pf ENABLE ROW LEVEL SECURITY;

-- Admin vê tudo; moderador só os processos dos clientes dele (mesma regra de declaracao_clientes)
DROP POLICY IF EXISTS processos_pf_dono ON public.processos_pf;
CREATE POLICY processos_pf_dono ON public.processos_pf FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.declaracao_clientes c WHERE c.id = processos_pf.cliente_id AND c.owner_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.declaracao_clientes c WHERE c.id = processos_pf.cliente_id AND c.owner_id = auth.uid()));

-- Página pública do cliente: só nome, etapa no escritório e os processos (sem CPF, sem documentos)
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
        'data_solicitacao', p.data_solicitacao, 'status_desde', p.status_desde, 'consultado_em', p.consultado_em
      ) ORDER BY p.protocolo DESC)
      FROM public.processos_pf p WHERE p.cliente_id = c.id
    ), '[]'::json)
  ) INTO result FROM public.declaracao_clientes c WHERE c.id = p_id;
  RETURN result;
END; $$;

REVOKE ALL ON FUNCTION public.get_acompanhamento(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_acompanhamento(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Carteira digital: devolve também o id do cliente em Clientes Armas com o mesmo CPF, para o botão
-- "Acompanhar processo" da carteira abrir o link de acompanhamento (resto igual à versão no banco em 2026-11-17)
CREATE OR REPLACE FUNCTION public.get_carteira_v2(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'id',   c.id, 'nome', c.nome, 'cpf',  c.cpf,
    'acompanhamento', (
      SELECT dc.id FROM public.declaracao_clientes dc
      WHERE NULLIF(regexp_replace(COALESCE(c.cpf, ''), '\D', '', 'g'), '') IS NOT NULL
        AND regexp_replace(COALESCE(dc.cpf, ''), '\D', '', 'g') = regexp_replace(c.cpf, '\D', '', 'g')
      LIMIT 1),
    'docs', COALESCE((
      SELECT json_agg(json_build_object(
        'id',d.id,'tipo',d.tipo,'arquivo_path',d.arquivo_path,'arquivo_nome',d.arquivo_nome,
        'data_expedicao',d.data_expedicao,'data_validade',d.data_validade,
        'numero_serie',d.numero_serie,'nome_arma',d.nome_arma,'sort_order',d.sort_order
      ) ORDER BY d.sort_order NULLS LAST, d.tipo)
      FROM public.carteira_docs d WHERE d.carteira_cliente_id = c.id
    ),'[]'::json)
  ) INTO result FROM public.carteira_clientes c WHERE c.id = p_id;
  RETURN result;
END; $function$;

NOTIFY pgrst, 'reload schema';
