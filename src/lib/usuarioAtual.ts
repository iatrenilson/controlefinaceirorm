import { supabase } from "@/integrations/supabase/client";

// Usuário logado lido da sessão guardada no navegador, sem ida ao servidor.
// (auth.getUser() consulta o servidor toda vez e segura as outras buscas da página.)
export async function usuarioAtual() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}
