-- Aviso diário de consulta: no dia em que o escritório consulta o Sinarm CAC / Portal PF do cliente, cada aparelho
-- inscrito recebe no máximo uma notificação "processo conferido hoje" (scripts/avisos-acompanhamento.mjs).
-- Guarda o dia (de Manaus) do último aviso desse tipo, ou de mudança de status, mandado para o aparelho.
ALTER TABLE public.push_acompanhamento ADD COLUMN IF NOT EXISTS avisado_consulta_em date;
NOTIFY pgrst, 'reload schema';
