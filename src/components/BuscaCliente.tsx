import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buscarClientes } from "@/lib/buscaCliente";

// Campo de escolher cliente cadastrado, igual ao de Laudos: clicou, abre a lista com todos; digitando, filtra por
// nome ou CPF (quem começa com o texto vem primeiro); escolheu, preenche e fecha; clicar fora fecha. Enter pega o 1º.
export function BuscaCliente<T extends { id: string; nome: string; cpf?: string | null }>({
  clientes, onSelect, label, placeholder = "Buscar por nome ou CPF...",
}: {
  clientes: T[];
  onSelect: (c: T) => void;
  label?: string;
  placeholder?: string;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const achados = aberto ? buscarClientes(clientes, busca) : [];
  const escolher = (c: T) => { onSelect(c); setBusca(""); setAberto(false); };

  return (
    <div ref={ref} className="relative space-y-1">
      {label && <Label className="text-xs text-primary font-semibold">{label}</Label>}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input className="h-9 text-sm pl-8 border-primary/40 bg-primary/5" placeholder={placeholder} value={busca}
          onClick={() => setAberto(true)}
          onChange={e => { setBusca(e.target.value); setAberto(true); }}
          onKeyDown={e => { if (e.key === "Enter" && achados.length) { e.preventDefault(); escolher(achados[0]); } }} />
      </div>
      {aberto && achados.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-56 overflow-y-auto">
          {achados.map(c => (
            <button key={c.id} type="button"
              onMouseDown={e => { e.preventDefault(); escolher(c); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex flex-col gap-0.5 border-b border-border/40 last:border-0">
              <span className="font-medium">{c.nome.toUpperCase()}</span>
              {c.cpf && <span className="text-xs text-muted-foreground">{c.cpf}</span>}
            </button>
          ))}
        </div>
      )}
      {aberto && busca.trim() && achados.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md px-3 py-2 text-sm text-muted-foreground">
          Nenhum cliente encontrado.
        </div>
      )}
    </div>
  );
}
