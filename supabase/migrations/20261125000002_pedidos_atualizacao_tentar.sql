-- Pedido de atualização (2026-11-25, o usuário pediu): deu erro, o cliente pode tentar de novo na hora (antes ficava
-- preso por 30 minutos). Os 30 minutos valem só depois de uma consulta que deu certo. Devolve também quantos erros
-- seguidos houve (desde a última consulta certa, nas últimas 24 h): mais de 2, a página avisa que o escritório vai
-- consultar, mas continua deixando tentar.
CREATE OR REPLACE FUNCTION public.pedir_atualizacao(p_ref text, p_so_ver boolean DEFAULT false)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; ult public.pedidos_atualizacao%ROWTYPE; erros int;
BEGIN
  SELECT c.id INTO cid FROM public.declaracao_clientes c
  WHERE c.codigo_acompanhamento = lower(btrim(p_ref)) OR c.id::text = lower(btrim(p_ref)) LIMIT 1;
  IF cid IS NULL THEN RETURN NULL; END IF;

  UPDATE public.pedidos_atualizacao SET status = 'erro', mensagem = 'sem resposta', atualizado_em = now()
  WHERE cliente_id = cid AND status IN ('pendente', 'rodando') AND pedido_em < now() - interval '10 minutes';

  SELECT count(*) INTO erros FROM public.pedidos_atualizacao p
  WHERE p.cliente_id = cid AND p.status = 'erro' AND p.pedido_em > now() - interval '24 hours'
    AND p.pedido_em > COALESCE((SELECT max(f.pedido_em) FROM public.pedidos_atualizacao f
                                WHERE f.cliente_id = cid AND f.status = 'feito'), '-infinity');

  SELECT * INTO ult FROM public.pedidos_atualizacao WHERE cliente_id = cid ORDER BY pedido_em DESC LIMIT 1;
  IF p_so_ver OR (ult.id IS NOT NULL AND (ult.status IN ('pendente', 'rodando')
                  OR (ult.status = 'feito' AND ult.pedido_em > now() - interval '30 minutes'))) THEN
    IF ult.id IS NULL THEN RETURN json_build_object('status', 'nenhum', 'erros', erros); END IF;
    RETURN json_build_object('status', ult.status, 'pedido_em', ult.pedido_em, 'atualizado_em', ult.atualizado_em,
                             'mensagem', ult.mensagem, 'novo', false, 'erros', erros);
  END IF;

  INSERT INTO public.pedidos_atualizacao (cliente_id) VALUES (cid) RETURNING * INTO ult;
  RETURN json_build_object('status', 'pendente', 'pedido_em', ult.pedido_em, 'atualizado_em', ult.atualizado_em,
                           'mensagem', '', 'novo', true, 'erros', erros);
END; $$;
REVOKE ALL ON FUNCTION public.pedir_atualizacao(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.pedir_atualizacao(text, boolean) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
