import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { norm } from "@/lib/utils";

// Painel Admin › Usuários › 👁 Visualizar: mostra, só para LER, o que o usuário tem no painel dele
// (Clientes Armas, Carteira, Financeiro, Empréstimos, Delay, Laudos, Anotações). Nada aqui altera dados.
// O banco deixa o admin ler tudo (RLS); para o resto dos usuários nada mudou.

const brl = (v: unknown) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (v?: string | null) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : "—"; };
const STATUS_CAC: Record<string, string> = {
  doc: "Documentação", analise: "Em análise", deferido: "Deferido", completo: "Concluído",
  gt: "GT", craf: "CRAF", doccraf: "Doc. CRAF", docaut: "Doc. Autorização",
};

interface Dados {
  armas: any[]; carteira: any[]; emprestimos: any[]; carteiraSaldo: number;
  financeiro: any[]; cartao: any[]; delayClientes: any[]; delayTransacoes: number; delayLucro: number;
  bancos: any[]; cadastros: any[]; colaboradores: any[]; anotacoes: { nome: string; itens: { texto: string; feito: boolean }[] }[];
}

const tab = (t: string) => supabase.from(t as any) as any;

async function carregar(uid: string): Promise<Dados> {
  const [armas, carteira, emprestimos, wallet, financeiro, cartao, delayClientes, delayTr, bancos, colaboradores, anot] = await Promise.all([
    tab("declaracao_clientes").select("id,nome,cpf,status,created_at").eq("owner_id", uid).order("nome"),
    tab("carteira_clientes").select("id,nome,cpf,created_at").eq("owner_id", uid).order("nome"),
    tab("clientes").select("id,nome,valor,juros,data_emprestimo,data_pagamento,parcelas,parcela_atual").eq("user_id", uid).order("data_pagamento"),
    tab("wallets").select("saldo").eq("user_id", uid).maybeSingle(),
    tab("financeiro").select("id,descricao,valor,tipo,status,data_vencimento").eq("user_id", uid).order("data_vencimento", { ascending: false }),
    tab("cartao_itens").select("id,cartao,descricao,valor,data_compra").eq("user_id", uid).order("data_compra", { ascending: false }),
    tab("delay_clientes").select("id,nome,casa,status,depositos,saques,lucro").eq("user_id", uid).order("created_at", { ascending: false }),
    tab("delay_transacoes").select("lucro").eq("user_id", uid),
    tab("bank_balances").select("banco,saldo").eq("user_id", uid).order("banco"),
    tab("colaboradores").select("id,nome,token,ativo").eq("owner_user_id", uid).order("nome"),
    tab("app_config").select("valor").eq("chave", `anotacoes_${uid}`).maybeSingle(),
  ]);
  // cadastros de Laudos: os que a pessoa criou e os que chegaram pelos colaboradores dela
  const tokens = ((colaboradores.data || []) as any[]).map(c => c.token).filter(Boolean);
  const filtro = [`owner_user_id.eq.${uid}`, ...(tokens.length ? [`colaborador_token.in.(${tokens.join(",")})`] : [])].join(",");
  const cadastros = await tab("cac_cadastros").select("id,nome,cpf,created_at").or(filtro).order("created_at", { ascending: false });
  const tr = (delayTr.data || []) as any[];
  return {
    armas: armas.data || [], carteira: carteira.data || [], emprestimos: emprestimos.data || [],
    carteiraSaldo: Number(wallet.data?.saldo || 0),
    financeiro: financeiro.data || [], cartao: cartao.data || [],
    delayClientes: delayClientes.data || [], delayTransacoes: tr.length, delayLucro: tr.reduce((s, t) => s + Number(t.lucro || 0), 0),
    bancos: bancos.data || [], cadastros: cadastros.data || [], colaboradores: colaboradores.data || [],
    anotacoes: (anot.data?.valor?.listas || []) as Dados["anotacoes"],
  };
}

function Numero({ titulo, valor, sub }: { titulo: string; valor: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] text-foreground/75">{titulo}</p>
      <p className="text-lg font-bold">{valor}</p>
      {sub && <p className="text-[11px] text-foreground/75">{sub}</p>}
    </div>
  );
}

