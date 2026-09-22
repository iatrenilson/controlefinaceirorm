DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.carteira_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    telefone TEXT,
    cpf TEXT,
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE public.carteira_clientes ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_clientes' AND policyname='cc_sel') THEN
    CREATE POLICY "cc_sel" ON public.carteira_clientes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND owner_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_clientes' AND policyname='cc_ins') THEN
    CREATE POLICY "cc_ins" ON public.carteira_clientes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND owner_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_clientes' AND policyname='cc_upd') THEN
    CREATE POLICY "cc_upd" ON public.carteira_clientes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND owner_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_clientes' AND policyname='cc_del') THEN
    CREATE POLICY "cc_del" ON public.carteira_clientes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND owner_id=auth.uid()));
  END IF;

  CREATE TABLE IF NOT EXISTS public.carteira_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carteira_cliente_id UUID REFERENCES public.carteira_clientes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    arquivo_path TEXT,
    arquivo_nome TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(carteira_cliente_id, tipo)
  );
  ALTER TABLE public.carteira_docs ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_docs' AND policyname='cd_sel') THEN
    CREATE POLICY "cd_sel" ON public.carteira_docs FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.carteira_clientes c WHERE c.id=carteira_cliente_id AND (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND c.owner_id=auth.uid()))));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_docs' AND policyname='cd_ins') THEN
    CREATE POLICY "cd_ins" ON public.carteira_docs FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.carteira_clientes c WHERE c.id=carteira_cliente_id AND (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND c.owner_id=auth.uid()))));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_docs' AND policyname='cd_upd') THEN
    CREATE POLICY "cd_upd" ON public.carteira_docs FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.carteira_clientes c WHERE c.id=carteira_cliente_id AND (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND c.owner_id=auth.uid()))));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_docs' AND policyname='cd_del') THEN
    CREATE POLICY "cd_del" ON public.carteira_docs FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM public.carteira_clientes c WHERE c.id=carteira_cliente_id AND (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND c.owner_id=auth.uid()))));
  END IF;
  PERFORM pg_notify('pgrst','reload schema');
END $$;

CREATE OR REPLACE FUNCTION public.get_carteira_v2(p_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'id', c.id, 'nome', c.nome,
    'docs', COALESCE((
      SELECT json_agg(json_build_object('tipo',d.tipo,'arquivo_path',d.arquivo_path,'arquivo_nome',d.arquivo_nome) ORDER BY d.tipo)
      FROM public.carteira_docs d WHERE d.carteira_cliente_id = c.id
    ),'[]'::json)
  ) INTO result FROM public.carteira_clientes c WHERE c.id = p_id;
  RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_carteira_v2(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_carteira_v2(UUID) TO authenticated;
