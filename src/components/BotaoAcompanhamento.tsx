import { ClipboardList, Copy, ExternalLink, MessageCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { linkCarteira } from "@/components/BotaoCarteira";

// Link público do acompanhamento do processo (status do Sinarm CAC / Portal PF que o Passarinho grava ao entrar na
// conta gov do cliente)
// (link curto: iniciais do nome, ex.: /acompanhamento/rmc; sem código ainda, usa o id do cliente)
export const linkAcompanhamento = (ref: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL}acompanhamento/${ref}`;

// Nome do serviço como o cliente entende (o da PF é longo e muda entre Sinarm CAC e Portal PF)
function nomeServico(servico: string) {
  const s = (servico || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/guia de trafego/.test(s)) return "Guia de Tráfego (GT)";
  if (/apostilamento/.test(s)) return "Apostilamento do CR";
  if (/renovacao.*craf/.test(s)) return "Renovação do CRAF";
  if (/registrar arma|craf/.test(s)) return "Registro da arma (CRAF)";
  if (/aquisicao|autoriza/.test(s)) return "Autorização de compra de arma de fogo";
  if (/concessao|certificado de registro|registro para pessoa fisica/.test(s)) return "Concessão do CR";
  return servico || "Processo";
}
// O que o status quer dizer, curto (o usuário pediu mensagem resumida)
function explicarStatus(status: string) {
  const s = (status || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/^indeferid/.test(s)) return "*Indeferido* — vamos te orientar.";
  if (/^deferid/.test(s)) return "✅ *Deferido!*";
  if (/analise/.test(s)) return "*Em análise* na PF.";
  if (/iniciado|fila/.test(s)) return "*Enviado*, aguardando análise.";
  if (/pagamento/.test(s)) return "*Aguardando pagamento* da GRU.";
  if (/documenta|exigencia|pendenc/.test(s)) return "*Aguardando documentação* — já estamos cuidando.";
  if (/restitu|devolv/.test(s)) return "*Devolvido para correção* — já estamos cuidando.";
  return `*${status}*`;
}

// Mensagem para o cliente (o usuário pediu, 2026-11-19): curta, sem número de protocolo, com o nome do serviço que o
// cliente entende. Deferido antigo não entra (só o dos últimos 2 dias, que é novidade); rascunho também não. Serviço
// que já tem um deferido não mostra o indeferido antigo dele. O mesmo serviço com o mesmo status vira uma linha só.
// link: o da Carteira Digital do cliente (todo cliente tem uma desde 2026-11-22); app: nome do ícone instalado
async function montarMensagem(clienteId: string, nome: string, link: string, app = "Carteira CAC") {
  const { data } = await supabase.from("processos_pf" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .select("servico, status, descricao, status_mudou_em").eq("cliente_id", clienteId);
  const DOIS_DIAS = 2 * 86400000;
  const todos = ((data ?? []) as unknown as { servico: string; status: string; descricao: string; status_mudou_em: string | null }[])
    .filter(p => p.status && !/rascunho/i.test(p.descricao || ""));
  const deferido = (p: { status: string }) => /^deferid/i.test(p.status.trim());
  const comDeferido = new Set(todos.filter(deferido).map(p => nomeServico(p.servico)));
  const lista = todos
    .filter(p => !deferido(p) || (p.status_mudou_em && Date.now() - new Date(p.status_mudou_em).getTime() < DOIS_DIAS))
    .filter(p => !(/^indeferid/i.test(p.status.trim()) && comDeferido.has(nomeServico(p.servico))));
  const primeiro = (nome || "").replace(/\([^)]*\)/g, " ").trim().split(/\s+/)[0] || "";
  const ola = primeiro ? `Olá, ${primeiro.charAt(0) + primeiro.slice(1).toLowerCase()}! 👋` : "Olá! 👋";
  // instalar para receber os avisos, em poucas linhas (caminho do iPhone passado pelo usuário)
  const fimMsg = [
    `Acompanhe por aqui: ${link}`,
    "",
    "🔔 Para receber avisos no celular, instale o app:",
    "• *Android:* Chrome → ⋮ → *Instalar app*",
    "• *iPhone:* Safari → ⋯ → *Compartilhar* → *Ver mais* → *Adicionar à Tela de Início*",
    `Depois abra o ícone *${app}* e toque no 🔔.`,
    "",
    "*Passarinho Assessoria Bélica*",
  ].join("\n");
  if (!lista.length) return `${ola}\nNo momento você não tem processo em andamento na Polícia Federal.\n\n${fimMsg}`;
  const grupos = new Map<string, { servico: string; status: string; n: number }>();
  // GT mostra a situação (o usuário gostou assim); os outros serviços só o nome ("📄 Concessão do CR na PF."), sem o
  // status (pedido dele, 2026-11-22) — por isso eles se agrupam só pelo serviço
  const ehGT = (servico: string) => /\(GT\)/.test(servico);
  for (const p of lista) {
    const servico = nomeServico(p.servico), chave = ehGT(servico) ? servico + "|" + p.status : servico;
    const g = grupos.get(chave);
    if (g) g.n++; else grupos.set(chave, { servico, status: p.status, n: 1 });
  }
  const linhas = [...grupos.values()].map(g => ehGT(g.servico)
    ? `📄 ${g.servico}${g.n > 1 ? ` (${g.n})` : ""}: ${explicarStatus(g.status)}`
    : `📄 ${g.servico}${g.n > 1 ? ` (${g.n})` : ""} na PF.`).join("\n");
  return `${ola} Atualização ${grupos.size > 1 ? "dos seus processos" : "do seu processo"} na Polícia Federal:\n\n${linhas}\n\n${fimMsg}`;
}

// WhatsApp do cliente: com DDD vira 55 + número; sem telefone abre o WhatsApp para escolher o contato
function linkWhatsApp(telefone: string | undefined, texto: string) {
  let n = (telefone || "").replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = "55" + n;
  return `https://wa.me/${n.length >= 12 ? n : ""}?text=${encodeURIComponent(texto)}`;
}

