-- Sinal de "Passarinho ligada" (2026-11-26, o usuário pediu): a extensão grava a hora a cada 30 s (com o site da RW
-- aberto e logado). A página de acompanhamento usa para saber na hora se o computador do escritório está ligado: sem
-- sinal no último minuto e meio, mostra direto "consulta marcada" em vez de ficar 2 minutos rodando.
CREATE TABLE IF NOT EXISTS public.passarinho_sinal (
  id       int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  visto_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.passarinho_sinal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS passarinho_sinal_admin ON public.passarinho_sinal;
CREATE POLICY passarinho_sinal_admin ON public.passarinho_sinal FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- mesma função de antes, devolvendo também "online"
CREATE OR REPLACE FUNCTION public.pedir_atualizacao(p_ref text, p_so_ver boolean DEFAULT false)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; ult public.pedidos_atualizacao%ROWTYPE; erros int; online boolean;
BEGIN
  SELECT c.id INTO cid FROM public.declaracao_clientes c
  WHERE c.codigo_acompanhamento = lower(btrim(p_ref)) OR c.id::text = lower(btrim(p_ref)) LIMIT 1;
  IF cid IS NULL THEN RETURN NULL; END IF;

  online := EXISTS (SELECT 1 FROM public.passarinho_sinal WHERE visto_em > now() - interval '90 seconds');

  UPDATE public.pedidos_atualizacao SET status = 'erro', mensagem = 'sem resposta', atualizado_em = now()
  WHERE cliente_id = cid AND ((status = 'rodando' AND atualizado_em < now() - interval '10 minutes')
                           OR (status = 'pendente' AND pedido_em < now() - interval '3 days'));

  SELECT count(*) INTO erros FROM public.pedidos_atualizacao p
  WHERE p.cliente_id = cid AND p.status = 'erro' AND p.pedido_em > now() - interval '24 hours'
    AND p.pedido_em > COALESCE((SELECT max(f.pedido_em) FROM public.pedidos_atualizacao f
                                WHERE f.cliente_id = cid AND f.status = 'feito'), '-infinity');

  SELECT * INTO ult FROM public.pedidos_atualizacao WHERE cliente_id = cid ORDER BY pedido_em DESC LIMIT 1;
  IF p_so_ver OR (ult.id IS NOT NULL AND (ult.status IN ('pendente', 'rodando')
                  OR (ult.status = 'feito' AND ult.pedido_em > now() - interval '30 minutes'))) THEN
    IF ult.id IS NULL THEN RETURN json_build_object('status', 'nenhum', 'erros', erros, 'online', online); END IF;
    RETURN json_build_object('status', ult.status, 'pedido_em', ult.pedido_em, 'atualizado_em', ult.atualizado_em,
                             'mensagem', ult.mensagem, 'novo', false, 'erros', erros, 'online', online);
  END IF;

  INSERT INTO public.pedidos_atualizacao (cliente_id) VALUES (cid) RETURNING * INTO ult;
  RETURN json_build_object('status', 'pendente', 'pedido_em', ult.pedido_em, 'atualizado_em', ult.atualizado_em,
                           'mensagem', '', 'novo', true, 'erros', erros, 'online', online);
END; $$;
REVOKE ALL ON FUNCTION public.pedir_atualizacao(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.pedir_atualizacao(text, boolean) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
