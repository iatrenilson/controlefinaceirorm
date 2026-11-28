import { useEffect, useState } from "react";
import { Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

// Quem faz as consultas (2026-11-28, o usuário pediu): cada Passarinho com o site aberto manda a cada 30 s o nome do
// computador (popup) e se está com "Atender a fila de consultas neste computador" ligado (tabela passarinho_computadores,
// sinalPassarinho em site-funcs.js). Verde: algum computador atendendo; vermelho: nenhum (a fila fica parada).
type Pc = { maquina: string; nome: string; atende: boolean; versao: string; visto_em: string };
const ONLINE_MS = 90 * 1000;

const haQuanto = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} dia(s)`;
};

export default function PassarinhoFila() {
  const [pcs, setPcs] = useState<Pc[] | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    let parar = false;
    const carregar = async () => {
      const desde = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
      const { data, error } = await supabase.from("passarinho_computadores" as any)
        .select("maquina,nome,atende,versao,visto_em").gt("visto_em", desde).order("visto_em", { ascending: false });
      if (!parar && !error) setPcs((data ?? []) as unknown as Pc[]);
      setTick(t => t + 1);
    };
    carregar();
    const i = setInterval(carregar, 20000);
    return () => { parar = true; clearInterval(i); };
  }, []);

  if (!pcs?.length) return null; // não é admin, ou nenhuma Passarinho 3.74+ mandou sinal ainda
  const ligado = (p: Pc) => Date.now() - +new Date(p.visto_em) < ONLINE_MS;
  const atendendo = pcs.filter(p => ligado(p) && p.atende);
  const nome = (p: Pc) => p.nome || "Computador sem nome";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9"
          title={atendendo.length ? `Consultas: ${atendendo.map(nome).join(", ")}` : "Nenhum computador atendendo a fila de consultas"}>
          <Server className={`h-5 w-5 ${atendendo.length ? "text-emerald-400" : "text-red-400"}`} />
          <span className={`absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${atendendo.length ? "bg-emerald-400" : "bg-red-500 animate-pulse"}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-sm space-y-3">
        <div>
          <p className="font-semibold">📡 Quem faz as consultas</p>
          <p className="text-xs text-muted-foreground">
            {atendendo.length
              ? <>A fila dos clientes e a consulta geral estão com <b className="text-emerald-400">{atendendo.map(nome).join(" e ")}</b>.</>
              : <b className="text-red-400">⚠️ Nenhum computador atendendo a fila agora. Os pedidos ficam guardados até um computador voltar.</b>}
          </p>
        </div>
        <ul className="space-y-2">
          {pcs.map(p => {
            const on = ligado(p);
            return (
              <li key={p.maquina} className="flex items-start gap-2 text-xs">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${on && p.atende ? "bg-emerald-400" : on ? "bg-amber-400" : "bg-muted-foreground/40"}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">💻 {nome(p)} {p.versao && <span className="text-muted-foreground font-normal">· Passarinho {p.versao}</span>}</div>
                  <div className="text-muted-foreground">
                    {on ? (p.atende ? "Ligado, atendendo a fila" : "Ligado, não atende a fila") : `Desligado ou sem o site aberto (visto ${haQuanto(p.visto_em)})`}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-muted-foreground">
          O nome e a opção "Atender a fila de consultas neste computador" ficam no popup da Passarinho de cada computador.
          Precisa do Chrome aberto com uma aba deste site logada.
        </p>
      </PopoverContent>
    </Popover>
  );
}
