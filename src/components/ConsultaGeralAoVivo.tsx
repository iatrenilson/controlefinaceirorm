import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Consulta geral ao vivo (2026-11-27, o usuário pediu): enquanto a Passarinho consulta os clientes, um quadro na tela
// mostra quem está sendo consultado e o resultado de cada um. No sino fica só o resumo do fim ("Consulta geral concluída").
type Pedido = { id: string; cliente_id: string; status: string; mensagem: string | null; pedido_em: string; atualizado_em: string | null };

const curto = (s: string) => String(s || "").replace(/\s*\([^)]*\)/g, "").replace(/^Emitir |^Solicitar /i, "").slice(0, 50);

export default function ConsultaGeralAoVivo() {
  const [lote, setLote] = useState<Pedido[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, string[]>>({});
  const [aberto, setAberto] = useState(false);
  const [fechado, setFechado] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const ativoRef = useRef(false);
  const inicioRef = useRef(0);
  const nomesRef = useRef<Record<string, string>>({});
  const feitosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let parar = false, timer: ReturnType<typeof setTimeout> | undefined, fimTimer: ReturnType<typeof setTimeout> | undefined;
    const carregar = async () => {
      try {
        const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { data } = await supabase.from("pedidos_atualizacao" as any)
          .select("id,cliente_id,status,mensagem,pedido_em,atualizado_em")
          .eq("automatico", true).gt("pedido_em", desde).order("pedido_em");
        const todos = (data ?? []) as unknown as Pedido[];
        const ativos = todos.filter(p => p.status === "pendente" || p.status === "rodando");
        if (!ativos.length && !ativoRef.current) return;
        if (ativos.length) {
          if (!ativoRef.current) { ativoRef.current = true; setFechado(false); feitosRef.current = new Set(); }
          setAberto(true);
          inicioRef.current = Math.min(...ativos.map(p => +new Date(p.pedido_em)));
        } else {
          // acabou: deixa o quadro mais um pouco com tudo concluído e some (o resumo fica no sino)
          ativoRef.current = false;
          fimTimer = setTimeout(() => { if (!ativoRef.current) setAberto(false); }, 20000);
        }
        const doLote = todos.filter(p => +new Date(p.pedido_em) >= inicioRef.current - 10 * 60 * 1000);
        setLote(doLote);
        const semNome = [...new Set(doLote.map(p => p.cliente_id))].filter(id => !nomesRef.current[id]);
        if (semNome.length) {
          const { data: cl } = await supabase.from("declaracao_clientes" as any).select("id,nome").in("id", semNome);
          for (const c of (cl ?? []) as any[]) nomesRef.current[c.id] = c.nome;
          setNomes({ ...nomesRef.current });
        }
        const novosFeitos = doLote.filter(p => p.status === "feito" && !feitosRef.current.has(p.id));
        if (novosFeitos.length) {
          const ids = novosFeitos.map(p => p.cliente_id);
          const { data: procs } = await supabase.from("processos_pf" as any).select("cliente_id,servico,status,descricao").in("cliente_id", ids);
          setStatus(ant => {
            const n = { ...ant };
            for (const id of ids) {
              n[id] = [...new Set(((procs ?? []) as any[])
                .filter(p => p.cliente_id === id && p.status && !/rascunho/i.test(p.descricao || ""))
                .map(p => `${curto(p.servico)}: ${p.status}`))];
            }
            return n;
          });
          for (const p of novosFeitos) feitosRef.current.add(p.id);
        }
      } catch { /* tenta de novo no próximo ciclo */ }
      finally {
        if (!parar) timer = setTimeout(carregar, ativoRef.current ? 4000 : 20000);
      }
    };
    carregar();
    return () => { parar = true; clearTimeout(timer); clearTimeout(fimTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!aberto || fechado || !lote.length) return null;
  const terminados = lote.filter(p => p.status === "feito" || p.status === "erro");
  const rodando = lote.find(p => p.status === "rodando");
  const acabou = terminados.length === lote.length;
  const recentes = [...terminados].sort((a, b) => +new Date(b.atualizado_em || 0) - +new Date(a.atualizado_em || 0));
  const pct = Math.round((terminados.length / lote.length) * 100);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-sky-400/40 bg-card/95 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
        <span className="text-sm font-semibold flex-1">
          {acabou ? "✅ Consulta geral concluída" : "🔎 Consulta geral"} · {terminados.length} de {lote.length}
        </span>
        <button className="text-muted-foreground hover:text-foreground" onClick={() => setMinimizado(m => !m)} title={minimizado ? "Abrir" : "Minimizar"}>
          {minimizado ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <button className="text-muted-foreground hover:text-foreground" onClick={() => setFechado(true)} title="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-1 bg-muted">
        <div className="h-1 bg-sky-400 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      {!minimizado && (
        <div className="px-3 py-2 space-y-2">
          {rodando && (
            <div className="text-xs rounded-md bg-sky-500/10 border border-sky-400/30 px-2 py-1.5">
              <span className="animate-pulse">🔄</span> Consultando agora: <b>{nomes[rodando.cliente_id] || "…"}</b>
            </div>
          )}
          {acabou && <div className="text-xs text-muted-foreground">O resumo completo ficou no sino 🔔.</div>}
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {recentes.map(p => (
              <div key={p.id} className="text-xs animate-in fade-in slide-in-from-top-1 duration-500">
                <div className="font-semibold">{p.status === "feito" ? "✅" : "⚠️"} {nomes[p.cliente_id] || "Cliente"}</div>
                {p.status === "feito"
                  ? (status[p.cliente_id]?.length
                      ? status[p.cliente_id].map((s, i) => <div key={i} className="text-muted-foreground">{s}</div>)
                      : <div className="text-muted-foreground">{status[p.cliente_id] ? "Nenhuma solicitação" : "…"}</div>)
                  : <div className="text-muted-foreground">Motivo: {p.mensagem || "erro"}</div>}
              </div>
            ))}
            {!recentes.length && <div className="text-xs text-muted-foreground">Começando…</div>}
          </div>
        </div>
      )}
    </div>
  );
}