// Botão no card do cliente (Clientes Armas): link do acompanhamento e a mensagem com o status para mandar ao cliente
// carteira: código do link da Carteira Digital do cliente. O link que vai para o cliente é o da carteira (o usuário pediu,
// 2026-11-22); o de acompanhamento só fica para quem ainda não tem carteira
export function BotaoAcompanhamento({ clienteId, codigo, carteira, nome, telefone, pequeno }: { clienteId: string; codigo?: string; carteira?: string; nome: string; telefone?: string; pequeno?: boolean }) {
  const ref = codigo || clienteId;
  const linkCliente = carteira ? linkCarteira(carteira) : linkAcompanhamento(ref);
  const app = carteira ? "Carteira CAC" : "Meu processo";
  // ver a página do processo em si (com ?carteira=1 ela não redireciona para a carteira)
  const linkProcesso = linkAcompanhamento(ref) + (carteira ? "?carteira=1" : "");
  const tam = pequeno ? "h-6 w-6" : "h-7 w-7";
  const icone = pequeno ? "h-3 w-3" : "h-3.5 w-3.5";
  const copiar = (texto: string, ok: string) =>
    navigator.clipboard.writeText(texto).then(() => toast.success(ok)).catch(() => toast.error("Não consegui copiar."));

  const enviarWhatsApp = async () => {
    // abre a aba já no clique (depois de esperar o banco o navegador bloquearia a janela nova)
    const aba = window.open("", "_blank");
    try {
      const url = linkWhatsApp(telefone, await montarMensagem(clienteId, nome, linkCliente, app));
      if (aba) aba.location.href = url; else window.location.href = url;
    } catch {
      aba?.close();
      toast.error("Não consegui montar a mensagem.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={`${tam} text-muted-foreground hover:text-primary`} title="Acompanhamento do processo">
          <ClipboardList className={icone} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-xs">
        <DropdownMenuItem onClick={enviarWhatsApp} className="gap-2 text-xs">
          <MessageCircle className="h-3.5 w-3.5" />Enviar status pelo WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={async () => copiar(await montarMensagem(clienteId, nome, linkCliente, app), "Mensagem copiada!")} className="gap-2 text-xs">
          <FileText className="h-3.5 w-3.5" />Copiar mensagem com o status
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => copiar(linkCliente, carteira ? "Link da carteira copiado!" : "Link do acompanhamento copiado!")} className="gap-2 text-xs">
          <Copy className="h-3.5 w-3.5" />{carteira ? "Copiar link do cliente (carteira)" : "Copiar link do acompanhamento"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(linkProcesso, "_blank")} className="gap-2 text-xs">
          <ExternalLink className="h-3.5 w-3.5" />Abrir acompanhamento
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
