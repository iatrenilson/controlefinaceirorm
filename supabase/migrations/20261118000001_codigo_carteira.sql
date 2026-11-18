-- Link da Carteira Digital com o primeiro nome do cliente: /carteira/carlos. Nome repetido ganha número:
-- carlos, carlos2, carlos3... (o usuário pediu "Carlos 2, Carlos 3"). O link antigo (/carteira/<id>) continua valendo.
-- gerar_codigo_carteira é SECURITY DEFINER: com RLS o moderador não veria os códigos dos outros e repetiria um já usado.
ALTER TABLE public.carteira_clientes ADD COLUMN IF NOT EXISTS codigo text;
CREATE UNIQUE INDEX IF NOT EXISTS carteira_clientes_codigo_key ON public.carteira_clientes (codigo);

CREATE OR REPLACE FUNCTION public.gerar_codigo_carteira(p_nome text, p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; cand text; n int := 1;
BEGIN
  -- primeiro nome, minúsculo e sem acento (ignora o que está entre parênteses)
  SELECT w INTO base
  FROM regexp_split_to_table(
         lower(translate(btrim(regexp_replace(COALESCE(p_nome, ''), '\([^)]*\)', ' ', 'g')),
               'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
               'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
         '[^a-z]+') WITH ORDINALITY AS t(w, ord)
  WHERE w <> '' ORDER BY ord LIMIT 1;
  IF base IS NULL OR base = '' THEN base := 'cliente'; END IF;
  LOOP
    cand := base || CASE WHEN n = 1 THEN '' ELSE n::text END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.carteira_clientes WHERE codigo = cand AND id IS DISTINCT FROM p_id);
    n := n + 1;
  END LOOP;
  RETURN cand;
END; $$;

-- carteira nova já nasce com o código
CREATE OR REPLACE FUNCTION public.carteira_clientes_codigo_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := public.gerar_codigo_carteira(NEW.nome, NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS carteira_clientes_codigo ON public.carteira_clientes;
CREATE TRIGGER carteira_clientes_codigo BEFORE INSERT ON public.carteira_clientes
  FOR EACH ROW EXECUTE FUNCTION public.carteira_clientes_codigo_trg();

-- carteiras que já existem (as mais antigas ficam com o nome sem número)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, nome FROM public.carteira_clientes WHERE codigo IS NULL ORDER BY created_at, id LOOP
    UPDATE public.carteira_clientes SET codigo = public.gerar_codigo_carteira(r.nome, r.id) WHERE id = r.id;
  END LOOP;
END $$;

-- Página pública: aceita o código (primeiro nome) ou o id antigo
CREATE OR REPLACE FUNCTION public.get_carteira_ref(p_ref text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  SELECT c.id INTO cid FROM public.carteira_clientes c
  WHERE c.codigo = lower(btrim(p_ref)) OR c.id::text = lower(btrim(p_ref)) LIMIT 1;
  IF cid IS NULL THEN RETURN NULL; END IF;
  RETURN public.get_carteira_v2(cid);
END; $$;
REVOKE ALL ON FUNCTION public.get_carteira_ref(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_carteira_ref(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.gerar_codigo_carteira(text, uuid) FROM public, anon, authenticated;

NOTIFY pgrst, 'reload schema';
