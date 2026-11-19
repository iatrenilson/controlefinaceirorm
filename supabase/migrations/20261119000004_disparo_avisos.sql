-- Avisos de processo sem o atraso do relógio do GitHub (o usuário pediu, 2026-11-19): o próprio banco chama o robô
-- (.github/workflows/avisos-acompanhamento.yml, "workflow_dispatch") assim que a extensão grava um status novo, e de hora
-- em hora para os lembretes. A chave do GitHub fica no cofre (Vault) com o nome github_dispatch_token, guardada pelo
-- usuário no painel do Supabase; sem ela, nada é chamado.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- última chamada: a extensão grava a lista inteira de uma vez; uma chamada a cada 2 minutos basta
CREATE TABLE IF NOT EXISTS public.disparo_avisos (id int PRIMARY KEY DEFAULT 1, em timestamptz, CHECK (id = 1));
ALTER TABLE public.disparo_avisos ENABLE ROW LEVEL SECURITY;
INSERT INTO public.disparo_avisos (id, em) VALUES (1, NULL) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.disparar_avisos(p_forcar boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tok text; ultima timestamptz;
BEGIN
  SELECT decrypted_secret INTO tok FROM vault.decrypted_secrets WHERE name = 'github_dispatch_token' LIMIT 1;
  IF tok IS NULL OR tok = '' THEN RETURN; END IF;
  SELECT em INTO ultima FROM public.disparo_avisos WHERE id = 1 FOR UPDATE;
  IF NOT p_forcar AND ultima IS NOT NULL AND ultima > now() - interval '2 minutes' THEN RETURN; END IF;
  UPDATE public.disparo_avisos SET em = now() WHERE id = 1;
  PERFORM net.http_post(
    url := 'https://api.github.com/repos/iatrenilson/controlefinaceirorm/actions/workflows/avisos-acompanhamento.yml/dispatches',
    body := '{"ref":"main"}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || tok, 'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28', 'User-Agent', 'passarinho-avisos', 'Content-Type', 'application/json'));
END; $$;
REVOKE ALL ON FUNCTION public.disparar_avisos(boolean) FROM public, anon, authenticated;

-- status novo gravado pela extensão: chama o robô na hora (nunca atrapalha a gravação)
CREATE OR REPLACE FUNCTION public.processos_pf_disparar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN PERFORM public.disparar_avisos(false); EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS processos_pf_disparar ON public.processos_pf;
CREATE TRIGGER processos_pf_disparar AFTER INSERT OR UPDATE OF status ON public.processos_pf
  FOR EACH ROW WHEN (NEW.status IS DISTINCT FROM NEW.avisado_status) EXECUTE FUNCTION public.processos_pf_disparar();

-- de hora em hora: lembretes de quem não abriu o aviso (e qualquer coisa que tenha escapado)
SELECT cron.unschedule('avisos-processo') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'avisos-processo');
SELECT cron.schedule('avisos-processo', '7 * * * *', $$SELECT public.disparar_avisos(true)$$);
