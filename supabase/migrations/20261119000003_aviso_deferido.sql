-- Processo deferido no sininho da carteira por 2 dias + reenvio do aviso para quem não abriu (o usuário pediu, 2026-11-19)

-- 1) quando o status mudou DE VERDADE (a extensão regrava a lista toda; a 1ª leitura de um processo não conta)
ALTER TABLE public.processos_pf ADD COLUMN IF NOT EXISTS status_mudou_em timestamptz;
CREATE OR REPLACE FUNCTION public.processos_pf_status_mudou()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(OLD.status, '') <> '' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_mudou_em := now();
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS processos_pf_status_mudou ON public.processos_pf;
CREATE TRIGGER processos_pf_status_mudou BEFORE UPDATE ON public.processos_pf
  FOR EACH ROW EXECUTE FUNCTION public.processos_pf_status_mudou();

-- 2) aviso enviado e ainda não aberto, por aparelho: o robô manda de novo 1 vez por dia, até 3 vezes
ALTER TABLE public.push_acompanhamento ADD COLUMN IF NOT EXISTS aviso_pendente jsonb;
ALTER TABLE public.push_acompanhamento ADD COLUMN IF NOT EXISTS aviso_enviado_em timestamptz;
ALTER TABLE public.push_acompanhamento ADD COLUMN IF NOT EXISTS aviso_reenvios int NOT NULL DEFAULT 0;

-- o cliente tocou no aviso ou abriu a carteira / o acompanhamento: não manda mais
CREATE OR REPLACE FUNCTION public.marcar_aviso_aberto(p_endpoint text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.push_acompanhamento SET aviso_pendente = NULL WHERE endpoint = p_endpoint AND aviso_pendente IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.marcar_aviso_aberto(text) FROM public;
GRANT EXECUTE ON FUNCTION public.marcar_aviso_aberto(text) TO anon, authenticated;

-- 3) carteira: processos deferidos nos últimos 2 dias (cliente com o mesmo CPF em Clientes Armas)
CREATE OR REPLACE FUNCTION public.get_carteira_v2(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE result JSON; acomp uuid;
BEGIN
  SELECT dc.id INTO acomp FROM public.carteira_clientes c, public.declaracao_clientes dc
  WHERE c.id = p_id
    AND NULLIF(regexp_replace(COALESCE(c.cpf, ''), '\D', '', 'g'), '') IS NOT NULL
    AND regexp_replace(COALESCE(dc.cpf, ''), '\D', '', 'g') = regexp_replace(c.cpf, '\D', '', 'g')
  LIMIT 1;
  SELECT json_build_object(
    'id',   c.id, 'nome', c.nome, 'cpf',  c.cpf,
    'acompanhamento', acomp,
    'deferidos', COALESCE((
      SELECT json_agg(json_build_object('id', p.id, 'servico', p.servico, 'quando', p.status_mudou_em) ORDER BY p.status_mudou_em DESC)
      FROM public.processos_pf p
      WHERE acomp IS NOT NULL AND p.cliente_id = acomp AND p.status ILIKE 'deferid%'
        AND p.status_mudou_em > now() - interval '2 days' AND COALESCE(p.descricao, '') NOT ILIKE '%rascunho%'
    ), '[]'::json),
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
