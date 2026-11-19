import { ClipboardList, Copy, ExternalLink, MessageCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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
  if (/concessao|certificado de registro|registro para pessoa fisica/.test(s)) return "Concessão do CR (Certificado de Registro de CAC)";
  return servico || "Processo";
}
// O que o status quer dizer, em palavras simples
function explicarStatus(status: string) {
  const s = (status || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/^indeferid/.test(s)) return "*Indeferido* — nossa equipe vai te orientar sobre os próximos passos.";
  if (/^deferid/.test(s)) return "✅ *DEFERIDO* — seu pedido foi aprovado pela Polícia Federal!";
  if (/analise/.test(s)) return "*Em análise* — seu pedido está sendo analisado pela Polícia Federal. Agora é só aguardar.";
  if (/iniciado|fila/.test(s)) return "*Enviado* — seu pedido foi enviado e aguarda a vez de ser analisado pela Polícia Federal.";
  if (/pagamento/.test(s)) return "*Aguardando pagamento* — falta o pagamento da GRU para o pedido seguir.";
  if (/documenta|exigencia|pendenc/.test(s)) return "*Aguardando documentação* — a Polícia Federal pediu documentos; nossa equipe já está cuidando e te avisa se precisar de algo.";
  if (/restitu|devolv/.test(s)) return "*Devolvido para correção* — nossa equipe já está verificando o que a Polícia Federal pediu.";
  return `*${status}*`;
}

// Mensagem para o cliente (o usuário pediu, 2026-11-19): sem número de protocolo, com o nome do serviço que o cliente
// entende e o que o status significa. Processo deferido antigo não entra (só o deferido nos últimos 2 dias, que é
// novidade); rascunho também não (ainda não foi enviado à PF). O mesmo serviço com o mesmo status vira uma linha só.
async function montarMensagem(clienteId: string, nome: string, ref: string) {
  const { data } = await supabase.from("processos_pf" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .select("servico, status, descricao, status_mudou_em").eq("cliente_id", clienteId);
  const DOIS_DIAS = 2 * 86400000;
  const lista = ((data ?? []) as unknown as { servico: string; status: string; descricao: string; status_mudou_em: string | null }[])
    .filter(p => p.status && !/rascunho/i.test(p.descricao || ""))
    .filter(p => !/^deferid/i.test(p.status.trim()) || (p.status_mudou_em && Date.now() - new Date(p.status_mudou_em).getTime() < DOIS_DIAS));
  const primeiro = (nome || "").replace(/\([^)]*\)/g, " ").trim().split(/\s+/)[0] || "";
  const ola = primeiro ? `Olá, ${primeiro.charAt(0) + primeiro.slice(1).toLowerCase()}! 👋` : "Olá! 👋";
  const link = linkAcompanhamento(ref);
  // como instalar para receber os avisos (o usuário pediu; caminho do iPhone passado por ele)
  const fimMsg = `Acompanhe quando quiser por este link:
${link}

🔔 *Para receber os avisos no celular quando o status mudar, instale o aplicativo:*

🤖 *Android:* abra o link no Chrome e toque em *Instalar* (ou no menu ⋮ → *Instalar app* / *Adicionar à tela inicial*).

📱 *iPhone:* abra o link no Safari, toque nos três tracinhos (⋯), depois em *Compartilhar*, depois em *Ver mais* e em *Adicionar à Tela de Início*.

Depois, abra pelo ícone *Meu processo* na tela inicial e toque no sininho 🔔 para ativar os avisos.

⚠️ Sem instalar e ativar os avisos, as notificações não chegam no seu celular.

Qualquer dúvida, estamos à disposição.
*Passarinho Assessoria Bélica*`;
  if (!lista.length) return `${ola}
Aqui é da Passarinho Assessoria Bélica.

No momento você não tem processo em andamento na Polícia Federal.

${fimMsg}`;
  const grupos = new Map<string, { servico: string; status: string; n: number }>();
  for (const p of lista) {
    const servico = nomeServico(p.servico), chave = servico + "|" + p.status;
    const g = grupos.get(chave);
    if (g) g.n++; else grupos.set(chave, { servico, status: p.status, n: 1 });
  }
  const blocos = [...grupos.values()].map(g => `📄 *${g.servico}${g.n > 1 ? ` (${g.n})` : ""}*
${explicarStatus(g.status)}`).join("\n\n");
  const titulo = grupos.size > 1 ? "seus processos" : "seu processo";
  return `${ola}
Aqui é da Passarinho Assessoria Bélica, com a atualização de ${titulo} na Polícia Federal:

${blocos}

${fimMsg}`;
}

// WhatsApp do cliente: com DDD vira 55 + número; sem telefone abre o WhatsApp para escolher o contato
function linkWhatsApp(telefone: string | undefined, texto: string) {
  let n = (telefone || "").replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = "55" + n;
  return `https://wa.me/${n.length >= 12 ? n : ""}?text=${encodeURIComponent(texto)}`;
}

// Botão no card do cliente (Clientes Armas): link do acompanhamento e a mensagem com o status para mandar ao cliente
export function BotaoAcompanhamento({ clienteId, codigo, nome, telefone, pequeno }: { clienteId: string; codigo?: string; nome: string; telefone?: string; pequeno?: boolean }) {
  const ref = codigo || clienteId;
  const tam = pequeno ? "h-6 w-6" : "h-7 w-7";
  const icone = pequeno ? "h-3 w-3" : "h-3.5 w-3.5";
  const copiar = (texto: string, ok: string) =>
    navigator.clipboard.writeText(texto).then(() => toast.success(ok)).catch(() => toast.error("Não consegui copiar."));

  const enviarWhatsApp = async () => {
    // abre a aba já no clique (depois de esperar o banco o navegador bloquearia a janela nova)
    const aba = window.open("", "_blank");
    try {
      const url = linkWhatsApp(telefone, await montarMensagem(clienteId, nome, ref));
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
        <DropdownMenuItem onClick={async () => copiar(await montarMensagem(clienteId, nome, ref), "Mensagem copiada!")} className="gap-2 text-xs">
          <FileText className="h-3.5 w-3.5" />Copiar mensagem com o status
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => copiar(linkAcompanhamento(ref), "Link do acompanhamento copiado!")} className="gap-2 text-xs">
          <Copy className="h-3.5 w-3.5" />Copiar link do acompanhamento
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(linkAcompanhamento(ref), "_blank")} className="gap-2 text-xs">
          <ExternalLink className="h-3.5 w-3.5" />Abrir acompanhamento
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
