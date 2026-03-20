
ALTER TABLE public.financeiro
ADD COLUMN parcelas integer DEFAULT NULL,
ADD COLUMN parcela_atual integer DEFAULT NULL;
