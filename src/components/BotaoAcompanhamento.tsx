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

// Mensagem para o cliente com o status de cada processo (sem os rascunhos, que ainda não foram enviados à PF) e o link
async function montarMensagem(clienteId: string, nome: string, ref: string) {
  const { data } = await supabase.from("processos_pf" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .select("servico, protocolo, status, descricao, data_solicitacao").eq("cliente_id", clienteId);
  const lista = ((data ?? []) as { servico: string; protocolo: string; status: string; descricao: string }[])
    .filter(p => !/rascunho/i.test(p.descricao || ""));
  const primeiro = (nome || "").replace(/\([^)]*\)/g, " ").trim().split(/\s+/)[0] || "";
  const ola = primeiro ? `Olá, ${primeiro.charAt(0) + primeiro.slice(1).toLowerCase()}!` : "Olá!";
  const link = linkAcompanhamento(ref);
  if (!lista.length) return `${ola} Você pode acompanhar o andamento do seu processo por este link:\n${link}\n\nPassarinho Assessoria`;
  const linhas = lista.map(p => `• ${p.servico} (${p.protocolo}): *${p.status}*`).join("\n");
  return `${ola} Atualização do seu processo na Polícia Federal:\n\n${linhas}\n\nAcompanhe sempre por este link:\n${link}\n\nPassarinho Assessoria`;
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
