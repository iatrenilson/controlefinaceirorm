-- Sino do site: "Limpar" (o usuário pediu, 2026-11-22). Cada pessoa apaga só para si (a notificação pode ser de todos);
-- aviso novo é outra linha em notifications, então continua chegando normalmente.
ALTER TABLE public.user_notifications ADD COLUMN IF NOT EXISTS apagada boolean NOT NULL DEFAULT false;
NOTIFY pgrst, 'reload schema';
