// Pesquisa de cliente igual à de Laudos, usada em todo o site: sem acento e sem diferença de maiúscula,
// por qualquer parte do nome, pelas palavras do nome ("dalcles souza") ou pelo CPF (com ou sem pontos).

export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// -1 = não serve; 0 = nome começa com o texto (marcações como "(PARADO)" não contam); 1 = cada palavra digitada
// começa uma palavra do nome; 2 = o texto aparece no meio do nome; 3 = CPF
function ordem(nome: string, cpf: string | null | undefined, busca: string): number {
  const q = semAcento(busca.trim());
  if (!q) return 0;
  const nm = semAcento(nome || "");
  if (nm.replace(/^(\([^)]*\)\s*)+/, "").startsWith(q)) return 0;
  const palavras = nm.split(/[^a-z0-9]+/);
  const partes = q.split(/[^a-z0-9]+/).filter(Boolean);
  if (partes.length && partes.every(p => palavras.some(w => w.startsWith(p)))) return 1;
  if (nm.includes(q)) return 2;
  const dig = busca.replace(/\D/g, "");
  return dig.length >= 3 && (cpf || "").replace(/\D/g, "").includes(dig) ? 3 : -1;
}

// Para filtrar listas (mantém a ordem da lista)
export function casaComBusca(nome: string, cpf: string | null | undefined, busca: string): boolean {
  return ordem(nome, cpf, busca) >= 0;
}

// Para escolher um cliente: filtra e põe primeiro quem começa com o texto digitado
export function buscarClientes<T extends { nome: string; cpf?: string | null }>(lista: T[], busca: string): T[] {
  if (!busca.trim()) return lista;
  return lista.map(c => ({ c, o: ordem(c.nome, c.cpf, busca) })).filter(x => x.o >= 0).sort((a, b) => a.o - b.o).map(x => x.c);
}
