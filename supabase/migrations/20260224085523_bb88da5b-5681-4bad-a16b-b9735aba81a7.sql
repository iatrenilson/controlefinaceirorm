
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ponto_referencia text;
