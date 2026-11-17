-- Avisos no celular do link de acompanhamento (/acompanhamento/<id do cliente>): o cliente ativa no link e recebe
-- notificação quando o status de um processo dele muda (Sinarm CAC ou Portal PF). Quem envia é o GitHub
-- (.github/workflows/avisos-acompanhamento.yml, scripts/avisos-acompanhamento.mjs) com a chave secreta.
CREATE TABLE IF NOT EXISTS public.push_acompanhamento (
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.declaracao_clientes(id) ON DELETE CASCADE,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (endpoint, cliente_id)
);
-- sem política: ninguém lê ou grava direto; só pelas funções abaixo e pela chave secreta do GitHub
ALTER TABLE public.push_acompanhamento ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.salvar_push_acompanhamento(p_cliente uuid, p_endpoint text, p_p256dh text, p_auth text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.declaracao_clientes WHERE id = p_cliente) THEN RAISE EXCEPTION 'cliente'; END IF;
  IF coalesce(p_endpoint, '') !~ '^https://' THEN RAISE EXCEPTION 'endpoint'; END IF;
  INSERT INTO public.push_acompanhamento (endpoint, p256dh, auth, cliente_id)
  VALUES (p_endpoint, p_p256dh, p_auth, p_cliente)
  ON CONFLICT (endpoint, cliente_id) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth;
END; $$;

CREATE OR REPLACE FUNCTION public.remover_push_acompanhamento(p_cliente uuid, p_endpoint text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.push_acompanhamento WHERE cliente_id = p_cliente AND endpoint = p_endpoint;
$$;

REVOKE ALL ON FUNCTION public.salvar_push_acompanhamento(uuid, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.remover_push_acompanhamento(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.salvar_push_acompanhamento(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remover_push_acompanhamento(uuid, text) TO anon, authenticated;

-- Último status já avisado de cada processo: o aviso sai quando status <> avisado_status.
-- Os que já existem contam como avisados (sem uma rajada de avisos de coisa antiga).
ALTER TABLE public.processos_pf ADD COLUMN IF NOT EXISTS avisado_status text;
UPDATE public.processos_pf SET avisado_status = status WHERE avisado_status IS NULL;

NOTIFY pgrst, 'reload schema';