function Lista({ linhas, vazio }: { linhas: React.ReactNode[]; vazio: string }) {
  if (!linhas.length) return <p className="text-sm text-foreground/75 py-6 text-center">{vazio}</p>;
  return <div className="divide-y rounded-lg border">{linhas}</div>;
}
const Linha = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 px-3 py-2 text-sm">{children}</div>
);

export function PainelUsuario({ usuario, onClose }: { usuario: { user_id: string; nome?: string | null; email?: string | null } | null; onClose: () => void }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!usuario) return;
    setDados(null); setErro(""); setBusca("");
    carregar(usuario.user_id).then(setDados).catch(e => setErro(e?.message || "Não consegui carregar."));
  }, [usuario?.user_id]);

  const q = norm(busca);
  const filtra = <T extends { nome?: string; cpf?: string; descricao?: string }>(l: T[]) =>
    !q ? l : l.filter(x => norm(`${x.nome ?? ""} ${x.cpf ?? ""} ${x.descricao ?? ""}`).includes(q));

  const d = dados;
  const emAberto = d ? d.financeiro.filter(f => f.status !== "paga") : [];
  const totalEmprestado = d ? d.emprestimos.reduce((s, c) => s + Number(c.valor || 0), 0) : 0;

  return (
    <Dialog open={!!usuario} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" /> Painel de {usuario?.nome || usuario?.email || "usuário"}</DialogTitle>
          <DialogDescription>Só para ver: nada aqui muda os dados do usuário. {usuario?.email}</DialogDescription>
        </DialogHeader>

        {erro ? <p className="text-sm text-destructive">{erro}</p> : !d ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-foreground/75"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Numero titulo="Clientes Armas" valor={d.armas.length} />
              <Numero titulo="Carteira Digital" valor={d.carteira.length} />
              <Numero titulo="Empréstimos" valor={d.emprestimos.length} sub={brl(totalEmprestado)} />
              <Numero titulo="Contas em aberto" valor={emAberto.length} sub={brl(emAberto.reduce((s, f) => s + Number(f.valor || 0), 0))} />
              <Numero titulo="Delay: contas" valor={d.delayClientes.length} sub={`${d.delayTransacoes} lançamentos`} />
              <Numero titulo="Delay: lucro" valor={brl(d.delayLucro)} />
              <Numero titulo="Laudos: cadastros" valor={d.cadastros.length} sub={`${d.colaboradores.length} colaborador(es)`} />
              <Numero titulo="Anotações" valor={d.anotacoes.reduce((s, l) => s + (l.itens?.length || 0), 0)} sub={`${d.anotacoes.length} lista(s)`} />
            </div>

            <Input className="h-9 text-sm" placeholder="Buscar nome ou CPF…" value={busca} onChange={e => setBusca(e.target.value)} />

            <Tabs defaultValue="armas">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="armas">Clientes Armas</TabsTrigger>
                <TabsTrigger value="carteira">Carteira</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                <TabsTrigger value="emprestimos">Empréstimos</TabsTrigger>
                <TabsTrigger value="delay">Delay</TabsTrigger>
                <TabsTrigger value="laudos">Laudos</TabsTrigger>
                <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
              </TabsList>

              <TabsContent value="armas">
                <Lista vazio="Nenhum cliente." linhas={filtra(d.armas).map(c => (
                  <Linha key={c.id}><span className="flex-1 font-medium">{c.nome}</span><span className="text-xs text-foreground/75">{c.cpf || "Sem CPF"}</span>
                    <Badge variant="outline" className="text-[10px]">{STATUS_CAC[c.status] || c.status || "—"}</Badge></Linha>
                ))} />
              </TabsContent>

              <TabsContent value="carteira">
                <Lista vazio="Nenhum cliente na Carteira Digital." linhas={filtra(d.carteira).map(c => (
                  <Linha key={c.id}><span className="flex-1 font-medium">{c.nome}</span><span className="text-xs text-foreground/75">{c.cpf || "Sem CPF"}</span>
                    <span className="text-xs text-foreground/75">{dataBr(c.created_at)}</span></Linha>
                ))} />
              </TabsContent>

              <TabsContent value="financeiro" className="space-y-3">
                <Lista vazio="Nenhuma conta." linhas={filtra(d.financeiro).map(f => (
                  <Linha key={f.id}><span className="flex-1">{f.descricao}</span><span className="text-xs text-foreground/75">{dataBr(f.data_vencimento)}</span>
                    <Badge variant="outline" className={`text-[10px] ${f.status === "paga" ? "text-green-400" : "text-yellow-400"}`}>{f.status === "paga" ? "Paga" : "Em aberto"}</Badge>
                    <span className="w-28 text-right font-medium">{brl(f.valor)}</span></Linha>
                ))} />
                {d.cartao.length > 0 && <>
                  <p className="text-xs font-semibold">Cartão de crédito</p>
                  <Lista vazio="" linhas={filtra(d.cartao).map(c => (
                    <Linha key={c.id}><span className="flex-1">{c.descricao}</span><span className="text-xs text-foreground/75">{c.cartao}</span>
                      <span className="text-xs text-foreground/75">{dataBr(c.data_compra)}</span><span className="w-28 text-right font-medium">{brl(c.valor)}</span></Linha>
                  ))} />
                </>}
              </TabsContent>

              <TabsContent value="emprestimos">
                <p className="text-xs text-foreground/75 mb-2">Saldo da carteira: <b>{brl(d.carteiraSaldo)}</b></p>
                <Lista vazio="Nenhum empréstimo." linhas={filtra(d.emprestimos).map(c => (
                  <Linha key={c.id}><span className="flex-1 font-medium">{c.nome}</span>
                    <span className="text-xs text-foreground/75">{c.parcelas ? `${c.parcela_atual || 0}/${c.parcelas}` : ""} · vence {dataBr(c.data_pagamento)}</span>
                    <span className="w-28 text-right font-medium">{brl(c.valor)}</span></Linha>
                ))} />
              </TabsContent>

              <TabsContent value="delay" className="space-y-3">
                {d.bancos.length > 0 && <div className="flex flex-wrap gap-2">{d.bancos.map(b => (
                  <Badge key={b.banco} variant="outline" className="text-xs">{b.banco}: {brl(b.saldo)}</Badge>))}</div>}
                <Lista vazio="Nenhuma conta no Delay." linhas={filtra(d.delayClientes).map(c => (
                  <Linha key={c.id}><span className="flex-1 font-medium">{c.nome}</span><span className="text-xs text-foreground/75">{c.casa}</span>
                    <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                    <span className={`w-28 text-right font-medium ${Number(c.lucro) < 0 ? "text-destructive" : "text-green-400"}`}>{brl(c.lucro)}</span></Linha>
                ))} />
              </TabsContent>

              <TabsContent value="laudos" className="space-y-3">
                {d.colaboradores.length > 0 && <div className="flex flex-wrap gap-2">{d.colaboradores.map(c => (
                  <Badge key={c.id} variant="outline" className={`text-xs ${c.ativo ? "" : "opacity-50"}`}>{c.nome}{c.ativo ? "" : " (inativo)"}</Badge>))}</div>}
                <Lista vazio="Nenhum cadastro." linhas={filtra(d.cadastros).map(c => (
                  <Linha key={c.id}><span className="flex-1 font-medium">{c.nome}</span><span className="text-xs text-foreground/75">{c.cpf || "Sem CPF"}</span>
                    <span className="text-xs text-foreground/75">{dataBr(c.created_at)}</span></Linha>
                ))} />
              </TabsContent>

              <TabsContent value="anotacoes">
                {!d.anotacoes.length ? <p className="text-sm text-foreground/75 py-6 text-center">Nenhuma anotação.</p> : (
                  <div className="grid gap-3 sm:grid-cols-2">{d.anotacoes.map((l, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <p className="font-semibold text-primary text-sm mb-1">{l.nome} <span className="text-[11px] text-foreground/75">({l.itens?.length || 0})</span></p>
                      {(l.itens || []).filter(it => !q || norm(it.texto).includes(q)).map((it, j) => (
                        <p key={j} className={`text-sm ${it.feito ? "line-through text-foreground/60" : ""}`}>{it.texto}</p>))}
                    </div>))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
