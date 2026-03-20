
-- Add 'tipo' column to delay_share_links to distinguish editor vs viewer links
ALTER TABLE public.delay_share_links ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'editor';
