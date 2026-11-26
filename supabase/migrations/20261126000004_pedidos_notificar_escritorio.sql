-- Aviso ao escritório no sino do site quando o cliente pede a consulta pelo celular (2026-11-26, o usuário pediu):
-- uma notificação só por pedido, que muda de estado — "na fila" → "consultando" → "consulta feita" (com o status de
-- cada processo) ou "não deu para consultar". A cada mudança ela volta como não lida. Vai para o dono do cliente.
ALTER TABLE public.pedidos_atualizacao ADD COLUMN IF NOT EXISTS notificacao_id uuid;

CREATE OR REPLACE FUNCTION public.pedidos_atualizacao_notificar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cli record; v_titulo text; v_msg text; resumo text; nid uuid;
BEGIN
  SELECT c.nome, c.owner_id INTO cli FROM public.declaracao_clientes c WHERE c.id = NEW.cliente_id;
  IF cli.owner_id IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (titulo, mensagem, created_by, target_user_id)
    VALUES ('📲 ' || cli.nome || ' pediu a consulta do processo', '⏳ Na fila, aguardando a consulta no Portal PF.',
            cli.owner_id, cli.owner_id)
    RETURNING id INTO nid;
    UPDATE public.pedidos_atualizacao SET notificacao_id = nid WHERE id = NEW.id;
    RETURN NULL;
  END IF;

  IF NEW.notificacao_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  IF NEW.status = 'rodando' THEN
    v_titulo := '🔄 Consultando: ' || cli.nome;
    v_msg := 'A Passarinho está consultando o processo no Portal PF.';
  ELSIF NEW.status = 'feito' THEN
    SELECT string_agg(coalesce(nullif(p.servico, ''), 'Processo') || ': ' || p.status, ' · ' ORDER BY p.data_solicitacao DESC)
      INTO resumo
      FROM (SELECT * FROM public.processos_pf WHERE cliente_id = NEW.cliente_id AND descricao !~* 'rascunho' AND status <> ''
            ORDER BY consultado_em DESC LIMIT 4) p;
    v_titulo := '✅ Consulta feita: ' || cli.nome;
    v_msg := coalesce(resumo, 'Nenhuma solicitação na Polícia Federal.');
  ELSIF NEW.status = 'erro' THEN
    v_titulo := '⚠️ Não deu para consultar: ' || cli.nome;
    v_msg := 'Motivo: ' || coalesce(nullif(NEW.mensagem, ''), 'desconhecido') || '. O cliente pode tentar de novo.';
  ELSE
    RETURN NULL;
  END IF;
  UPDATE public.notifications SET titulo = v_titulo, mensagem = v_msg, created_at = now() WHERE id = NEW.notificacao_id;
  -- volta como não lida
  DELETE FROM public.user_notifications WHERE notification_id = NEW.notificacao_id AND user_id = cli.owner_id;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL; -- nunca atrapalha o pedido
END; $$;
REVOKE ALL ON FUNCTION public.pedidos_atualizacao_notificar() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS pedidos_atualizacao_notificar_ins ON public.pedidos_atualizacao;
CREATE TRIGGER pedidos_atualizacao_notificar_ins AFTER INSERT ON public.pedidos_atualizacao
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_atualizacao_notificar();
DROP TRIGGER IF EXISTS pedidos_atualizacao_notificar_upd ON public.pedidos_atualizacao;
CREATE TRIGGER pedidos_atualizacao_notificar_upd AFTER UPDATE OF status ON public.pedidos_atualizacao
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_atualizacao_notificar();

NOTIFY pgrst, 'reload schema';
