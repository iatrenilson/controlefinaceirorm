-- Tabela de configuração compartilhada entre todos os usuários do laudo
CREATE TABLE IF NOT EXISTS public.laudo_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- Linha inicial para o último número
INSERT INTO public.laudo_config (key, value)
VALUES ('ultimo_numero', '')
ON CONFLICT (key) DO NOTHING;

-- RLS: leitura e escrita pública (não exige autenticação)
ALTER TABLE public.laudo_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "laudo_config_select" ON public.laudo_config;
CREATE POLICY "laudo_config_select" ON public.laudo_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "laudo_config_update" ON public.laudo_config;
CREATE POLICY "laudo_config_update" ON public.laudo_config
  FOR UPDATE USING (true);

-- RPC: lê o último número (SECURITY DEFINER ignora RLS, retorno seguro)
CREATE OR REPLACE FUNCTION public.get_laudo_ultimo_numero()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.laudo_config WHERE key = 'ultimo_numero';
$$;

-- RPC: salva o último número
CREATE OR REPLACE FUNCTION public.set_laudo_ultimo_numero(p_numero TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.laudo_config (key, value)
  VALUES ('ultimo_numero', p_numero)
  ON CONFLICT (key) DO UPDATE SET value = p_numero;
$$;

GRANT EXECUTE ON FUNCTION public.get_laudo_ultimo_numero() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_laudo_ultimo_numero(TEXT) TO anon, authenticated;
