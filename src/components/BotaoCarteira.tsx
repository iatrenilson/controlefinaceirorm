import { useNavigate } from "react-router-dom";
import { Wallet, Copy, ExternalLink, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Link público da carteira digital do cliente (o mesmo do botão "Link" na página Carteira Digital)
export const linkCarteira = (carteiraId: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL}carteira/${carteiraId}`;

// Texto copiado junto com o link: lembra o cliente de instalar a carteira e ativar os avisos (sem isso não chega notificação)
export const mensagemCarteira = (link: string) => [
  "Olá! Esta é a sua Carteira Digital da Passarinho Assessoria Bélica:",
  link,
  "",
  "🔔 Com os avisos ativados, você recebe uma notificação no celular sempre que algum documento seu estiver *perto de vencer* ou *vencido* (CR, CRAF e principalmente a *GT, que vale só 6 meses*), para renovar a tempo e não correr o risco de ficar irregular.",
  "",
  // o acompanhamento aberto pela carteira não tem sininho próprio: os avisos da carteira já incluem os do processo
  "📋 Acompanhamento do processo: dentro da carteira, toque em *Acompanhar processo* para ver o andamento do seu processo na Polícia Federal.",
  "",
  // valor passado pelo usuário (2026-11-22)
  "💳 Caso tenha interesse em usar a Carteira Digital, o valor é de *R$ 30,00 por mês*, para cobrir o custo do servidor de hospedagem.",
  "",
  // passo a passo separado no fim, para a mensagem não ficar tumultuada (pedido do usuário)
  "━━━━━━━━━━━━━━━",
  "📲 *COMO INSTALAR E ATIVAR OS AVISOS*",
  "",
  "*Android:*",
  "1. Abra o link e toque em *Instalar o aplicativo*.",
  "2. Toque em *Ativar avisos* e permita as notificações.",
  "",
  "*iPhone:*",
  "1. Abra o link no Safari e toque nos três tracinhos (⋯).",
  "2. Toque em *Compartilhar* → *Ver mais* → *Adicionar à Tela de Início*.",
  "3. Abra a carteira pelo ícone na tela de início e toque em *Ativar avisos*.",
  "",
  "⚠️ Sem instalar e ativar os avisos, as notificações não chegam no seu celular.",
].join("\n");

// Botão da carteira digital no card do cliente (Clientes Armas): copia o link, abre ou edita a carteira.
// Sem carteira ainda (nenhuma com o mesmo CPF), oferece criar uma já com o cliente escolhido.
// codigo: o primeiro nome do link (/carteira/carlos); sem ele, o link usa o id
export function BotaoCarteira({ carteiraId, codigo, clienteId, pequeno }: { carteiraId?: string; codigo?: string; clienteId: string; pequeno?: boolean }) {
  const navigate = useNavigate();
  const tam = pequeno ? "h-6 w-6" : "h-7 w-7";
  const icone = pequeno ? "h-3 w-3" : "h-3.5 w-3.5";

  const copiar = () => {
    if (!carteiraId) return;
    navigator.clipboard.writeText(mensagemCarteira(linkCarteira(codigo || carteiraId)))
      .then(() => toast.success("Link da carteira copiado, com o aviso para instalar e ativar as notificações!"))
      .catch(() => toast.error("Não consegui copiar o link."));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost" size="icon"
          className={`${tam} ${carteiraId ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-primary"}`}
          title={carteiraId ? "Carteira digital" : "Carteira digital (ainda não criada)"}
        >
          <Wallet className={icone} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-xs">
        {carteiraId ? (
          <>
            <DropdownMenuItem onClick={copiar} className="gap-2 text-xs">
              <Copy className="h-3.5 w-3.5" />Copiar link da carteira
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(linkCarteira(carteiraId), "_blank")} className="gap-2 text-xs">
              <ExternalLink className="h-3.5 w-3.5" />Abrir carteira
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/carteira-digital?editar=${carteiraId}`)} className="gap-2 text-xs">
              <Pencil className="h-3.5 w-3.5" />Editar carteira
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={() => navigate(`/carteira-digital?novo=${clienteId}`)} className="gap-2 text-xs">
            <Plus className="h-3.5 w-3.5" />Criar carteira digital
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
