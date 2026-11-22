-- Link de acompanhamento vira o link da carteira (o usuário pediu, 2026-11-22): get_acompanhamento_ref devolve também
-- a carteira do cliente (mesmo CPF; o código do link, ou o id se não tiver código). A página redireciona para ela.
CREATE OR REPLACE FUNCTION public.get_acompanhamento_ref(p_ref text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE cid uuid; result json; cart text;
BEGIN
  SELECT c.id INTO cid FROM public.declaracao_clientes c
  WHERE c.codigo_acompanhamento = lower(btrim(p_ref)) OR c.id::text = lower(btrim(p_ref)) LIMIT 1;
  IF cid IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(NULLIF(k.codigo, ''), k.id::text) INTO cart
  FROM public.declaracao_clientes d JOIN public.carteira_clientes k
    ON NULLIF(regexp_replace(COALESCE(k.cpf, ''), '\D', '', 'g'), '') IS NOT NULL
   AND regexp_replace(COALESCE(k.cpf, ''), '\D', '', 'g') = regexp_replace(COALESCE(d.cpf, ''), '\D', '', 'g')
  WHERE d.id = cid LIMIT 1;
  SELECT (public.get_acompanhamento(cid)::jsonb || jsonb_build_object('id', cid, 'carteira', cart))::json INTO result;
  RETURN result;
END; $function$;
NOTIFY pgrst, 'reload schema';
