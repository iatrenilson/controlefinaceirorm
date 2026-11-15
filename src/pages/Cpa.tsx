import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Plus, Search, Trash2, X, Check, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// CPA: contas do dia com depósito, saque, baú e lucro. Depósito e saque acumulam: cada valor lançado entra numa lista
// (dá para apagar um lançamento errado) e o total é a soma. Guardado em app_config, um documento por mês
// (chave "cpa_AAAA-MM"), sem tabela nova; só o administrador grava.
interface Lancamento { id: string; valor: number; em: string }
interface Conta { id: string; nome: string; depositos: Lancamento[]; saques: Lancamento[]; bau: number }
type Mes = Record<string, Conta[]>; // "AAAA-MM-DD" → contas do dia

const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const soma = (l: Lancamento[]) => l.reduce((t, x) => t + x.valor, 0);
const lucroDe = (c: Conta) => soma(c.saques) + (c.bau || 0) - soma(c.depositos);
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// "1.500,50" / "1500,5" / "320" / "320.5" → número
function lerValor(v: string): number | null {
  let t = v.trim().replace(/[R$\s]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
const diaISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const chaveMes = (dia: string) => `cpa_${dia.slice(0, 7)}`;

// Depósito ou saque: total grande, campo "+ valor" (Enter soma) e a lista de lançamentos ao clicar no total
function CampoAcumulado({ rotulo, lancamentos, onMudar, cor }: {
  rotulo: string; lancamentos: Lancamento[]; onMudar: (l: Lancamento[]) => void; cor: string;
}) {
  const [valor, setValor] = useState("");
  const [aberto, setAberto] = useState(false);
  const somar = () => {
    const v = lerValor(valor);
    if (v === null || v === 0) { if (valor.trim()) toast.error("Valor inválido"); return; }
    onMudar([...lancamentos, { id: novoId(), valor: v, em: new Date().toISOString() }]);
    setValor("");
  };
  return (
    <div className="space-y-1.5">
      <button type="button" onClick={() => setAberto(a => !a)} className="w-full text-left" title="Ver os lançamentos">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">{rotulo}</p>
        <p className={`text-base font-bold ${cor}`}>{reais(soma(lancamentos))}</p>
        <p className="text-[10px] text-muted-foreground">{lancamentos.length} lançamento{lancamentos.length === 1 ? "" : "s"} {aberto ? "▲" : "▼"}</p>
      </button>
      <div className="flex gap-1">
        <Input className="h-8 text-sm" inputMode="decimal" placeholder="+ valor" value={valor}
          onChange={e => setValor(e.target.value)} onKeyDown={e => { if (e.key === "Enter") somar(); }} />
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={somar} title={`Somar ao ${rotulo.toLowerCase()}`}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
      {aberto && (
        <div className="rounded-md border border-border/60 p-1.5 space-y-0.5">
          {lancamentos.length === 0 && <p className="text-[11px] text-muted-foreground px-1">Nenhum lançamento.</p>}
          {lancamentos.map(l => (
            <div key={l.id} className="flex items-center gap-2 text-xs px-1">
              <span className="flex-1">{reais(l.valor)}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(l.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              <button onClick={() => onMudar(lancamentos.filter(x => x.id !== l.id))} title="Apagar este lançamento"
                className="p-0.5 rounded text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaConta({ conta, onMudar, onExcluir }: { conta: Conta; onMudar: (c: Conta) => void; onExcluir: () => void }) {
  const [nome, setNome] = useState(conta.nome);
  const [bau, setBau] = useState(conta.bau ? String(conta.bau).replace(".", ",") : "");
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => { setNome(conta.nome); }, [conta.nome]);
  const lucro = lucroDe(conta);
  const salvarBau = () => {
    const v = bau.trim() ? lerValor(bau) : 0;
    if (v === null) { toast.error("Valor do baú inválido"); return; }
    if (v !== (conta.bau || 0)) onMudar({ ...conta, bau: v });
  };
  return (
    <div className="grid gap-3 rounded-lg border border-border/60 bg-card p-3 sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr_auto] sm:items-start">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">Nome</p>
        <Input className="h-9 text-sm font-semibold uppercase" value={nome} placeholder="Nome da conta"
          onChange={e => setNome(e.target.value)}
          onBlur={() => { if (nome.trim() !== conta.nome) onMudar({ ...conta, nome: nome.trim() }); }}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      </div>
      <CampoAcumulado rotulo="Depósito" cor="text-foreground" lancamentos={conta.depositos} onMudar={l => onMudar({ ...conta, depositos: l })} />
      <CampoAcumulado rotulo="Saque" cor="text-sky-400" lancamentos={conta.saques} onMudar={l => onMudar({ ...conta, saques: l })} />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">Baú</p>
        <Input className="h-9 text-sm" inputMode="decimal" placeholder="0,00" value={bau}
          onChange={e => setBau(e.target.value)} onBlur={salvarBau}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:hidden">Lucro</p>
        <p className={`text-base font-bold pt-1.5 ${lucro > 0 ? "text-green-500" : lucro < 0 ? "text-red-500" : "text-muted-foreground"}`}>{reais(lucro)}</p>
      </div>
      <div className="flex justify-end pt-1">
        {confirmar ? (
          <span className="flex items-center gap-1">
            <button onClick={onExcluir} className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive text-white text-[11px] font-semibold"><Check className="h-3 w-3" />Excluir</button>
            <button onClick={() => setConfirmar(false)} className="p-1 rounded-md hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
          </span>
        ) : (
          <button onClick={() => setConfirmar(true)} title="Excluir conta"
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}

export default function Cpa() {
  const [dia, setDia] = useState(() => diaISO(new Date()));
  const [meses, setMeses] = useState<Record<string, Mes>>({}); // chave do mês → dados
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const chave = chaveMes(dia);
  const mes = meses[chave];

  useEffect(() => {
    if (meses[chave]) return;
    supabase.from("app_config" as any).select("valor").eq("chave", chave).maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error("Não consegui carregar: " + error.message);
        setMeses(m => ({ ...m, [chave]: ((data as any)?.valor?.dias as Mes) ?? {} }));
      });
  }, [chave, meses]);

  // Cada mudança grava o mês inteiro; as gravações vão em fila, na ordem em que foram feitas
  const gravarDia = (contas: Conta[]) => {
    const novoMes = { ...(meses[chave] ?? {}), [dia]: contas };
    setMeses(m => ({ ...m, [chave]: novoMes }));
    setSalvando(true);
    fila.current = fila.current.then(async () => {
      const { error } = await supabase.from("app_config" as any)
        .upsert({ chave, valor: { dias: novoMes }, updated_at: new Date().toISOString() });
      if (error) toast.error("Não consegui salvar: " + error.message);
    }).finally(() => setSalvando(false));
  };

  const mudarDia = (passo: number) => {
    const d = new Date(`${dia}T12:00:00`);
    d.setDate(d.getDate() + passo);
    setDia(diaISO(d));
  };

  if (!mes) return <div className="p-4 text-sm text-muted-foreground">Carregando…</div>;

  const contas = mes[dia] ?? [];
  const visiveis = contas.filter(c => !busca.trim() || c.nome.toLowerCase().includes(busca.trim().toLowerCase()));
  const totalDep = contas.reduce((t, c) => t + soma(c.depositos), 0);
  const totalRet = contas.reduce((t, c) => t + soma(c.saques) + (c.bau || 0), 0);
  const lucroDia = totalRet - totalDep;
  const comDeposito = contas.filter(c => c.depositos.length).length;
  const lucroMes = Object.values(mes).flat().reduce((t, c) => t + lucroDe(c), 0);
  const hoje = dia === diaISO(new Date());
  const tituloDia = new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const corLucro = (n: number) => (n > 0 ? "text-green-500" : n < 0 ? "text-red-500" : "");

  const resumo = [
    { rotulo: "Total depositado", valor: reais(totalDep), cor: "" },
    { rotulo: "Total retorno (saque + baú)", valor: reais(totalRet), cor: "text-sky-400" },
    { rotulo: "Lucro do dia", valor: reais(lucroDia), cor: corLucro(lucroDia) },
    { rotulo: "Média de depósitos", valor: reais(comDeposito ? totalDep / comDeposito : 0), cor: "text-violet-400" },
    { rotulo: `Lucro em ${new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { month: "long" })}`, valor: reais(lucroMes), cor: corLucro(lucroMes) },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-bold flex items-center gap-2"><Coins className="h-5 w-5 text-primary" />CPA</h1>
          <p className="text-sm text-muted-foreground">Depósitos, saques e lucro das contas do dia. {salvando ? "Salvando…" : "Tudo salvo."}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card px-1 py-1">
          <button onClick={() => mudarDia(-1)} className="p-1.5 rounded-full hover:bg-accent" title="Dia anterior"><ChevronLeft className="h-4 w-4" /></button>
          {!hoje && <button onClick={() => setDia(diaISO(new Date()))} className="px-2.5 py-1 rounded-full text-xs font-semibold border border-border/60 hover:bg-accent">Hoje</button>}
          <input type="date" value={dia} onChange={e => e.target.value && setDia(e.target.value)}
            className="bg-transparent text-sm font-medium px-1 outline-none [color-scheme:dark]" title={tituloDia} />
          <button onClick={() => mudarDia(1)} className="p-1.5 rounded-full hover:bg-accent" title="Próximo dia"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <Button className="gap-1" onClick={() => gravarDia([...contas, { id: novoId(), nome: "", depositos: [], saques: [], bau: 0 }])}>
          <Plus className="h-4 w-4" />Nova conta
        </Button>
      </div>
      <p className="text-sm font-medium first-letter:uppercase -mt-2">{tituloDia}</p>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {resumo.map(r => (
          <Card key={r.rotulo}>
            <CardContent className="p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{r.rotulo}</p>
              <p className={`text-lg font-bold ${r.cor}`}>{r.valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input className="h-9 text-sm pl-8" placeholder="Buscar por nome…" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <div className="space-y-2">
        {contas.length > 0 && (
          <div className="hidden sm:grid sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr_auto] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Nome</span><span>Depósito</span><span>Saque</span><span>Baú</span><span>Lucro</span><span className="w-8" />
          </div>
        )}
        {contas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhuma conta neste dia. Clique em "Nova conta".</p>
        ) : visiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conta com esse nome.</p>
        ) : visiveis.map(c => (
          <LinhaConta key={c.id} conta={c}
            onMudar={nova => gravarDia(contas.map(x => (x.id === c.id ? nova : x)))}
            onExcluir={() => gravarDia(contas.filter(x => x.id !== c.id))} />
        ))}
      </div>
    </div>
  );
}
