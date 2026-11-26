-- Aviso no celular quando a consulta que o cliente pediu e ficou esperando é feita (2026-11-26, o usuário pediu).
-- avisado: o robô (scripts/avisos-acompanhamento.mjs) já tratou este pedido. Os feitos até agora ficam como avisados.
ALTER TABLE public.pedidos_atualizacao ADD COLUMN IF NOT EXISTS avisado boolean NOT NULL DEFAULT false;
UPDATE public.pedidos_atualizacao SET avisado = true WHERE status <> 'pendente' AND status <> 'rodando';

-- pedido que ficou "feito": chama o robô na hora (o mesmo disparo do status novo; nunca atrapalha a gravação)
DROP TRIGGER IF EXISTS pedidos_atualizacao_disparar ON public.pedidos_atualizacao;
CREATE TRIGGER pedidos_atualizacao_disparar AFTER UPDATE OF status ON public.pedidos_atualizacao
  FOR EACH ROW WHEN (NEW.status = 'feito' AND OLD.status IS DISTINCT FROM 'feito')
  EXECUTE FUNCTION public.processos_pf_disparar();

NOTIFY pgrst, 'reload schema';
