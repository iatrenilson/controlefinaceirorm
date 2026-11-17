import { ClipboardList, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Link público do acompanhamento do processo (status da PF que o Passarinho grava ao entrar na conta gov do cliente)
export const linkAcompanhamento = (clienteId: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL}acompanhamento/${clienteId}`;

// Botão no card do cliente (Clientes Armas): copia ou abre o link de acompanhamento do processo
export function BotaoAcompanhamento({ clienteId, pequeno }: { clienteId: string; pequeno?: boolean }) {
  const tam = pequeno ? "h-6 w-6" : "h-7 w-7";
  const icone = pequeno ? "h-3 w-3" : "h-3.5 w-3.5";
  const copiar = () =>
    navigator.clipboard.writeText(linkAcompanhamento(clienteId))
      .then(() => toast.success("Link do acompanhamento copiado!"))
      .catch(() => toast.error("Não consegui copiar o link."));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={`${tam} text-muted-foreground hover:text-primary`} title="Acompanhamento do processo">
          <ClipboardList className={icone} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-xs">
        <DropdownMenuItem onClick={copiar} className="gap-2 text-xs">
          <Copy className="h-3.5 w-3.5" />Copiar link do acompanhamento
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(linkAcompanhamento(clienteId), "_blank")} className="gap-2 text-xs">
          <ExternalLink className="h-3.5 w-3.5" />Abrir acompanhamento
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
