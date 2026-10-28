// Avisos de vencimento dos documentos da Carteira CAC: a mesma regra no sininho do site (NotificationBell) e no do
// link externo do cliente (CarteiraCliente). Vale a última data dd/mm/aaaa do campo de validade, e o documento conta
// como vencido a partir do dia seguinte (igual à página do cliente). Antecedência pedida pelo usuário: GT 1 mês antes,
// CR e CRAF 3 meses antes; certificado só quando vence.

export const ROTULO_TIPO_CARTEIRA: Record<string, string> = { cr: "CR", craf: "CRAF da Arma", gt: "GT", cert: "Certificado" };
export const MESES_ANTES: Record<string, number> = { gt: 1, cr: 3, craf: 3 };

export const ultimaData = (validade: string) => (validade.match(/\d{2}\/\d{2}\/\d{4}/g) ?? []).pop() ?? "";

// dias até a validade (negativo = vencido) se já venceu ou entrou no prazo de aviso do tipo; null sem data ou fora do prazo
export function situacaoDoc(tipo: string, validade: string): { dias: number; vencido: boolean } | null {
  const ultima = ultimaData(validade);
  if (!ultima) return null;
  const [d, m, a] = ultima.split("/").map(Number);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = Math.ceil((new Date(a, m - 1, d).getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return { dias, vencido: true };
  const meses = MESES_ANTES[tipo];
  return meses && hoje >= new Date(a, m - 1 - meses, d) ? { dias, vencido: false } : null;
}

// "há 3 dias" / "em 20 dias" / "hoje"
export function textoPrazo(validade: string, dias: number, vencido: boolean): string {
  const n = Math.abs(dias);
  const nDias = `${n} ${n === 1 ? "dia" : "dias"}`;
  return vencido ? `Venceu em ${validade} (há ${nDias})` : `Vence em ${validade} (${dias === 0 ? "hoje" : `em ${nDias}`})`;
}

// primeiro os já vencidos (o que venceu mais recentemente antes), depois os que vencem mais cedo
export const ordemAvisos = (a: { dias: number; vencido: boolean }, b: { dias: number; vencido: boolean }) =>
  a.vencido !== b.vencido ? (a.vencido ? -1 : 1) : a.vencido ? b.dias - a.dias : a.dias - b.dias;
