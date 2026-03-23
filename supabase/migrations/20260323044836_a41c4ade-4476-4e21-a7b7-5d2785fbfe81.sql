
ALTER TABLE public.delay_clientes
ADD COLUMN link_visualizacao uuid REFERENCES public.delay_share_links(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.delay_clientes.link_visualizacao IS 'ID do link de visualização ao qual este cliente está atribuído. Se null, aparece apenas no link admin.';
