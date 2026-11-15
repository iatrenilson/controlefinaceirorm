import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Plus, Search, Trash2, X, Check, Coins, LayoutDashboard, ListChecks } from "lucide-react";
import { ComposedChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
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

// ── Dashboard: lucro e totais de um período, somando todos os meses guardados ─────────────────────────────────────
const PERIODOS = [
  { id: "7", rotulo: "7 dias" },
  { id: "30", rotulo: "30 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "mesPassado", rotulo: "Mês passado" },
  { id: "tudo", rotulo: "Tudo" },
] as const;
type Periodo = typeof PERIODOS[number]["id"];

function intervalo(p: Periodo): [string, string] {
  const hoje = new Date(); const fim = diaISO(hoje);
  if (p === "7" || p === "30") { const d = new Date(); d.setDate(d.getDate() - (Number(p) - 1)); return [diaISO(d), fim]; }
  if (p === "mes") return [`${fim.slice(0, 7)}-01`, fim];
  if (p === "mesPassado") {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1), ult = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return [diaISO(ini), diaISO(ult)];
  }
  return ["0000-00-00", "9999-99-99"];
}

function Dashboard({ atuais }: { atuais: Record<string, Mes> }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [todos, setTodos] = useState<Record<string, Mes> | null>(null);
  useEffect(() => {
    supabase.from("app_config" as any).select("chave,valor").like("chave", "cpa_%")
      .then(({ data, error }) => {
        if (error) toast.error("Não consegui carregar: " + error.message);
        const m: Record<string, Mes> = {};
        for (const r of (data as any[]) ?? []) m[r.chave] = r.valor?.dias ?? {};
        setTodos(m);
      });
  }, []);
  if (!todos) return <div className="text-sm text-muted-foreground py-6">Carregando…</div>;

  // o que já está na tela (pode ter mudança ainda gravando) vale mais que o lido do banco
  const dias: Record<string, Conta[]> = {};
  for (const m of Object.values({ ...todos, ...atuais })) Object.assign(dias, m);
  const [ini, fim] = intervalo(periodo);
  const linhas = Object.entries(dias)
    .filter(([d, cs]) => d >= ini && d <= fim && cs.length)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, cs]) => {
      const dep = cs.reduce((t, c) => t + soma(c.depositos), 0);
      const saq = cs.reduce((t, c) => t + soma(c.saques), 0);
      const bau = cs.reduce((t, c) => t + (c.bau || 0), 0);
      return { dia: d, contas: cs.length, dep, saq, bau, lucro: saq + bau - dep };
    });
  let acumulado = 0;
  const grafico = linhas.map(l => ({ ...l, rotulo: `${l.dia.slice(8)}/${l.dia.slice(5, 7)}`, acumulado: (acumulado += l.lucro) }));
  const tot = linhas.reduce((t, l) => ({ dep: t.dep + l.dep, saq: t.saq + l.saq, bau: t.bau + l.bau, lucro: t.lucro + l.lucro, contas: t.contas + l.contas }),
    { dep: 0, saq: 0, bau: 0, lucro: 0, contas: 0 });
  const hoje = dias[diaISO(new Date())] ?? [];
  const lucroHoje = hoje.reduce((t, c) => t + lucroDe(c), 0);
  const positivos = linhas.filter(l => l.lucro > 0).length, negativos = linhas.filter(l => l.lucro < 0).length;
  type Linha = typeof linhas[number];
  const melhor = linhas.reduce<Linha | null>((m, l) => (!m || l.lucro > m.lucro ? l : m), null);
  const pior = linhas.reduce<Linha | null>((m, l) => (!m || l.lucro < m.lucro ? l : m), null);
  const cor = (n: number) => (n > 0 ? "text-green-500" : n < 0 ? "text-red-500" : "");
  const dataCurta = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;

  const cards = [
    { rotulo: "Lucro de hoje", valor: reais(lucroHoje), cor: cor(lucroHoje), sub: `${plural(hoje.length, "conta")} hoje` },
    { rotulo: "Lucro acumulado", valor: reais(tot.lucro), cor: cor(tot.lucro), sub: `${plural(linhas.length, "dia")} com contas` },
    { rotulo: "Total depositado", valor: reais(tot.dep), cor: "", sub: plural(tot.contas, "conta") },
    { rotulo: "Total sacado", valor: reais(tot.saq), cor: "text-sky-400", sub: `+ ${reais(tot.bau)} de baú` },
    { rotulo: "Média de lucro por dia", valor: reais(linhas.length ? tot.lucro / linhas.length : 0), cor: cor(tot.lucro), sub: `${plural(positivos, "dia")} com lucro · ${negativos} com prejuízo` },
    { rotulo: "Retorno sobre depósito", valor: tot.dep ? `${(tot.lucro / tot.dep * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—", cor: cor(tot.lucro), sub: "lucro ÷ depositado" },
    { rotulo: "Melhor dia", valor: melhor ? reais(melhor.lucro) : "—", cor: melhor ? cor(melhor.lucro) : "", sub: melhor ? dataCurta(melhor.dia) : "" },
    { rotulo: "Pior dia", valor: pior ? reais(pior.lucro) : "—", cor: pior ? cor(pior.lucro) : "", sub: pior ? dataCurta(pior.dia) : "" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <h2 className="mr-2 text-sm font-bold uppercase tracking-wide text-primary flex items-center gap-1.5"><LayoutDashboard className="h-4 w-4" />Dashboard</h2>
        {PERIODOS.map(p => (
          <button key={p.id} onClick={() => setPeriodo(p.id)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${periodo === p.id ? "bg-primary text-primary-foreground border-primary" : "border-border/60 bg-card hover:border-primary/50 hover:text-primary"}`}>
            {p.rotulo}
          </button>
        ))}
      </div>

      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
        {cards.map(c => (
          <Card key={c.rotulo}>
            <CardContent className="px-2.5 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate" title={c.rotulo}>{c.rotulo}</p>
              <p className={`text-sm font-bold leading-tight ${c.cor}`}>{c.valor}</p>
              {c.sub && <p className="text-[10px] text-muted-foreground truncate" title={c.sub}>{c.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="px-2.5 py-1.5">
          <p className="text-xs font-semibold">Lucro por dia <span className="text-[10px] font-normal text-muted-foreground">(barras) e acumulado (linha dourada)</span></p>
          {grafico.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conta neste período.</p>
          ) : (
            <div className="h-[130px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={grafico} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="rotulo" tick={{ fill: "hsl(40, 6%, 55%)", fontSize: 10 }} height={18} />
                  {/* o zero sempre aparece: com um dia só, o eixo ia de -147 a -151 */}
                  <YAxis tick={{ fill: "hsl(40, 6%, 55%)", fontSize: 10 }} width={48}
                    domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
                    tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(v))} />
                  <ReferenceLine y={0} stroke="hsl(40, 6%, 40%)" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(20, 10%, 9%)", border: "1px solid hsl(42, 40%, 25%)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, n: string) => [reais(v), n]} />
                  <Bar dataKey="lucro" name="Lucro do dia" radius={[3, 3, 0, 0]} maxBarSize={48}>
                    {grafico.map(g => <Cell key={g.dia} fill={g.lucro >= 0 ? "hsl(145, 63%, 45%)" : "hsl(0, 72%, 55%)"} />)}
                  </Bar>
                  <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="hsl(42, 82%, 52%)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {linhas.length > 0 && (
        <details className="rounded-lg border border-border/60 bg-card">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold">Ver dia a dia ({linhas.length})</summary>
          <div className="overflow-x-auto border-t border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/60">
                  <th className="text-left px-3 py-2">Dia</th><th className="text-right px-3 py-2">Contas</th>
                  <th className="text-right px-3 py-2">Depositado</th><th className="text-right px-3 py-2">Sacado</th>
                  <th className="text-right px-3 py-2">Baú</th><th className="text-right px-3 py-2">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {[...linhas].reverse().map(l => (
                  <tr key={l.dia} className="border-b border-border/30">
                    <td className="px-3 py-1.5">{new Date(`${l.dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                    <td className="text-right px-3 py-1.5">{l.contas}</td>
                    <td className="text-right px-3 py-1.5">{reais(l.dep)}</td>
                    <td className="text-right px-3 py-1.5 text-sky-400">{reais(l.saq)}</td>
                    <td className="text-right px-3 py-1.5">{reais(l.bau)}</td>
                    <td className={`text-right px-3 py-1.5 font-semibold ${cor(l.lucro)}`}>{reais(l.lucro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
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
    <div className="p-3 space-y-3">
      <h1 className="text-lg font-bold flex items-baseline gap-2"><Coins className="h-4 w-4 text-primary self-center" />CPA
        <span className="text-xs font-normal text-muted-foreground">{salvando ? "Salvando…" : "Tudo salvo."}</span></h1>

      {/* Dashboard sempre no alto da página, compacto para sobrar espaço para as contas */}
      <Dashboard atuais={meses} />

      <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
        <h2 className="flex-1 min-w-[200px] text-sm font-bold uppercase tracking-wide text-primary flex items-center gap-1.5"><ListChecks className="h-4 w-4" />Contas do dia</h2>
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
