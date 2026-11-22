-- Todo cliente de Clientes Armas tem Carteira Digital (o usuário pediu, 2026-11-22: "todos clientes já é pra ter
-- carteira assim que eu cadastrar no sistema"). A carteira é ligada ao cliente pelo CPF (como já era).
-- Cria ao cadastrar e ao preencher o CPF depois; nunca duplica (mesmo CPF já com carteira não cria outra).
CREATE OR REPLACE FUNCTION public.criar_carteira_do_cliente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE doc text := regexp_replace(COALESCE(NEW.cpf, ''), '\D', '', 'g');
BEGIN
  IF doc = '' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.carteira_clientes k WHERE regexp_replace(COALESCE(k.cpf, ''), '\D', '', 'g') = doc) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.carteira_clientes (nome, cpf, telefone, owner_id)
  VALUES (NEW.nome, NEW.cpf, NULLIF(NEW.telefone, ''), NEW.owner_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS declaracao_clientes_carteira ON public.declaracao_clientes;
CREATE TRIGGER declaracao_clientes_carteira AFTER INSERT OR UPDATE OF cpf ON public.declaracao_clientes
  FOR EACH ROW EXECUTE FUNCTION public.criar_carteira_do_cliente();

-- clientes que já existem sem carteira (os mais antigos primeiro: ficam com o nome sem número no link)
INSERT INTO public.carteira_clientes (nome, cpf, telefone, owner_id)
SELECT d.nome, d.cpf, NULLIF(d.telefone, ''), d.owner_id
FROM public.declaracao_clientes d
WHERE NULLIF(regexp_replace(COALESCE(d.cpf, ''), '\D', '', 'g'), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.carteira_clientes k
                  WHERE regexp_replace(COALESCE(k.cpf, ''), '\D', '', 'g') = regexp_replace(d.cpf, '\D', '', 'g'))
ORDER BY d.created_at;
NOTIFY pgrst, 'reload schema';
