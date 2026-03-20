
-- Add sort_order column for manual drag-and-drop ordering
ALTER TABLE public.delay_clientes ADD COLUMN sort_order integer DEFAULT 0;

-- Initialize sort_order based on current order (alphabetical by casa then nome)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY casa, nome) as rn
  FROM public.delay_clientes
)
UPDATE public.delay_clientes
SET sort_order = ordered.rn
FROM ordered
WHERE public.delay_clientes.id = ordered.id;
