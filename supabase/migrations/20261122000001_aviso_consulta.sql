-- Aviso ao cliente a cada consulta do escritório (o usuário pediu, 2026-11-22): "seu processo foi acompanhado".
-- avisado_consulta_ts: quando este aparelho recebeu o último aviso de consulta (no máximo 1 a cada 6 horas: a extensão
-- regrava a lista a cada 10 minutos enquanto ela fica aberta).
ALTER TABLE public.push_acompanhamento ADD COLUMN IF NOT EXISTS avisado_consulta_ts timestamptz;

-- o robô também é chamado quando a extensão grava uma consulta (antes, só quando o status mudava)
DROP TRIGGER IF EXISTS processos_pf_disparar ON public.processos_pf;
CREATE TRIGGER processos_pf_disparar AFTER INSERT OR UPDATE OF status, consultado_em ON public.processos_pf
  FOR EACH ROW EXECUTE FUNCTION public.processos_pf_disparar();

NOTIFY pgrst, 'reload schema';
