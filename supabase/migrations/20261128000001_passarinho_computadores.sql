-- Qual computador atende a fila de consultas (2026-11-28, o usuário pediu): cada Passarinho com o site aberto manda a
-- cada 30 s o nome do computador (dado no popup) e se está com "Atender a fila de consultas neste computador" ligado.
-- O site mostra ao lado do sino quem está atendendo, ou o aviso de que nenhum computador está. A tabela passarinho_sinal
-- (id = 1) continua sendo o "ligado" que a página de acompanhamento do cliente usa, e só quem atende grava nela.
CREATE TABLE IF NOT EXISTS public.passarinho_computadores (
  maquina  text PRIMARY KEY,               -- id aleatório gerado pela Passarinho na 1ª vez (chrome.storage)
  nome     text NOT NULL DEFAULT '',
  atende   boolean NOT NULL DEFAULT true,
  versao   text NOT NULL DEFAULT '',
  visto_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.passarinho_computadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS passarinho_computadores_admin ON public.passarinho_computadores;
CREATE POLICY passarinho_computadores_admin ON public.passarinho_computadores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';
