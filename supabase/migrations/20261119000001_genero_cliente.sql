-- Gênero do cliente (Clientes Armas): a extensão Passarinho usa no Sinarm CAC / Portal PF em vez de adivinhar pelo nome
ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS genero text;
NOTIFY pgrst, 'reload schema';
