-- Atualizar o processo pelo celular do cliente (2026-11-25, o usuário pediu): ao abrir "Acompanhar processo" na
-- Carteira Digital, a página pede uma atualização. A Passarinho no computador do escritório confere os pedidos a cada
-- 30 s, entra no Portal PF com o gov.br do cliente, lê "Minhas solicitações", grava em processos_pf e marca o pedido.
-- A senha gov nunca sai do sistema do escritório; o celular só cria o pedido.
CREATE TABLE IF NOT EXISTS public.pedidos_atualizacao (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid NOT NULL REFERENCES public.declaracao_clientes(id) ON DELETE CASCADE,
  pedido_em     timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'rodando', 'feito', 'erro')),
  mensagem      text NOT NULL DEFAULT '',
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedidos_atualizacao_cliente ON public.pedidos_atualizacao (cliente_id, pedido_em DESC);
CREATE INDEX IF NOT EXISTS pedidos_atualizacao_status ON public.pedidos_atualizacao (status, pedido_em);
ALTER TABLE public.pedidos_atualizacao ENABLE ROW LEVEL SECURITY;

-- mesma regra de processos_pf: admin vê tudo; moderador só os clientes dele
DROP POLICY IF EXISTS pedidos_atualizacao_dono ON public.pedidos_atualizacao;
CREATE POLICY pedidos_atualizacao_dono ON public.pedidos_atualizacao FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.declaracao_clientes c WHERE c.id = pedidos_atualizacao.cliente_id AND c.owner_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.declaracao_clientes c WHERE c.id = pedidos_atualizacao.cliente_id AND c.owner_id = auth.uid()));

-- Página pública: cria o pedido (no máximo um a cada 30 minutos por cliente) ou, com p_so_ver, só diz como está.
-- Pedido sem resposta em 10 minutos (computador do escritório desligado) vira erro.
CREATE OR REPLACE FUNCTION public.pedir_atualizacao(p_ref text, p_so_ver boolean DEFAULT false)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; ult public.pedidos_atualizacao%ROWTYPE;
BEGIN
  SELECT c.id INTO cid FROM public.declaracao_clientes c
  WHERE c.codigo_acompanhamento = lower(btrim(p_ref)) OR c.id::text = lower(btrim(p_ref)) LIMIT 1;
  IF cid IS NULL THEN RETURN NULL; END IF;

  UPDATE public.pedidos_atualizacao SET status = 'erro', mensagem = 'sem resposta', atualizado_em = now()
  WHERE cliente_id = cid AND status IN ('pendente', 'rodando') AND pedido_em < now() - interval '10 minutes';

  SELECT * INTO ult FROM public.pedidos_atualizacao WHERE cliente_id = cid ORDER BY pedido_em DESC LIMIT 1;
  IF p_so_ver OR (ult.id IS NOT NULL AND (ult.status IN ('pendente', 'rodando') OR ult.pedido_em > now() - interval '30 minutes')) THEN
    IF ult.id IS NULL THEN RETURN json_build_object('status', 'nenhum'); END IF;
    RETURN json_build_object('status', ult.status, 'pedido_em', ult.pedido_em, 'atualizado_em', ult.atualizado_em,
                             'mensagem', ult.mensagem, 'novo', false);
  END IF;

  INSERT INTO public.pedidos_atualizacao (cliente_id) VALUES (cid) RETURNING * INTO ult;
  RETURN json_build_object('status', 'pendente', 'pedido_em', ult.pedido_em, 'atualizado_em', ult.atualizado_em,
                           'mensagem', '', 'novo', true);
END; $$;
REVOKE ALL ON FUNCTION public.pedir_atualizacao(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.pedir_atualizacao(text, boolean) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
