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
  "Olá! Esta é a sua Carteira Digital da RW Investimentos:",
  link,
  "",
  "Para receber no celular os avisos de vencimento dos seus documentos:",
  "1. Abra o link e toque em *Instalar o aplicativo*.",
  "2. Toque em *Ativar avisos* e permita as notificações.",
  "(No iPhone: instale primeiro, abra pelo ícone na tela inicial e ative os avisos por lá.)",
  "",
  "⚠️ Sem instalar e ativar os avisos, as notificações não chegam no seu celular.",
].join("
");

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
