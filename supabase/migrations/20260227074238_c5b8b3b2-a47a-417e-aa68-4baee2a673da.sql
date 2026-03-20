
-- Add origem column to wallet_transactions to distinguish between modules
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'emprestimos';

-- Update existing Delay Esportivo transactions based on description
UPDATE public.wallet_transactions 
SET origem = 'delay' 
WHERE descricao IN ('Depósito na Caixa', 'Retirada da Caixa');
