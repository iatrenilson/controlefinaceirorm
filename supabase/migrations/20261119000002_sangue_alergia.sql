-- Clientes Armas: tipo sanguíneo e alergia (sim/não + quais) no cadastro do cliente
ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS tipo_sanguineo text;
ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS alergia text;
ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS alergias text;
NOTIFY pgrst, 'reload schema';
