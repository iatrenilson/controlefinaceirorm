-- Link curto do acompanhamento: /acompanhamento/<iniciais do nome>, ex.: "Renilson Martins Costa" -> rmc.
-- (gerar_codigo é SECURITY DEFINER: com RLS o moderador não veria os códigos dos outros e repetiria um já usado)
-- Iniciais repetidas ganham número: rmc1, rmc2... O link antigo (/acompanhamento/<id>) continua funcionando.
ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS codigo_acompanhamento text;
CREATE UNIQUE INDEX IF NOT EXISTS declaracao_clientes_codigo_acompanhamento_key
  ON public.declaracao_clientes (codigo_acompanhamento);

CREATE OR REPLACE FUNCTION public.gerar_codigo_acompanhamento(p_nome text, p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; cand text; n int := 0;
BEGIN
  -- iniciais de cada palavra (sem acento, sem o que está entre parênteses e sem "de/da/do/dos/das/e")
  SELECT string_agg(left(w, 1), '' ORDER BY ord) INTO base
  FROM regexp_split_to_table(
         lower(translate(btrim(regexp_replace(COALESCE(p_nome, ''), '\([^)]*\)', ' ', 'g')),
               'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
               'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
         '[^a-z]+') WITH ORDINALITY AS t(w, ord)
  WHERE w <> '' AND w NOT IN ('de', 'da', 'do', 'das', 'dos', 'e');
  IF base IS NULL OR base = '' THEN base := 'cliente'; END IF;
  LOOP
    cand := base || CASE WHEN n = 0 THEN '' ELSE n::text END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.declaracao_clientes
                          WHERE codigo_acompanhamento = cand AND id IS DISTINCT FROM p_id);
    n := n + 1;
  END LOOP;
  RETURN cand;
END; $$;

-- cliente novo já nasce com o código
CREATE OR REPLACE FUNCTION public.declaracao_clientes_codigo_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.codigo_acompanhamento IS NULL OR NEW.codigo_acompanhamento = '' THEN
    NEW.codigo_acompanhamento := public.gerar_codigo_acompanhamento(NEW.nome, NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS declaracao_clientes_codigo ON public.declaracao_clientes;
CREATE TRIGGER declaracao_clientes_codigo BEFORE INSERT ON public.declaracao_clientes
  FOR EACH ROW EXECUTE FUNCTION public.declaracao_clientes_codigo_trg();

-- clientes que já existem (os mais antigos ficam com as iniciais sem número)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, nome FROM public.declaracao_clientes WHERE codigo_acompanhamento IS NULL ORDER BY created_at, id LOOP
    UPDATE public.declaracao_clientes SET codigo_acompanhamento = public.gerar_codigo_acompanhamento(r.nome, r.id)
    WHERE id = r.id;
  END LOOP;
END $$;

-- Página pública: aceita o código curto ou o id antigo e devolve também o id (para os avisos no celular)
CREATE OR REPLACE FUNCTION public.get_acompanhamento_ref(p_ref text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; result json;
BEGIN
  SELECT c.id INTO cid FROM public.declaracao_clientes c
  WHERE c.codigo_acompanhamento = lower(btrim(p_ref)) OR c.id::text = lower(btrim(p_ref)) LIMIT 1;
  IF cid IS NULL THEN RETURN NULL; END IF;
  SELECT (public.get_acompanhamento(cid)::jsonb || jsonb_build_object('id', cid))::json INTO result;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.get_acompanhamento_ref(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_acompanhamento_ref(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.gerar_codigo_acompanhamento(text, uuid) FROM public, anon, authenticated;

NOTIFY pgrst, 'reload schema';
