-- Hora do servidor nos sinais e na fila (2026-11-28): o notebook "servidor" estava com o relógio 1 h atrasado (fuso
-- errado), gravava visto_em / atualizado_em 1 h no passado e o sistema achava que nenhum computador estava ligado.
-- Agora quem grava a hora é o banco, qualquer que seja o relógio do computador.
CREATE OR REPLACE FUNCTION public.hora_do_servidor_visto()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.visto_em := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS passarinho_sinal_hora ON public.passarinho_sinal;
CREATE TRIGGER passarinho_sinal_hora BEFORE INSERT OR UPDATE ON public.passarinho_sinal
  FOR EACH ROW EXECUTE FUNCTION public.hora_do_servidor_visto();
DROP TRIGGER IF EXISTS passarinho_computadores_hora ON public.passarinho_computadores;
CREATE TRIGGER passarinho_computadores_hora BEFORE INSERT OR UPDATE ON public.passarinho_computadores
  FOR EACH ROW EXECUTE FUNCTION public.hora_do_servidor_visto();

-- pedidos: atualizado_em sempre na hora do banco quando o status ou a mensagem mudam
CREATE OR REPLACE FUNCTION public.hora_do_servidor_pedido()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.mensagem IS DISTINCT FROM OLD.mensagem THEN NEW.atualizado_em := now(); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS pedidos_atualizacao_hora ON public.pedidos_atualizacao;
CREATE TRIGGER pedidos_atualizacao_hora BEFORE UPDATE ON public.pedidos_atualizacao
  FOR EACH ROW EXECUTE FUNCTION public.hora_do_servidor_pedido();
