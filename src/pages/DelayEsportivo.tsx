import { useState, useEffect, useMemo, useRef, useCallback } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth } from "date-fns";

import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Search, Plus, Wallet, ArrowDownCircle, ArrowUpCircle, History, TrendingUp,
  Users, Copy, Eye, EyeOff, MoreHorizontal, Pencil, Trash2, SortAsc, ChevronsUpDown, Check, Info,
  DollarSign, Clock, RotateCcw, CalendarDays, Download, CheckSquare, Square, Camera, LayoutGrid, Columns2,
  Building2, Share2, Link, List, ChevronDown, StickyNote, Undo2
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { CASAS_APOSTAS, getCasaLogo } from "@/lib/casas-apostas";

interface DelayCliente {
  id: string;
  user_id: string;
  nome: string;
  casa: string;
  login: string | null;
  senha: string | null;
  fornecedor: string | null;
  status: string;
  operacao: string;
  tipo: string | null;
  depositos: number;
  saques: number;
  custos: number;
  lucro: number;
  created_at: string;
  sort_order?: number;
  deposito_pendente?: number;
  banco_deposito?: string;
  created_by_token?: string | null;
  informacoes_adicionais?: string | null;
  data_deposito?: string | null;
  link_visualizacao?: string | null;
}

interface DelayTransacao {
  id: string;
  cliente_id: string;
  user_id: string;
  tipo: string;
  valor: number;
  custo: number;
  lucro: number;
  casa: string;
  dividir_lucro: boolean;
  data_transacao: string;
  created_at: string;
}

type Periodo = "diario" | "semanal" | "mensal";
type FiltroStatus = "todos" | "ativos" | "concluidos";

const formatFornecedorLabel = (fornecedor: string | null | undefined) => {
  const value = fornecedor?.trim();

  if (!value) return "Sem fornecedor";

  return value.toUpperCase().startsWith("FORNECEDOR")
    ? value.toUpperCase()
    : `FORNECEDOR ${value.toUpperCase()}`;
};

const HistoricoGeralDialog = ({ clientes, open, onOpenChange, fmt }: { clientes: DelayCliente[]; open: boolean; onOpenChange: (open: boolean) => void; fmt: (v: number) => string }) => {
  const { toast } = useToast();
  const [transacoes, setTransacoes] = useState<DelayTransacao[]>([]);
  const [walletTrans, setWalletTrans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroMes, setFiltroMes] = useState("todos");
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeTab, setActiveTab] = useState<"clientes" | "caixa">("clientes");

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const [{ data: delayData }, { data: walletData }] = await Promise.all([
        supabase.from("delay_transacoes").select("*").order("created_at", { ascending: false }),
        supabase.from("wallet_transactions").select("*").eq("origem", "delay").order("created_at", { ascending: false }),
      ]);
      setTransacoes((delayData as unknown as DelayTransacao[]) || []);
      setWalletTrans(walletData || []);
      setLoading(false);
    };
    load();
  }, [open]);

  const getNomeCliente = (clienteId: string) => {
    const c = clientes.find(cl => cl.id === clienteId);
    return c?.nome || "Desconhecido";
  };

  const mesesDisponiveis = useMemo(() => {
    const set = new Set(transacoes.map(t => t.data_transacao.substring(0, 7)));
    return Array.from(set).sort().reverse();
  }, [transacoes]);

  const transacoesFiltradas = useMemo(() => {
    if (filtroMes === "todos") return transacoes;
    return transacoes.filter(t => t.data_transacao.startsWith(filtroMes));
  }, [transacoes, filtroMes]);

  const resumo = useMemo(() => {
    const depositos = transacoesFiltradas.filter(t => t.tipo === "deposito").reduce((a, t) => a + t.valor, 0);
    const saques = transacoesFiltradas.filter(t => t.tipo === "saque" || t.tipo === "devolucao").reduce((a, t) => a + t.valor, 0);
    const lucro = transacoesFiltradas.filter(t => t.tipo === "saque" || t.tipo === "devolucao").reduce((a, t) => a + t.lucro, 0);
    return { depositos, saques, lucro };
  }, [transacoesFiltradas]);

  const handleClearHistory = async () => {
    if (activeTab === "clientes") {
      await supabase.from("delay_transacoes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      // Ao limpar histórico de clientes, zera os acumulados derivados de saque/custo/lucro
      await supabase
        .from("delay_clientes")
        .update({ saques: 0, custos: 0, lucro: 0 })
        .neq("status", "system");
      setTransacoes([]);
    } else {
      await supabase.from("wallet_transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      setWalletTrans([]);
    }
    setConfirmClear(false);
    toast({ title: "Histórico limpo!" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Histórico de Movimentações
          </DialogTitle>
          <DialogDescription className="sr-only">Histórico de todas as transações do delay esportivo</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          <button
            className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-colors ${activeTab === "clientes" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("clientes")}
          >
            <Users className="h-3.5 w-3.5 inline mr-1" /> Clientes
          </button>
          <button
            className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-colors ${activeTab === "caixa" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("caixa")}
          >
            <Wallet className="h-3.5 w-3.5 inline mr-1" /> Caixa
          </button>
        </div>

        {activeTab === "clientes" ? (
          <>
            {/* Filter + Clear */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Select value={filtroMes} onValueChange={setFiltroMes}>
                  <SelectTrigger className="h-8 w-[170px] text-xs">
                    <SelectValue placeholder="Filtrar mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os meses</SelectItem>
                    {mesesDisponiveis.map(m => {
                      const [y, mo] = m.split("-");
                      const label = format(new Date(Number(y), Number(mo) - 1), "MMMM yyyy", { locale: ptBR });
                      return <SelectItem key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                {filtroMes !== "todos" && (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setFiltroMes("todos")}>Limpar</Button>
                )}
              </div>
              {transacoes.length > 0 && (
                <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-1.5 text-xs">
                      <Trash2 className="h-3.5 w-3.5" /> Limpar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar histórico de clientes?</AlertDialogTitle>
                      <AlertDialogDescription>Todos os registros serão removidos permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Depósitos</p>
                <p className="text-sm font-bold font-mono text-primary">{fmt(resumo.depositos)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saques</p>
                <p className="text-sm font-bold font-mono text-emerald-500">{fmt(resumo.saques)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lucro Total</p>
                <p className={`text-sm font-bold font-mono ${resumo.lucro >= 0 ? "text-primary" : "text-destructive"}`}>
                  {fmt(resumo.lucro)}
                </p>
              </div>
            </div>

            {/* Transaction List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Movimentações</p>
                <span className="text-xs text-muted-foreground">{transacoesFiltradas.length} registro(s)</span>
              </div>
              {loading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
              ) : transacoesFiltradas.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma transação no período.</p>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {transacoesFiltradas.map(t => (
                    <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3">
                      <div className={`rounded-full p-2 shrink-0 ${t.tipo === "deposito" ? "bg-primary/10" : t.tipo === "devolucao" ? "bg-warning/10" : "bg-emerald-500/10"}`}>
                        {t.tipo === "deposito" ? (
                          <ArrowDownCircle className="h-4 w-4 text-primary" />
                        ) : t.tipo === "devolucao" ? (
                          <RotateCcw className="h-4 w-4 text-warning" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{t.tipo === "deposito" ? "Depósito" : t.tipo === "devolucao" ? "Devolução" : "Saque"}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {format(new Date(t.data_transacao + "T12:00:00"), "dd/MM/yyyy")} • {t.casa}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{getNomeCliente(t.cliente_id)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold font-mono ${t.tipo === "deposito" ? "text-destructive" : t.tipo === "devolucao" ? "text-warning" : "text-emerald-500"}`}>
                          {t.tipo === "deposito" ? "−" : t.tipo === "devolucao" ? "↩ " : "+"}{fmt(t.valor)}
                        </p>
                        {t.tipo === "saque" && t.lucro > 0 && (
                          <p className="text-[10px] text-muted-foreground">Lucro: {fmt(t.lucro)}</p>
                        )}
                        {t.tipo === "devolucao" && (
                          <p className="text-[10px] text-warning">Devolvido</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Caixa Tab */}
            <div className="flex items-center justify-end">
              {walletTrans.length > 0 && (
                <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-1.5 text-xs">
                      <Trash2 className="h-3.5 w-3.5" /> Limpar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar histórico da caixa?</AlertDialogTitle>
                      <AlertDialogDescription>Todos os registros de depósitos e retiradas da caixa serão removidos.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Depósitos e Retiradas</p>
                <span className="text-xs text-muted-foreground">{walletTrans.length} registro(s)</span>
              </div>
              {loading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
              ) : walletTrans.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma transação na caixa.</p>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {walletTrans.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3">
                      <div className={`rounded-full p-2 shrink-0 ${t.tipo === "deposito" ? "bg-primary/10" : "bg-destructive/10"}`}>
                        {t.tipo === "deposito" ? (
                          <ArrowDownCircle className="h-4 w-4 text-primary" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{t.tipo === "deposito" ? "Depósito" : "Retirada"}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {format(new Date(t.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold font-mono ${t.tipo === "deposito" ? "text-primary" : "text-destructive"}`}>
                          {t.tipo === "deposito" ? "+" : "−"}{fmt(t.valor)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Saldo: {fmt(t.saldo_posterior)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};


const DelayEsportivo = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [clientes, setClientes] = useState<DelayCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("ativos");
  const [filtroCasa, setFiltroCasa] = useState("todas");
  const [periodo, setPeriodo] = useState<Periodo>("diario");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showSenha, setShowSenha] = useState<Record<string, boolean>>({});
  const [hideAllCredentials, setHideAllCredentials] = useState(false);
  const [sortMode, setSortMode] = useState<"recentes" | "az">("az");
  const [showSearch, setShowSearch] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [layoutCols, setLayoutCols] = useState<3 | 4>(3);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  
  const [filtroDataSaque, setFiltroDataSaque] = useState<Date | undefined>(undefined);
  const [filtroDataSaqueOpen, setFiltroDataSaqueOpen] = useState(false);
  const [filtroNick, setFiltroNick] = useState<string>("todos");
  const [showPendentes, setShowPendentes] = useState(false);
  const [showDevolvidas, setShowDevolvidas] = useState(false);
  const [showConcluidas, setShowConcluidas] = useState(false);
  const [showRed, setShowRed] = useState(false);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCliente, setEditCliente] = useState<DelayCliente | null>(null);
  const [deleteCliente, setDeleteCliente] = useState<DelayCliente | null>(null);

  // Deposit/Withdraw dialog
  const [transDialog, setTransDialog] = useState<{ type: "deposito" | "saque"; cliente: DelayCliente } | null>(null);
  const [transValor, setTransValor] = useState("");
  const [transCusto, setTransCusto] = useState("");
  const [transDividirLucro, setTransDividirLucro] = useState(true);
  const [transData, setTransData] = useState<Date>(new Date());
  const [transCasa, setTransCasa] = useState("");
  const [transDestino, setTransDestino] = useState<"santander" | "c6">("santander");

  // Wallet-level dialogs
  const [walletDialog, setWalletDialog] = useState<"depositar" | "retirar" | null>(null);
  const [walletValor, setWalletValor] = useState("");
  const [showHistorico, setShowHistorico] = useState(false);
  const [confirmZerar, setConfirmZerar] = useState(false);
  const [showDepositChoice, setShowDepositChoice] = useState<"depositar" | "retirar" | null>(null);

  // Approve deposit with link selection
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approveCliente, setApproveCliente] = useState<DelayCliente | null>(null);
  const [approveLinkChoice, setApproveLinkChoice] = useState<string>("_admin");

  // Bank balances
  const [bankBalances, setBankBalances] = useState<{ santander: number; c6: number }>({ santander: 0, c6: 0 });
  const [bankDialog, setBankDialog] = useState<{ banco: string; tipo: "depositar" | "retirar" } | null>(null);
  const [bankValor, setBankValor] = useState("");

  // History dialog
  const [historicoCliente, setHistoricoCliente] = useState<DelayCliente | null>(null);
  const [transacoes, setTransacoes] = useState<DelayTransacao[]>([]);
  const [allTransacoes, setAllTransacoes] = useState<DelayTransacao[]>([]);
  const [loadingTransacoes, setLoadingTransacoes] = useState(false);
  const [editTransacao, setEditTransacao] = useState<DelayTransacao | null>(null);
  const [editTransValor, setEditTransValor] = useState("");
  const [editTransCusto, setEditTransCusto] = useState("");
  const [editTransData, setEditTransData] = useState<Date>(new Date());
  const [deleteTransacao, setDeleteTransacao] = useState<DelayTransacao | null>(null);

  // Share link state
  const [shareLinks, setShareLinks] = useState<Array<{ id: string; token: string; nick: string | null; ativo: boolean; created_at: string; tipo: string }>>([]);
  const [shareLinkDialogOpen, setShareLinkDialogOpen] = useState(false);
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [newLinkNick, setNewLinkNick] = useState("");

  // Notepad state
  const [notaOpen, setNotaOpen] = useState(false);
  const [notaConteudo, setNotaConteudo] = useState("");
  const [notaHistory, setNotaHistory] = useState<string[]>([]);
  const [notaId, setNotaId] = useState<string | null>(null);
  const [notaSaving, setNotaSaving] = useState(false);
  const [notaLoading, setNotaLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    nome: "", casa: "Bet365", login: "", senha: "", fornecedor: "", tipo: "50/50", status: "ativo", operacao: "operando", informacoes_adicionais: "", link_visualizacao: "" as string
  });
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [depositoInicial, setDepositoInicial] = useState("");
  const [depositoBanco, setDepositoBanco] = useState<"santander" | "c6">("santander");
  const [casaPopoverOpen, setCasaPopoverOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const processingRef = useRef(false);

  // Notepad: fetch on open
  useEffect(() => {
    if (!notaOpen || !user) return;
    const loadNota = async () => {
      setNotaLoading(true);
      const { data } = await supabase
        .from("delay_notas")
        .select("id, conteudo")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setNotaId(data.id);
        setNotaConteudo(data.conteudo || "");
        setNotaHistory([data.conteudo || ""]);
      } else {
        setNotaId(null);
        setNotaConteudo("");
        setNotaHistory([""]);
      }
      setNotaLoading(false);
    };
    loadNota();
  }, [notaOpen, user]);

  const handleSaveNota = async () => {
    if (!user) return;
    setNotaSaving(true);
    try {
      if (notaId) {
        await supabase.from("delay_notas").update({ conteudo: notaConteudo, updated_at: new Date().toISOString() } as any).eq("id", notaId);
      } else {
        const { data } = await supabase.from("delay_notas").insert({ user_id: user.id, conteudo: notaConteudo } as any).select("id").single();
        if (data) setNotaId(data.id);
      }
      setNotaHistory(prev => [...prev, notaConteudo]);
      toast({ title: "Nota salva!" });
    } catch {
      toast({ title: "Erro ao salvar nota", variant: "destructive" });
    } finally {
      setNotaSaving(false);
    }
  };

  const handleUndoNota = () => {
    if (notaHistory.length > 1) {
      const prev = [...notaHistory];
      prev.pop();
      setNotaConteudo(prev[prev.length - 1]);
      setNotaHistory(prev);
    }
  };

  const recalcClientFromTransactions = async (clienteId: string) => {
    const { data: txns } = await supabase
      .from("delay_transacoes")
      .select("tipo, valor, custo, lucro")
      .eq("cliente_id", clienteId);
    const rows = (txns || []) as { tipo: string; valor: number; custo: number; lucro: number }[];
    const totalSaques = rows.filter(r => r.tipo === "saque" || r.tipo === "devolucao").reduce((a, r) => a + Number(r.valor || 0), 0);
    const totalCustos = rows.filter(r => r.tipo === "saque" || r.tipo === "devolucao").reduce((a, r) => a + Number(r.custo || 0), 0);
    const totalLucro = rows.filter(r => r.tipo === "saque" || r.tipo === "devolucao").reduce((a, r) => a + Number(r.lucro || 0), 0);
    await supabase.from("delay_clientes").update({
      saques: Math.max(0, totalSaques),
      custos: Math.max(0, totalCustos),
      lucro: totalSaques > 0 ? totalLucro : 0,
    }).eq("id", clienteId);
  };

  const fetchBankBalances = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bank_balances")
      .select("banco, saldo")
      .eq("user_id", user.id);
    
    const balances = { santander: 0, c6: 0 };
    if (data) {
      data.forEach((b: any) => {
        if (b.banco === "santander") balances.santander = Number(b.saldo);
        if (b.banco === "c6") balances.c6 = Number(b.saldo);
      });
    }
    setBankBalances(balances);
  };

  // Currency input helpers
  const parseCurrency = (val: string): number => {
    if (!val) return 0;
    let str = val.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrencyInput = (raw: string): string => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    const cents = parseInt(digits, 10);
    const reais = (cents / 100).toFixed(2);
    const [intPart, decPart] = reais.split(".");
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formatted},${decPart}`;
  };

  const handleBankOperation = async () => {
    if (!bankDialog || !bankValor || !user) return;
    const valor = parseCurrency(bankValor);
    if (valor <= 0) return;
    const { banco, tipo } = bankDialog;

    const currentBalance = banco === "santander" ? bankBalances.santander : bankBalances.c6;
    const newBalance = tipo === "depositar" ? currentBalance + valor : currentBalance - valor;

    // Update bank balance
    const { data: existing } = await supabase
      .from("bank_balances")
      .select("id")
      .eq("user_id", user.id)
      .eq("banco", banco)
      .maybeSingle();

    if (existing) {
      await supabase.from("bank_balances").update({ saldo: newBalance, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("bank_balances").insert({ user_id: user.id, banco, saldo: newBalance });
    }

    setBankBalances(prev => ({ ...prev, [banco]: newBalance }));
    setBankDialog(null);
    setBankValor("");
    await fetchClientes();
    toast({ title: tipo === "depositar" ? "Depósito realizado!" : "Retirada realizada!", description: `${banco === "santander" ? "Santander" : "C6"}: ${fmt(newBalance)}` });
  };

  const fetchClientes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("delay_clientes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Erro ao carregar clientes", description: getSafeErrorMessage(error), variant: "destructive" });
        return;
      }

      setClientes((data as unknown as DelayCliente[]) || []);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchAllTransacoes = useCallback(async () => {
    const { data } = await supabase
      .from("delay_transacoes")
      .select("*")
      .order("created_at", { ascending: false });

    setAllTransacoes((data as unknown as DelayTransacao[]) || []);
  }, []);

  const refreshDelayEsportivoData = useCallback(async () => {
    await Promise.all([fetchClientes(), fetchAllTransacoes()]);
  }, [fetchClientes, fetchAllTransacoes]);

  useEffect(() => {
    if (!user) return;

    void refreshDelayEsportivoData();

    const channel = supabase
      .channel(`delay_clientes_realtime_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delay_clientes" },
        () => {
          void refreshDelayEsportivoData();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void refreshDelayEsportivoData();
        }
      });

    const intervalId = window.setInterval(() => {
      void refreshDelayEsportivoData();
    }, 4000);

    const handleWindowFocus = () => {
      void refreshDelayEsportivoData();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshDelayEsportivoData();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [user, refreshDelayEsportivoData]);

  useEffect(() => {
    if (user) fetchBankBalances();
  }, [user]);

  const handleApproveDeposit = async (cliente: DelayCliente) => {
    if (!user || !cliente.deposito_pendente || cliente.deposito_pendente <= 0) return;
    setApproveCliente(cliente);
    setApproveLinkChoice(cliente.link_visualizacao || "_admin");
    setApproveDialogOpen(true);
  };

  const confirmApproveDeposit = async () => {
    if (!user || !approveCliente) return;
    const cliente = approveCliente;
    const depositoVal = cliente.deposito_pendente || 0;
    const banco = cliente.banco_deposito || "santander";
    const linkVal = approveLinkChoice === "_admin" ? null : approveLinkChoice;

    const { error: updateError } = await supabase
      .from("delay_clientes")
      .update({ depositos: depositoVal, deposito_pendente: 0, data_deposito: new Date().toISOString(), link_visualizacao: linkVal } as any)
      .eq("id", cliente.id);

    if (updateError) {
      toast({ title: "Erro ao aprovar depósito", description: getSafeErrorMessage(updateError), variant: "destructive" });
      return;
    }

    // Deduct from bank
    const { data: existingBank } = await supabase
      .from("bank_balances")
      .select("id, saldo")
      .eq("user_id", user.id)
      .eq("banco", banco)
      .maybeSingle();
    if (existingBank) {
      const newBalance = (existingBank.saldo || 0) - depositoVal;
      await supabase.from("bank_balances").update({ saldo: newBalance, updated_at: new Date().toISOString() }).eq("id", existingBank.id);
      setBankBalances(prev => ({ ...prev, [banco]: newBalance }));
    } else {
      await supabase.from("bank_balances").insert({ user_id: user.id, banco, saldo: -depositoVal });
      setBankBalances(prev => ({ ...prev, [banco]: -depositoVal }));
    }

    toast({ title: "Depósito aprovado!", description: `R$ ${depositoVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} debitado de ${banco === "santander" ? "Santander" : "C6 Bank"}` });
    setApproveDialogOpen(false);
    setApproveCliente(null);
    fetchClientes();
    fetchBankBalances();
  };
  };

  const handleRejectDeposit = async (cliente: DelayCliente) => {
    const { error } = await supabase
      .from("delay_clientes")
      .update({ deposito_pendente: 0 })
      .eq("id", cliente.id);

    if (error) {
      toast({ title: "Erro ao rejeitar", description: getSafeErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Depósito rejeitado", description: "O valor pendente foi removido." });
    fetchClientes();
  };


  const periodStats = useMemo(() => {
    const now = new Date();
    let startStr: string;
    let endStr: string | null = null;
    if (periodo === "diario") {
      const day = selectedDate || now;
      startStr = format(startOfDay(day), "yyyy-MM-dd");
      endStr = startStr; // exact day match
    } else if (periodo === "semanal") {
      startStr = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    } else {
      startStr = format(startOfMonth(now), "yyyy-MM-dd");
    }

    const clienteIds = new Set(clientes.filter(c => c.status !== "system").map(c => c.id));
    const filtered = allTransacoes.filter(t => {
      if (!clienteIds.has(t.cliente_id)) return false;
      if (endStr) return t.data_transacao === startStr;
      return t.data_transacao >= startStr;
    });
    const depositos = filtered.filter(t => t.tipo === "deposito").reduce((a, t) => a + t.valor, 0);
    const saques = filtered.filter(t => t.tipo === "saque" || t.tipo === "devolucao").reduce((a, t) => a + t.valor, 0);
    const custos = filtered.filter(t => t.tipo === "saque" || t.tipo === "devolucao").reduce((a, t) => a + t.custo, 0);
    const lucro = filtered.filter(t => (t.tipo === "saque" || t.tipo === "devolucao") && t.lucro > 0).reduce((a, t) => a + t.lucro, 0);
    const totalTrans = filtered.length;

    return { depositos, saques, custos, lucro, totalTrans };
  }, [allTransacoes, periodo, clientes, selectedDate]);

  const fetchTransacoes = async (clienteId: string) => {
    setLoadingTransacoes(true);
    const { data, error } = await supabase
      .from("delay_transacoes")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    if (!error) setTransacoes((data as unknown as DelayTransacao[]) || []);
    setLoadingTransacoes(false);
  };

  const openHistorico = (c: DelayCliente) => {
    setHistoricoCliente(c);
    fetchTransacoes(c.id);
  };

  const handleDeleteTransacao = async () => {
    if (!deleteTransacao || !historicoCliente) return;
    const t = deleteTransacao;

    const { error: deleteError } = await supabase.from("delay_transacoes").delete().eq("id", t.id);
    if (deleteError) {
      toast({ title: "Erro", description: getSafeErrorMessage(deleteError), variant: "destructive" });
      return;
    }

    if (t.tipo === "deposito") {
      const cliente = clientes.find(c => c.id === t.cliente_id);
      if (cliente) {
        await supabase.from("delay_clientes")
          .update({ depositos: Math.max(0, cliente.depositos - t.valor) })
          .eq("id", cliente.id);
      }
    } else {
      // Recalculate client aggregates only, do NOT reverse bank credit
      await recalcClientFromTransactions(t.cliente_id);
    }

    toast({ title: "Transação removida!" });
    setDeleteTransacao(null);
    fetchTransacoes(historicoCliente.id);
    await fetchClientes();
    await fetchAllTransacoes();
    await fetchBankBalances();
  };

  const handleEditTransacao = async () => {
    if (!editTransacao || !historicoCliente) return;
    const novoValor = parseFloat(editTransValor);
    if (isNaN(novoValor) || novoValor <= 0) return;
    const novoCusto = parseFloat(editTransCusto) || 0;
    const t = editTransacao;
    const cliente = clientes.find(c => c.id === t.cliente_id);

    if (t.tipo === "deposito") {
      if (cliente) {
        await supabase.from("delay_clientes").update({
          depositos: Math.max(0, cliente.depositos - t.valor) + novoValor
        }).eq("id", cliente.id);
      }
      await supabase.from("delay_transacoes").update({ valor: novoValor, data_transacao: format(editTransData, "yyyy-MM-dd") } as any).eq("id", t.id);
    } else {
      // Calculate old credited amount to bank: depositos + old lucro
      const oldCredited = (cliente?.depositos || 0) + t.lucro;
      
      const lucroSaque = novoValor - (cliente?.depositos || 0) - novoCusto;
      const novoLucro = (t.dividir_lucro && lucroSaque > 0) ? lucroSaque / 2 : lucroSaque;
      
      // Calculate new credited amount: depositos + new lucro
      const newCredited = (cliente?.depositos || 0) + novoLucro;
      const diff = newCredited - oldCredited;
      
      await supabase.from("delay_transacoes").update({ valor: novoValor, custo: novoCusto, lucro: novoLucro, data_transacao: format(editTransData, "yyyy-MM-dd") } as any).eq("id", t.id);
      await recalcClientFromTransactions(t.cliente_id);
      
      // Adjust bank balance by the difference using banco_destino
      const bancoDestino = (t as any).banco_destino as "santander" | "c6" | null;
      if (diff !== 0 && bancoDestino) {
        const currentBal = bankBalances[bancoDestino];
        const newBal = Math.max(0, currentBal + diff);
        const { data: existing } = await supabase
          .from("bank_balances")
          .select("id")
          .eq("user_id", user!.id)
          .eq("banco", bancoDestino)
          .maybeSingle();
        if (existing) {
          await supabase.from("bank_balances").update({ saldo: newBal, updated_at: new Date().toISOString() }).eq("id", existing.id);
          setBankBalances(prev => ({ ...prev, [bancoDestino]: newBal }));
        }
      }
    }

    toast({ title: "Transação atualizada!" });
    setEditTransacao(null);
    fetchTransacoes(historicoCliente.id);
    await fetchClientes();
    await fetchAllTransacoes();
    await fetchBankBalances();
  };

  const casas = useMemo(() => {
    const clientesFiltrados = clientes.filter(c => {
      if (c.status === "system") return false;
      if (!filtroDataSaque) return true;
      return allTransacoes.some(t =>
        t.cliente_id === c.id &&
        (t.tipo === "saque" || t.tipo === "devolucao") &&
        format(new Date(t.data_transacao + "T12:00:00"), "yyyy-MM-dd") === format(filtroDataSaque, "yyyy-MM-dd")
      );
    });
    const set = new Set(clientesFiltrados.map(c => c.casa));
    const arr = Array.from(set).sort();
    // Ensure Superbet appears right after Betano
    const betanoIdx = arr.indexOf("Betano");
    const superbetIdx = arr.indexOf("Superbet");
    if (betanoIdx !== -1 && superbetIdx !== -1 && superbetIdx !== betanoIdx + 1) {
      arr.splice(superbetIdx, 1);
      arr.splice(betanoIdx + 1, 0, "Superbet");
    }
    return arr;
  }, [clientes, filtroDataSaque, allTransacoes]);

  const filtered = useMemo(() => {
    let result = clientes.filter(c => {
      if (c.status === "system") return false;
      const matchBusca = c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (c.login || "").toLowerCase().includes(busca.toLowerCase());
      const matchStatus = filtroStatus === "todos" ||
        (filtroStatus === "ativos" && (c.status === "ativo" || c.status === "saque_pendente")) ||
        (filtroStatus === "concluidos" && c.status === "concluido");
      const matchCasa = filtroCasa === "todas" || c.casa === filtroCasa;
      const matchDataSaque = !filtroDataSaque || allTransacoes.some(t =>
        t.cliente_id === c.id &&
        (t.tipo === "saque" || t.tipo === "devolucao") &&
        t.lucro > 0 &&
        format(new Date(t.data_transacao + "T12:00:00"), "yyyy-MM-dd") === format(filtroDataSaque, "yyyy-MM-dd")
      );
      const matchNick = filtroNick === "todos" ||
        (filtroNick === "direto" && !c.created_by_token) ||
        (c.created_by_token === filtroNick);
      return matchBusca && matchStatus && matchCasa && matchDataSaque && matchNick;
    });
    if (sortMode === "az") {
      result = result.sort((a, b) => {
        // Priorizar Betano antes de Superbet
        if (a.casa === "Betano" && b.casa === "Superbet") return -1;
        if (a.casa === "Superbet" && b.casa === "Betano") return 1;

        // Ordenação alfabética padrão para outras casas
        const casaCompare = a.casa.localeCompare(b.casa, "pt-BR");
        if (casaCompare !== 0) return casaCompare;

        // Ordenação secundária por nome
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
    }
    return result;
  }, [clientes, busca, filtroStatus, filtroCasa, sortMode, filtroDataSaque, allTransacoes, filtroNick]);

  const displayList = useMemo(() => {
    if (showDevolvidas) {
      return clientes.filter(c => c.status === "devolvido");
    }
    if (showConcluidas) {
      return clientes.filter(c => c.status === "concluido");
    }
    if (showRed) {
      return clientes.filter(c => (c.status === "concluido" || c.status === "devolvido") && c.lucro < 0);
    }
    if (showPendentes) {
      return [...filtered].sort((a, b) => {
        const getOrder = (c: DelayCliente) => {
          if (c.status === "saque_pendente") return 0;
          if (c.status === "ativo" && c.operacao === "operando" && (c.deposito_pendente ?? 0) <= 0) return 1;
          if ((c.deposito_pendente ?? 0) > 0) return 2;
          if (c.status === "concluido") return 3;
          return 1;
        };
        return getOrder(a) - getOrder(b);
      });
    }
    return filtered.filter(c => (c.deposito_pendente ?? 0) <= 0).sort((a, b) => {
      const getOrder = (c: DelayCliente) => {
        if (c.status === "saque_pendente") return 0;
        if (c.status === "ativo" && c.operacao === "operando") return 1;
        if (c.status === "concluido") return 3;
        return 1;
      };
      const orderDiff = getOrder(a) - getOrder(b);
      if (orderDiff !== 0) return orderDiff;
      // Secondary: Betano before Superbet, then alphabetical by casa
      if (a.casa === "Betano" && b.casa === "Superbet") return -1;
      if (a.casa === "Superbet" && b.casa === "Betano") return 1;
      return a.casa.localeCompare(b.casa, "pt-BR");
    });
  }, [filtered, clientes, showPendentes, showDevolvidas, showConcluidas, showRed]);

  const stats = useMemo(() => {
    const visibleClientes = clientes.filter(c => c.status !== "system");
    const ativasClientes = visibleClientes.filter(c => c.status === "ativo");
    const totalDepositos = visibleClientes.reduce((a, c) => a + c.depositos, 0);
    const totalSaques = visibleClientes.reduce((a, c) => a + c.saques, 0);
    const totalLucro = visibleClientes.reduce((a, c) => a + (c.lucro > 0 ? c.lucro : 0), 0);
    const totalCustos = visibleClientes.reduce((a, c) => a + c.custos, 0);
    
    // Saldo = dinheiro disponível na carteira
    // Para cada cliente: o depósito saiu da carteira, o saque voltou, custos são gastos, e lucro 50/50 é deduzido
    // Fórmula: saques - depositos - custos - dedução_50_50
    // System client (Caixa): depósitos/retiradas manuais diretos, saldo = saques (já representa valor líquido)
    const saldo = clientes.reduce((acc, c) => {
      if (c.status === "system") {
        return acc + c.saques;
      }
      // Devolução: saques === depositos && lucro === 0 → deposit still subtracted, Caixa holds the refund
      if (c.saques > 0 && c.saques === c.depositos && c.lucro === 0) {
        return acc - c.depositos;
      }
      if (c.saques > 0) {
        return acc + c.lucro;
      }
      return acc - c.depositos;
    }, 0);

    const ativas = visibleClientes.filter(c => c.status === "ativo").length;
    const depositosAtivos = ativasClientes.reduce((a, c) => a + c.depositos, 0);
    const saldoTotal = bankBalances.santander + bankBalances.c6;
    return { totalDepositos, totalSaques, totalLucro, totalCustos, saldo, saldoTotal, total: visibleClientes.length, ativas, depositosAtivos };
  }, [clientes, bankBalances]);

  const exportToXLSX = async () => {
    if (!user) return;

    let startStr = "";
    let endStr = "";
    if (periodo === "diario") {
      const dateFilter = format(selectedDate, "yyyy-MM-dd");
      startStr = dateFilter;
      endStr = dateFilter;
    } else if (periodo === "semanal") {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
      startStr = format(weekStart, "yyyy-MM-dd");
      endStr = format(new Date(weekStart.getTime() + 6 * 86400000), "yyyy-MM-dd");
    } else if (periodo === "mensal") {
      const monthStart = startOfMonth(selectedDate);
      startStr = format(monthStart, "yyyy-MM-dd");
      const nextMonth = new Date(monthStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(0);
      endStr = format(nextMonth, "yyyy-MM-dd");
    }

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Clientes");

    const headers = ["CASAS", "FORNECEDOR", "LOGIN BET", "SENHA BET", "DEPOSITO", "CUSTO", "SAQUE", "LUCRO REAL", "LUCRO PRA 2", "DATA DEP.", "DATA SAQUE", "RESULTADO", "OBSERVAÇÃO"];
    const thinBorder = { style: "thin" as const, color: { argb: "FF000000" } };
    const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3748" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.border = allBorders;
    });

    ws.columns = [
      { width: 18 }, { width: 22 }, { width: 30 }, { width: 18 },
      { width: 14 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 }
    ];

    const { getCasaLogo } = await import("@/lib/casas-apostas");
    const clientesExport = filtered.filter(c => c.status !== "system");
    const logoCache: Record<string, ArrayBuffer | null> = {};
    const uniqueCasas = [...new Set(clientesExport.map(c => c.casa))];
    await Promise.all(uniqueCasas.map(async casa => {
      const logoUrl = getCasaLogo(casa);
      if (!logoUrl) { logoCache[casa] = null; return; }
      try {
        const resp = await fetch(logoUrl);
        if (resp.ok) logoCache[casa] = await resp.arrayBuffer();
        else logoCache[casa] = null;
      } catch { logoCache[casa] = null; }
    }));

    const currencyCols = [5, 6, 7, 8, 9];
    const greenFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFC6EFCE" } };
    const currencyFmt = '"R$"\\ #,##0.00';

    clientesExport.forEach((c, idx) => {
      const clienteTrans = allTransacoes.filter(t => t.cliente_id === c.id);
      const filteredTrans = startStr
        ? clienteTrans.filter(t => t.data_transacao >= startStr && t.data_transacao <= endStr)
        : clienteTrans;

      const depositos = filteredTrans.filter(t => t.tipo === "deposito").reduce((a, t) => a + t.valor, 0);
      const saques = filteredTrans.filter(t => t.tipo === "saque" || t.tipo === "devolucao").reduce((a, t) => a + t.valor, 0);
      const custos = filteredTrans.filter(t => t.tipo === "saque" || t.tipo === "devolucao").reduce((a, t) => a + t.custo, 0);
      const lastSaque = filteredTrans.filter(t => t.tipo === "saque" || t.tipo === "devolucao").sort((a, b) => b.data_transacao.localeCompare(a.data_transacao))[0];
      const lucroReal = saques - depositos - custos;
      const lucroPra2 = (c.tipo === "50/50" && lucroReal > 0) ? lucroReal * 0.5 : lucroReal;

      let resultado = "";
      if (saques === 0) resultado = "";
      else if (saques === depositos) resultado = "DEVOLUÇÃO";
      else if (lucroReal > 0) resultado = "GREEN";
      else if (lucroReal < 0) resultado = "RED";
      else resultado = "SACADA";

      const maskCred = (v: string | null) => {
        if (!v) return "";
        return v.length > 3 ? v.slice(0, 3) + "****" : "****";
      };
      const rowData = [
        `   ${c.casa}`, c.fornecedor || "Sem fornecedor", maskCred(c.login), maskCred(c.senha),
        depositos, custos, saques, lucroReal, lucroPra2,
        format(new Date(c.created_at), "dd/MM/yyyy"),
        lastSaque ? format(new Date(lastSaque.data_transacao + "T12:00:00"), "dd/MM/yyyy") : "-",
        resultado, ""
      ];
      const row = ws.addRow(rowData);
      row.height = 24;

      currencyCols.forEach(ci => { row.getCell(ci).numFmt = currencyFmt; });
      row.eachCell(cell => { cell.border = allBorders; });

      if (resultado === "GREEN") {
        row.eachCell(cell => { cell.fill = greenFill; });
      }

      const logoBuf = logoCache[c.casa];
      if (logoBuf) {
        const imgId = wb.addImage({ buffer: new Uint8Array(logoBuf) as any, extension: "png" });
        ws.addImage(imgId, {
          tl: { col: 0.15, row: idx + 1.15 },
          ext: { width: 16, height: 16 }
        });
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const periodoLabel = periodo === "diario" ? format(selectedDate, "dd-MM-yyyy") : periodo === "semanal" ? `semana-${startStr}` : `mes-${startStr.substring(0, 7)}`;
    a.download = `delay-esportivo-${periodoLabel}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const captureSelectedCards = async () => {
    if (selectedCards.size === 0) { toast({ title: "Selecione ao menos um card", variant: "destructive" }); return; }
    const html2canvas = (await import("html2canvas")).default;
    const cardElements = Array.from(document.querySelectorAll("[data-card-id]"))
      .filter(el => selectedCards.has(el.getAttribute("data-card-id") || "")) as HTMLElement[];
    if (cardElements.length === 0) return;

    const cols = cardElements.length <= 2 ? cardElements.length : 3;

    // Outer wrapper: flex column to stack grid + summary
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `position:absolute;left:-9999px;top:0;display:flex;flex-direction:column;padding:20px;background:#0a0e1a;width:${cols * 600}px;z-index:99999;`;

    // Grid for cards
    const grid = document.createElement("div");
    grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:16px;`;

    cardElements.forEach(el => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("*").forEach(child => {
        const htmlChild = child as HTMLElement;
        htmlChild.style.overflow = "visible";
        htmlChild.style.textOverflow = "unset";
        htmlChild.style.whiteSpace = "normal";
        htmlChild.style.wordBreak = "break-all";
      });
      grid.appendChild(clone);
    });
    wrapper.appendChild(grid);

    // Calculate total profit of selected cards
    const selectedClientIds = Array.from(selectedCards);
    const totalLucroSelecionado = clientes
      .filter(c => selectedClientIds.includes(c.id))
      .reduce((sum, c) => sum + c.lucro, 0);

    // Summary bar below grid
    const summaryBar = document.createElement("div");
    summaryBar.style.cssText = `display:flex;align-items:center;justify-content:center;gap:16px;padding:20px 24px;margin-top:16px;background:#1a1f2e;border-radius:12px;border:1px solid #2a3040;`;
    summaryBar.innerHTML = `
      <span style="font-size:20px;font-weight:600;color:#94a3b8;font-family:sans-serif;">Total de Lucro (${selectedClientIds.length} contas):</span>
      <span style="font-size:28px;font-weight:bold;color:${totalLucroSelecionado >= 0 ? '#22c55e' : '#ef4444'};font-family:sans-serif;">
        ${totalLucroSelecionado >= 0 ? '+' : ''}R$ ${totalLucroSelecionado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </span>
    `;
    wrapper.appendChild(summaryBar);

    document.body.appendChild(wrapper);

    try {
      const canvas = await html2canvas(wrapper, {
        backgroundColor: "#0a0e1a",
        scale: 3,
        useCORS: true,
        logging: false,
        windowWidth: cols * 600 + 40
      });
      const link = document.createElement("a");
      link.download = `delay-cards-${format(new Date(), "yyyy-MM-dd-HHmm")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Print exportado com sucesso!" });
    } catch {
      toast({ title: "Erro ao capturar", variant: "destructive" });
    } finally {
      document.body.removeChild(wrapper);
    }
  };

  const resetForm = () => setForm({ nome: "", casa: "Bet365", login: "", senha: "", fornecedor: "", tipo: "50/50", status: "ativo", operacao: "operando", informacoes_adicionais: "", link_visualizacao: "" });

  const openNewDialog = () => {
    setEditCliente(null);
    resetForm();
    setDepositoInicial("");
    setDepositoBanco("santander");
    setDialogOpen(true);
  };

  const fetchShareLinks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("delay_share_links")
      .select("id, token, nick, ativo, created_at, tipo")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setShareLinks((data as any[]) || []);
  };

  useEffect(() => {
    if (user) fetchShareLinks();
  }, [user]);

  const handleCreateShareLink = async () => {
    if (!user || !newLinkNick.trim()) return;
    setShareLinkLoading(true);
    try {
      const { error } = await supabase
        .from("delay_share_links")
        .insert({ user_id: user.id, nick: newLinkNick.trim() } as any);
      if (error) throw error;
      setNewLinkNick("");
      await fetchShareLinks();
      toast({ title: "Link criado!", description: `Link para "${newLinkNick.trim()}" criado com sucesso.` });
    } catch (err: any) {
      toast({ title: "Erro", description: getSafeErrorMessage(err), variant: "destructive" });
    } finally {
      setShareLinkLoading(false);
    }
  };

  const copyShareLink = (token: string, tipo: string) => {
    const origin = "https://rwinvestimentos.com.br";
    const path = (tipo === "visualizador" || tipo === "visualizador_vodka" || tipo === "visualizador_pessoa") ? "/visualizar-delay" : "/adicionar-cliente";
    const url = `${origin}${path}?token=${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  const handleRevokeShareLink = async (linkId: string) => {
    await supabase.from("delay_share_links").update({ ativo: false }).eq("id", linkId);
    await fetchShareLinks();
    toast({ title: "Link revogado" });
  };

  const handleClearRevokedLinks = async () => {
    const revokedIds = shareLinks.filter(l => !l.ativo).map(l => l.id);
    if (revokedIds.length === 0) return;
    // Nullify FK references in delay_clientes before deleting
    for (const id of revokedIds) {
      await supabase.from("delay_clientes").update({ created_by_token: null }).eq("created_by_token", id);
    }
    const { error } = await supabase.from("delay_share_links").delete().in("id", revokedIds);
    if (error) {
      toast({ title: "Erro ao limpar", description: error.message, variant: "destructive" });
      return;
    }
    await fetchShareLinks();
    toast({ title: "Links revogados removidos" });
  };

  const openEditDialog = (c: DelayCliente) => {
    setEditCliente(c);
    setForm({
      nome: c.nome, casa: c.casa, login: c.login || "", senha: c.senha || "",
      fornecedor: c.fornecedor || "", tipo: c.tipo || "50/50", status: c.status, operacao: c.operacao,
      informacoes_adicionais: c.informacoes_adicionais || "",
      link_visualizacao: c.link_visualizacao || ""
    });
    setEditDate(new Date(c.created_at));
    setDepositoInicial(String(c.depositos || 0));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);

    if (editCliente) {
      const novoDeposito = parseFloat(depositoInicial) || 0;
      const { error } = await supabase.from("delay_clientes")
        .update({ nome: form.nome, casa: form.casa, login: form.login || null, senha: form.senha || null, fornecedor: form.fornecedor || null, tipo: form.tipo, status: form.status, operacao: form.operacao, created_at: editDate.toISOString(), depositos: novoDeposito, informacoes_adicionais: form.informacoes_adicionais || null, link_visualizacao: form.link_visualizacao || null } as any)
        .eq("id", editCliente.id);
      if (error) toast({ title: "Erro", description: getSafeErrorMessage(error), variant: "destructive" });
      else toast({ title: "Cliente atualizado!" });
    } else {
      const depositoVal = parseFloat(depositoInicial) || 0;
      const { data: newCliente, error } = await supabase.from("delay_clientes")
        .insert({ nome: form.nome, casa: form.casa, login: form.login || null, senha: form.senha || null, fornecedor: form.fornecedor || null, tipo: form.tipo, status: form.status, operacao: form.operacao, user_id: user!.id, depositos: depositoVal, banco_deposito: depositoBanco } as any)
        .select().single();
      if (error) toast({ title: "Erro", description: getSafeErrorMessage(error), variant: "destructive" });
      else {
        // Deduct deposit from selected bank
        if (depositoVal > 0) {
          const banco = depositoBanco;
          const currentBalance = banco === "santander" ? bankBalances.santander : bankBalances.c6;
          const newBalance = Math.max(0, currentBalance - depositoVal);

          const { data: existing } = await supabase
            .from("bank_balances")
            .select("id")
            .eq("user_id", user!.id)
            .eq("banco", banco)
            .maybeSingle();

          if (existing) {
            await supabase.from("bank_balances").update({ saldo: newBalance, updated_at: new Date().toISOString() }).eq("id", existing.id);
          } else {
            await supabase.from("bank_balances").insert({ user_id: user!.id, banco, saldo: newBalance });
          }
          setBankBalances(prev => ({ ...prev, [banco]: newBalance }));
        }
        toast({ title: "Cliente adicionado!" });
      }
    }

    setDialogOpen(false);
    setSaving(false);
    fetchClientes();
  };

  const handleDelete = async () => {
    if (!deleteCliente) return;

    const bancoOrigem = (deleteCliente as any).banco_deposito || "santander";
    const depositoVal = deleteCliente.depositos || 0;

    // Fetch deposit and saque transactions before deleting
    const { data: depositTransactions } = await supabase
      .from("delay_transacoes")
      .select("*")
      .eq("cliente_id", deleteCliente.id)
      .eq("tipo", "deposito");

    const { data: saqueTransactions } = await supabase
      .from("delay_transacoes")
      .select("*")
      .eq("cliente_id", deleteCliente.id)
      .in("tipo", ["saque", "devolucao"]);

    // Delete associated transactions first
    await supabase.from("delay_transacoes").delete().eq("cliente_id", deleteCliente.id);
    const { error } = await supabase.from("delay_clientes").delete().eq("id", deleteCliente.id);
    if (error) {
      toast({ title: "Erro", description: getSafeErrorMessage(error), variant: "destructive" });
    } else {
      // Helper to update bank balance by reading fresh value from DB
      const adjustBank = async (banco: string, amount: number) => {
        if (amount === 0) return;
        const { data: existing } = await supabase
          .from("bank_balances")
          .select("id, saldo")
          .eq("user_id", user!.id)
          .eq("banco", banco)
          .maybeSingle();

        if (existing) {
          const newBalance = (existing.saldo || 0) + amount;
          await supabase.from("bank_balances").update({ saldo: newBalance, updated_at: new Date().toISOString() }).eq("id", existing.id);
        } else {
          await supabase.from("bank_balances").insert({ user_id: user!.id, banco, saldo: amount });
        }
      };

      // Return deposit amounts to their respective banks
      if (depositTransactions && depositTransactions.length > 0) {
        for (const dt of depositTransactions) {
          const banco = (dt as any).banco_destino || bancoOrigem;
          await adjustBank(banco, dt.valor);
        }
      } else if (depositoVal > 0) {
        await adjustBank(bancoOrigem, depositoVal);
      }

      // Reverse saque/devolucao bank credits
      if (saqueTransactions && saqueTransactions.length > 0) {
        for (const st of saqueTransactions) {
          const banco = (st as any).banco_destino;
          if (banco) {
            const creditAmount = (deleteCliente.depositos || 0) + st.lucro;
            await adjustBank(banco, -creditAmount);
          }
        }
      }

      toast({ title: "Cliente removido!" });
    }
    setDeleteCliente(null);
    fetchClientes();
    fetchAllTransacoes();
    await fetchBankBalances();
  };

  const handleTransaction = async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const valor = parseFloat(transValor);
      if (isNaN(valor) || valor <= 0) return;

      const { cliente, type } = transDialog;
      let custo = 0;
      let lucroFinal = 0;

      if (type === "deposito") {
        const { error } = await supabase.from("delay_clientes").update({
          depositos: cliente.depositos + valor
        }).eq("id", cliente.id);
        if (error) { toast({ title: "Erro", description: getSafeErrorMessage(error), variant: "destructive" }); return; }

        // Deduct deposit from selected bank
        const banco = transDestino;
        const currentBalance = banco === "santander" ? bankBalances.santander : bankBalances.c6;
        const newBalance = Math.max(0, currentBalance - valor);

        const { data: existing } = await supabase
          .from("bank_balances")
          .select("id")
          .eq("user_id", user!.id)
          .eq("banco", banco)
          .maybeSingle();

        if (existing) {
          await supabase.from("bank_balances").update({ saldo: newBalance, updated_at: new Date().toISOString() }).eq("id", existing.id);
        } else {
          await supabase.from("bank_balances").insert({ user_id: user!.id, banco, saldo: newBalance });
        }
        setBankBalances(prev => ({ ...prev, [banco]: newBalance }));

        toast({ title: "Depósito registrado!" });
      } else {
        const isDevolucao = valor === cliente.depositos;

        if (isDevolucao) {
          const { error } = await supabase.from("delay_clientes").update({
            saques: cliente.saques + valor,
          }).eq("id", cliente.id);
          if (error) { toast({ title: "Erro", description: getSafeErrorMessage(error), variant: "destructive" }); return; }

          toast({ title: "Devolução registrada!", description: `${fmt(valor)} creditado no banco.` });
        } else {
          custo = parseFloat(transCusto) || 0;
          const lucroSaque = valor - cliente.depositos - custo;
          lucroFinal = (transDividirLucro && lucroSaque > 0) ? lucroSaque / 2 : lucroSaque;
          toast({ title: "Saque registrado!" });
        }
      }

      const tipoTransacao = (type === "saque" && valor === cliente.depositos) ? "devolucao" : type;

      // Record transaction in history
      await supabase.from("delay_transacoes").insert({
        cliente_id: cliente.id,
        user_id: user!.id,
        tipo: tipoTransacao,
        valor,
        custo,
        lucro: lucroFinal,
        casa: transCasa || cliente.casa,
        dividir_lucro: transDividirLucro,
        data_transacao: format(transData, "yyyy-MM-dd"),
        banco_destino: (type === "saque" || type === "deposito") ? transDestino : null
      } as any);

      // Recalculate client aggregates from actual transactions (source of truth)
      if (type !== "deposito") {
        await recalcClientFromTransactions(cliente.id);
      }

      // Credit the selected bank account if saque
      if (type === "saque") {
        const banco = transDestino;
        const currentBalance = banco === "santander" ? bankBalances.santander : bankBalances.c6;
        // Always return at least the deposit value; add lucro only if positive
        const creditAmount = lucroFinal > 0 ? cliente.depositos + lucroFinal : cliente.depositos;
        const newBalance = currentBalance + creditAmount;

        const { data: existing } = await supabase
          .from("bank_balances")
          .select("id")
          .eq("user_id", user!.id)
          .eq("banco", banco)
          .maybeSingle();

        if (existing) {
          await supabase.from("bank_balances").update({ saldo: newBalance, updated_at: new Date().toISOString() }).eq("id", existing.id);
        } else {
          await supabase.from("bank_balances").insert({ user_id: user!.id, banco, saldo: newBalance });
        }
        setBankBalances(prev => ({ ...prev, [banco]: newBalance }));
      }

      setTransDialog(null);
      setTransValor("");
      setTransCusto("");
      setTransDividirLucro(true);
      setTransDestino("santander");
      await fetchClientes();
      await fetchAllTransacoes();
    } finally {
      processingRef.current = false;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const toggleSelectCard = (id: string) => {
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const ids = filtered.filter(c => c.status !== "system").map(c => c.id);
    if (selectedCards.size === ids.length) setSelectedCards(new Set());
    else setSelectedCards(new Set(ids));
  };

  const exportSelectedToXLSX = async () => {
    const selected = filtered.filter(c => selectedCards.has(c.id));
    if (selected.length === 0) { toast({ title: "Selecione ao menos um card", variant: "destructive" }); return; }

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Selecionados");

    const headers = ["CASAS", "FORNECEDOR", "LOGIN BET", "SENHA BET", "DEPOSITO", "CUSTO", "SAQUE", "LUCRO REAL", "LUCRO PRA 2", "DATA DEP.", "DATA SAQUE", "RESULTADO", "OBSERVAÇÃO"];
    const thinBorder = { style: "thin" as const, color: { argb: "FF000000" } };
    const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3748" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.border = allBorders;
    });

    // Column widths
    ws.columns = [
      { width: 18 }, { width: 22 }, { width: 30 }, { width: 18 },
      { width: 14 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 }
    ];

    // Fetch logos
    const { getCasaLogo } = await import("@/lib/casas-apostas");
    const logoCache: Record<string, ArrayBuffer | null> = {};
    const uniqueCasas = [...new Set(selected.map(c => c.casa))];
    await Promise.all(uniqueCasas.map(async casa => {
      const logoUrl = getCasaLogo(casa);
      if (!logoUrl) { logoCache[casa] = null; return; }
      try {
        const resp = await fetch(logoUrl);
        if (resp.ok) logoCache[casa] = await resp.arrayBuffer();
        else logoCache[casa] = null;
      } catch { logoCache[casa] = null; }
    }));

    const currencyCols = [5, 6, 7, 8, 9]; // 1-indexed
    const greenFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFC6EFCE" } };
    const currencyFmt = '"R$"\\ #,##0.00';

    selected.forEach((c, idx) => {
      const clienteTrans = allTransacoes.filter(t => t.cliente_id === c.id);
      const lastSaque = clienteTrans.filter(t => t.tipo === "saque" || t.tipo === "devolucao").sort((a, b) => b.data_transacao.localeCompare(a.data_transacao))[0];
      const lucroReal = c.saques - c.depositos - c.custos;
      const lucroPra2 = c.tipo === "50/50" ? lucroReal * 0.5 : lucroReal;

      let resultado = "";
      if (c.saques === 0) resultado = "";
      else if (c.saques === c.depositos) resultado = "DEVOLUÇÃO";
      else if (lucroReal > 0) resultado = "GREEN";
      else if (lucroReal < 0) resultado = "RED";
      else resultado = "SACADA";

      const maskCred = (v: string | null) => {
        if (!v) return "";
        return v.length > 3 ? v.slice(0, 3) + "****" : "****";
      };
      const rowData = [
        `   ${c.casa}`, c.fornecedor || "Sem fornecedor", maskCred(c.login), maskCred(c.senha),
        c.depositos, c.custos, c.saques, lucroReal, lucroPra2,
        format(new Date(c.created_at), "dd/MM/yyyy"),
        lastSaque ? format(new Date(lastSaque.data_transacao + "T12:00:00"), "dd/MM/yyyy") : "-",
        resultado, ""
      ];
      const row = ws.addRow(rowData);
      row.height = 24;

      currencyCols.forEach(ci => {
        row.getCell(ci).numFmt = currencyFmt;
      });
      row.eachCell(cell => { cell.border = allBorders; });

      // Green fill for GREEN rows
      if (resultado === "GREEN") {
        row.eachCell(cell => { cell.fill = greenFill; });
      }

      // Add logo image
      const logoBuf = logoCache[c.casa];
      if (logoBuf) {
        const imgId = wb.addImage({ buffer: new Uint8Array(logoBuf) as any, extension: "png" });
        ws.addImage(imgId, {
          tl: { col: 0.15, row: idx + 1.15 },
          ext: { width: 16, height: 16 }
        });
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delay-selecionados-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);

    setSelectedCards(new Set());
    setSelectionMode(false);
  };


  // Wallet-level operations: distribute deposit/withdrawal across all active clients
  const handleWalletOperation = async () => {
    if (!walletDialog || !walletValor || !user) return;
    const valor = parseCurrency(walletValor);
    if (valor <= 0) return;

    // Always use the system client (Caixa) for wallet operations
    // Read fresh from DB to avoid stale state issues
    let systemClient: DelayCliente | null = null;
    const { data: freshSystem } = await supabase
      .from("delay_clientes")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "system")
      .maybeSingle();

    if (freshSystem) {
      systemClient = freshSystem as unknown as DelayCliente;
    } else {
      const { data, error } = await supabase.from("delay_clientes").insert({
        nome: "Caixa",
        casa: "Sistema",
        operacao: "sistema",
        status: "system",
        user_id: user.id,
      }).select().single();
      if (error || !data) {
        toast({ title: "Erro ao criar caixa interno", variant: "destructive" });
        return;
      }
      systemClient = data as unknown as DelayCliente;
    }

    const currentSaques = systemClient.saques || 0;
    const saldoAnterior = stats.saldo;
    const novoSaldo = walletDialog === "depositar" ? saldoAnterior + valor : saldoAnterior - valor;

    if (walletDialog === "depositar") {
      await supabase.from("delay_clientes").update({
        saques: currentSaques + valor
      }).eq("id", systemClient.id);
    } else {
      await supabase.from("delay_clientes").update({
        saques: currentSaques - valor
      }).eq("id", systemClient.id);
    }

    // Record in wallet_transactions for history
    await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      tipo: walletDialog === "depositar" ? "deposito" : "retirada",
      valor,
      saldo_anterior: saldoAnterior,
      saldo_posterior: novoSaldo,
      descricao: walletDialog === "depositar" ? "Depósito na Caixa" : "Retirada da Caixa",
      origem: "delay",
    });

    if (walletDialog === "depositar" && saldoAnterior < 0) {
      toast({
        title: "Depósito realizado!",
        description: `Saldo anterior: ${fmt(saldoAnterior)} | Depósito: +${fmt(valor)} | Novo saldo: ${fmt(novoSaldo)}`,
      });
    } else {
      toast({ title: walletDialog === "depositar" ? "Depósito realizado!" : "Retirada realizada!", description: `Novo saldo: ${fmt(novoSaldo)}` });
    }
    setWalletDialog(null);
    setWalletValor("");
    await fetchClientes();
    await fetchAllTransacoes();
  };

  const handleConcluir = async (cliente: DelayCliente) => {
    const { error } = await supabase.from("delay_clientes").update({ status: "concluido" }).eq("id", cliente.id);
    if (error) toast({ title: "Erro", description: getSafeErrorMessage(error), variant: "destructive" });
    else toast({ title: "Cliente concluído!", description: `${cliente.nome} foi movido para Concluídos.` });
    await fetchClientes();
  };

  const handleReativar = async (cliente: DelayCliente) => {
    const { error } = await supabase.from("delay_clientes").update({ status: "ativo" }).eq("id", cliente.id);
    if (error) toast({ title: "Erro", description: getSafeErrorMessage(error), variant: "destructive" });
    else toast({ title: "Cliente reativado!", description: `${cliente.nome} voltou para Ativos.` });
    await fetchClientes();
  };

  const handleSaquePendente = async (cliente: DelayCliente) => {
    const { error } = await supabase.from("delay_clientes").update({ status: "saque_pendente" }).eq("id", cliente.id);
    if (error) toast({ title: "Erro", description: getSafeErrorMessage(error), variant: "destructive" });
    else toast({ title: "Saque pendente!", description: `${cliente.nome} foi marcado como saque pendente.` });
    await fetchClientes();
  };

  const handleReverterSaquePendente = async (cliente: DelayCliente) => {
    const { error } = await supabase.from("delay_clientes").update({ status: "ativo" }).eq("id", cliente.id);
    if (error) toast({ title: "Erro", description: getSafeErrorMessage(error), variant: "destructive" });
    else toast({ title: "Status revertido!", description: `${cliente.nome} voltou para Ativo.` });
    await fetchClientes();
  };

  const handleZerar = async () => {
    if (!user) return;
    
    // Calculate the saldo contribution from all non-system clients
    const nonSystemSaldo = clientes.reduce((acc, c) => {
      if (c.status === "system") return acc;
      if (c.saques > 0 && c.saques === c.depositos && c.lucro === 0) return acc - c.depositos;
      if (c.saques > 0) return acc + c.lucro;
      return acc - c.depositos;
    }, 0);

    // Set system client saques to offset the non-system saldo so total = 0
    const systemClient = clientes.find(c => c.status === "system");
    const offsetValue = -nonSystemSaldo; // If nonSystem is -35000, offset = 35000, so total = 35000 + (-35000) = 0
    
    if (systemClient) {
      await supabase.from("delay_clientes").update({ saques: offsetValue }).eq("id", systemClient.id);
    } else {
      await supabase.from("delay_clientes").insert({
        nome: "Caixa", casa: "Sistema", operacao: "sistema", status: "system", user_id: user.id, saques: offsetValue,
      });
    }
    
    // Zero bank balances too
    await supabase.from("bank_balances").update({ saldo: 0, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    setBankBalances({ santander: 0, c6: 0 });
    toast({ title: "Todos os saldos zerados!" });
    setConfirmZerar(false);
    await fetchClientes();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col"> {/* Added flex flex-col */}
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div>
              <Badge variant="outline" className="mb-1 text-xs border-primary text-primary">DELAY ESPORTIVO</Badge>
              <h1 className="text-lg font-bold tracking-tight">Delay Esportivo</h1>
              <p className="text-xs text-muted-foreground">Gerencie clientes e operações de delay esportivo</p>
            </div>

          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden"> {/* New wrapper for main content */}
        <div className="h-full flex flex-col"> {/* New flex container for fixed and scrollable parts */}
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 shrink-0 bg-background"> {/* Fixed top section */}
            {/* Action Buttons - Above cards */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="text-xs border-primary text-primary hover:bg-primary/10"
                onClick={() => setShowDepositChoice("depositar")}>
                <ArrowDownCircle className="h-3.5 w-3.5 mr-1" /> Depositar
              </Button>
              <Button size="sm" variant="outline" className="text-xs"
                onClick={() => setShowDepositChoice("retirar")}>
                <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Retirar
              </Button>
              <Button size="sm" variant="ghost" className="text-xs"
                onClick={() => setShowHistorico(!showHistorico)}>
                <TrendingUp className="h-3.5 w-3.5 mr-1" /> Histórico
              </Button>
              <Button size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive"
                onClick={() => setConfirmZerar(true)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Zerar
              </Button>

            </div>

        {/* Bank Balances Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Saldo Total (Carteira + Bancos) */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-lg bg-primary/20 p-1.5">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider">Saldo Total</p>
              </div>
              <p className={`text-xl font-bold font-mono ${stats.saldoTotal >= 0 ? "text-primary" : "text-destructive"}`}>
                {fmt(stats.saldoTotal)}
              </p>
              <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Depósitos em Contas</span>
                  <span className="font-mono font-medium text-blue-400">{fmt(stats.depositosAtivos)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Saldo Bancos (Santander + C6)</span>
                  <span className="font-mono font-medium">{fmt(bankBalances.santander + bankBalances.c6)}</span>
                </div>
                <div className="border-t border-border/50 my-1" />
                <div className="flex justify-between text-[10px]">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-mono font-bold">{fmt(stats.depositosAtivos + bankBalances.santander + bankBalances.c6)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Depósitos em Contas */}
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-lg bg-blue-500/20 p-1.5">
                  <ArrowDownCircle className="h-4 w-4 text-blue-400" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider">Depósitos em Contas</p>
              </div>
              <p className="text-xl font-bold font-mono text-blue-400">
                {fmt(stats.depositosAtivos)}
              </p>
              <div className="mt-2 pt-2 border-t border-border/50">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Contas ativas</span>
                  <span className="font-mono font-medium">{stats.ativas}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Santander */}
          <Card className="border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-lg bg-red-500/20 p-1.5">
                  <Building2 className="h-4 w-4 text-red-500" />
                </div>
                <p className="text-xs font-semibold">Santander</p>
              </div>
              <p className={`text-xl font-bold font-mono ${bankBalances.santander >= 0 ? "text-primary" : "text-destructive"}`}>
                {fmt(bankBalances.santander)}
              </p>
            </CardContent>
          </Card>

          {/* C6 */}
          <Card className="border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-lg bg-purple-500/20 p-1.5">
                  <Building2 className="h-4 w-4 text-purple-500" />
                </div>
                <p className="text-xs font-semibold">C6 Bank</p>
              </div>
              <p className={`text-xl font-bold font-mono ${bankBalances.c6 >= 0 ? "text-primary" : "text-destructive"}`}>
                {fmt(bankBalances.c6)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Caixa de Saldo */}
        <Card className="border-amber-500/40">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-xl bg-amber-500/20 p-2.5">
                <Wallet className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="font-bold text-sm">Caixa de Saldo</p>
                <p className="text-xs text-muted-foreground">Visão consolidada de todos os clientes</p>
              </div>
            </div>


            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Investido</p>
                <p className="text-lg sm:text-xl font-bold font-mono">{fmt(stats.totalDepositos)}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                  <ArrowDownCircle className="h-3 w-3" /> Depósitos acumulados
                </p>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Custos</p>
                <p className="text-lg sm:text-xl font-bold font-mono">{fmt(stats.totalCustos)}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                  <DollarSign className="h-3 w-3" /> Custos totais das contas
                </p>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Ativas</p>
                <p className="text-lg sm:text-xl font-bold font-mono">{stats.ativas} <span className="text-sm text-muted-foreground font-normal">/ {stats.total}</span></p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" /> Operando
                </p>
              </div>
            </div>

            {/* Histórico Geral Dialog */}
            <HistoricoGeralDialog clientes={clientes} open={showHistorico} onOpenChange={setShowHistorico} fmt={fmt} />
          </CardContent>
        </Card>

        <Card className="border border-border/50">
          <CardContent className="p-3 sm:p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              <div className="flex items-center justify-center gap-2.5">
                <div className="rounded-lg bg-primary/10 p-2"><Users className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Operando</p>
                  <p className="text-lg font-bold font-mono">{stats.ativas}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2.5">
                <div className="rounded-lg bg-yellow-500/10 p-2"><ArrowDownCircle className="h-4 w-4 text-yellow-500" /></div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Depósitos</p>
                  <p className="text-lg font-bold font-mono">{fmt(stats.depositosAtivos)}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2.5">
                <div className="rounded-lg bg-primary/10 p-2"><ArrowUpCircle className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Saques</p>
                  <p className="text-lg font-bold font-mono">{fmt(stats.totalSaques)}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2.5">
                <div className="rounded-lg bg-yellow-500/10 p-2"><TrendingUp className="h-4 w-4 text-yellow-500" /></div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Lucro Total</p>
                  <p className={`text-lg font-bold font-mono ${stats.totalLucro >= 0 ? "text-primary" : "text-destructive"}`}>
                    {stats.totalLucro >= 0 ? "+" : ""}{fmt(stats.totalLucro)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["todos", "ativos", "concluidos"] as FiltroStatus[]).map(s => (
              <Button key={s} size="sm" variant={filtroStatus === s ? "default" : "outline"}
                onClick={() => setFiltroStatus(s)}
                className={`text-xs capitalize ${s === "concluidos" && filtroStatus === s ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-600" : ""}`}>
                {s === "concluidos" ? "Concluídos" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
            <Select value={filtroCasa} onValueChange={setFiltroCasa}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Todas as Casas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Casas</SelectItem>
                {casas.map(c => {
                  const logo = getCasaLogo(c);
                  return (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">
                        {logo && <img src={logo} alt={c} className="h-4 w-4 rounded-sm" />}
                        {c}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button size="sm" variant={sortMode === "az" ? "secondary" : "outline"} className="text-xs gap-1"
              onClick={() => setSortMode(sortMode === "az" ? "recentes" : "az")}>
              <SortAsc className="h-3.5 w-3.5" />
              {sortMode === "az" ? "A-Z" : "Recentes"}
            </Button>
            <Popover open={filtroDataSaqueOpen} onOpenChange={setFiltroDataSaqueOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant={filtroDataSaque ? "secondary" : "outline"} className="gap-1 text-xs">
                  <CalendarDays className="h-4 w-4" />
                  {filtroDataSaque ? `Saque: ${format(filtroDataSaque, "dd/MM/yyyy")}` : "Filtrar por Saque"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filtroDataSaque}
                  onSelect={(date) => {
                    setFiltroDataSaque(date);
                    setFiltroDataSaqueOpen(false);
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
                {filtroDataSaque && (
                  <div className="p-2 border-t">
                    <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => { setFiltroDataSaque(undefined); setFiltroDataSaqueOpen(false); }}>
                      Limpar filtro
                    </Button>
                  </div>
                )}
              </PopoverContent>
              </Popover>
            <Select value={filtroNick} onValueChange={setFiltroNick}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
                <Link className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="direto">Cadastro direto</SelectItem>
                {shareLinks.filter(l => l.nick && l.tipo !== "visualizador" && l.tipo !== "visualizador_vodka" && l.tipo !== "visualizador_pessoa").map(link => (
                  <SelectItem key={link.id} value={link.id}>{link.nick}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => setShareLinkDialogOpen(true)}>
              <Share2 className="h-4 w-4 mr-1" /> Compartilhar
            </Button>
            <Button size="sm" variant="ghost" className="text-xs"
              onClick={() => setNotaOpen(true)}>
              <StickyNote className="h-3.5 w-3.5 mr-1" /> Notas
            </Button>
            <Button size="sm" variant="default" onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-1" /> Novo Cliente
            </Button>
          </div>
        </div>



        {/* Period filter */}
        <div className="flex justify-end gap-1 items-center flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg bg-muted/60 hover:bg-muted h-7 w-7"
            onClick={() => setHideAllCredentials(prev => !prev)}
            title={hideAllCredentials ? "Mostrar credenciais" : "Ocultar credenciais"}
          >
            {hideAllCredentials ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg bg-muted/60 hover:bg-muted h-7 w-7"
            onClick={exportToXLSX}
            title="Exportar planilha"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-lg h-7 w-7 ${selectionMode ? "bg-primary/20 text-primary" : "bg-muted/60 hover:bg-muted"}`}
            onClick={() => { setSelectionMode(prev => !prev); setSelectedCards(new Set()); }}
            title={selectionMode ? "Sair da seleção" : "Selecionar cards"}
          >
            <CheckSquare className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-lg h-7 w-7 ${layoutCols === 3 ? "bg-primary/20 text-primary" : "bg-muted/60 hover:bg-muted"}`}
            onClick={() => setLayoutCols(prev => prev === 3 ? 4 : 3)}
            title={layoutCols === 3 ? "Layout 4 colunas" : "Layout 3 colunas"}
          >
            {layoutCols === 3 ? <LayoutGrid className="h-3.5 w-3.5" /> : <Columns2 className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-lg h-7 w-7 ${viewMode === "table" ? "bg-primary/20 text-primary" : "bg-muted/60 hover:bg-muted"}`}
            onClick={() => setViewMode(prev => prev === "cards" ? "table" : "cards")}
            title={viewMode === "cards" ? "Visualização em tabela" : "Visualização em cards"}
          >
            <List className="h-3.5 w-3.5" />
          </Button>



          {(["diario", "semanal", "mensal"] as Periodo[]).map(p => (
            <Button key={p} size="sm" variant={periodo === p ? "secondary" : "ghost"} className="text-xs capitalize"
              onClick={() => setPeriodo(p)}>
              {p === "diario" ? "Diário" : p === "semanal" ? "Semanal" : "Mensal"}
            </Button>
          ))}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <span className="sr-only">Calendário</span>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => { if (date) { setSelectedDate(date); setCalendarOpen(false); } }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
              {format(selectedDate, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd") && (
                <div className="px-3 pb-3">
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setSelectedDate(new Date()); setCalendarOpen(false); }}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Voltar para Hoje
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Period Stats Card */}
        <Card className="border border-primary/30 bg-primary/5">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold">
                Lucro {periodo === "diario" ? `de ${format(selectedDate, "dd/MM/yyyy")}` : periodo === "semanal" ? "da Semana" : "do Mês"}
              </p>
              <Badge variant="outline" className="text-[10px] ml-auto">{periodStats.totalTrans} transações</Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Saques</p>
                <p className="text-base font-bold font-mono">{fmt(periodStats.saques)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Custos</p>
                <p className="text-base font-bold font-mono">{fmt(periodStats.custos)}</p>
              </div>
              <div className="cursor-pointer" onClick={() => setCalendarOpen(true)}>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors">Lucro Diário</p>
                <p className={`text-base font-bold font-mono ${periodStats.lucro >= 0 ? "text-primary" : "text-destructive"}`}>
                  {periodStats.lucro >= 0 ? "+" : ""}{fmt(periodStats.lucro)}
                </p>
                <p className="text-[8px] text-muted-foreground mt-0.5">{format(selectedDate, "dd/MM/yyyy")} 📅</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Action Bar */}
        {selectionMode && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/30">
            <Button size="sm" variant="ghost" onClick={toggleSelectAll} className="text-xs gap-1.5">
              {selectedCards.size === filtered.filter(c => c.status !== "system").length ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              {selectedCards.size === filtered.filter(c => c.status !== "system").length ? "Desmarcar todos" : "Selecionar todos"}
            </Button>
            <span className="text-xs text-muted-foreground">{selectedCards.size} selecionado(s)</span>
            <div className="flex-1" />
            <Button size="sm" variant="secondary" onClick={exportSelectedToXLSX} className="text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar Selecionados
            </Button>
            <Button size="sm" variant="secondary" onClick={captureSelectedCards} className="text-xs gap-1.5">
              <Camera className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        )}

        {/* Filter toggles: Pendentes, Devolvidas, Concluídas, Red */}
        {(() => {
          const pendingCount = filtered.filter(c => (c.deposito_pendente ?? 0) > 0).length;
          const devolvidaCount = clientes.filter(c => c.status === "devolvido").length;
          const concluidaCount = clientes.filter(c => c.status === "concluido").length;
          const redCount = clientes.filter(c => (c.status === "concluido" || c.status === "devolvido") && c.lucro < 0).length;
          return (
            <div className="flex justify-end gap-2 flex-wrap">
              {pendingCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowPendentes(!showPendentes); setShowDevolvidas(false); setShowConcluidas(false); setShowRed(false); }}
                  className={cn("gap-1.5", showPendentes ? "border-orange-500 bg-orange-500/10 text-orange-400" : "border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300")}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Pendentes
                  <Badge className="ml-0.5 text-[10px] px-1.5 py-0 bg-orange-500/20 text-orange-400 border-orange-500/30">
                    {pendingCount}
                  </Badge>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showPendentes && "rotate-180")} />
                </Button>
              )}
              {devolvidaCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowDevolvidas(!showDevolvidas); setShowPendentes(false); setShowConcluidas(false); setShowRed(false); }}
                  className={cn("gap-1.5", showDevolvidas ? "border-yellow-500 bg-yellow-500/10 text-yellow-400" : "border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Devolvidas
                  <Badge className="ml-0.5 text-[10px] px-1.5 py-0 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    {devolvidaCount}
                  </Badge>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDevolvidas && "rotate-180")} />
                </Button>
              )}
              {concluidaCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowConcluidas(!showConcluidas); setShowPendentes(false); setShowDevolvidas(false); setShowRed(false); }}
                  className={cn("gap-1.5", showConcluidas ? "border-purple-500 bg-purple-500/10 text-purple-400" : "border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300")}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Concluídas
                  <Badge className="ml-0.5 text-[10px] px-1.5 py-0 bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {concluidaCount}
                  </Badge>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showConcluidas && "rotate-180")} />
                </Button>
              )}
              {redCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowRed(!showRed); setShowPendentes(false); setShowDevolvidas(false); setShowConcluidas(false); }}
                  className={cn("gap-1.5", showRed ? "border-red-500 bg-red-500/10 text-red-400" : "border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300")}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Red
                  <Badge className="ml-0.5 text-[10px] px-1.5 py-0 bg-red-500/20 text-red-400 border-red-500/30">
                    {redCount}
                  </Badge>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showRed && "rotate-180")} />
                </Button>
              )}
            </div>
          );
        })()}
          </div> {/* Closing the fixed top section */}

          {/* Scrollable client list section */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6"> {/* Added padding and scroll */}
            {/* Client Cards / Table */}
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : displayList.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum cliente encontrado.</p>
            ) : viewMode === "table" ? (
              /* Table View */
              <div className="rounded-lg border border-border/50 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Nome</th>
                  <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Casa</th>
                  <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Login</th>
                  <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Senha</th>
                  <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Depósito</th>
                  <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Fornecedor</th>
                  <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Tipo</th>
                  <th className="text-center px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((c) => (
                  <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">{c.nome}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {getCasaLogo(c.casa) && <img src={getCasaLogo(c.casa)} alt={c.casa} className="w-4 h-4 rounded-sm" />}
                        {c.casa}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>{hideAllCredentials ? "••••••" : (c.login || "—")}</span>
                        {c.login && <Button variant="ghost" size="icon" className="h-5 w-5 opacity-40 hover:opacity-100" onClick={() => copyToClipboard(c.login!)}><Copy className="h-3 w-3" /></Button>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>{hideAllCredentials ? "••••••" : (c.senha || "—")}</span>
                        {c.senha && <Button variant="ghost" size="icon" className="h-5 w-5 opacity-40 hover:opacity-100" onClick={() => copyToClipboard(c.senha!)}><Copy className="h-3 w-3" /></Button>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium text-primary whitespace-nowrap">
                      {c.depositos > 0 ? `R$ ${c.depositos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{c.fornecedor || "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {c.tipo === "50/50" ? <Badge className="text-[10px] px-2 py-0 bg-yellow-900/40 border border-yellow-600/60 text-yellow-500 rounded-full">50/50</Badge> : <span className="text-muted-foreground">{c.tipo || "—"}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDialog(c)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteCliente(c)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
          <motion.div
            key={filtroStatus}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`grid grid-cols-1 gap-3 ${layoutCols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}
          >
            {displayList.map((c, index) => {
              const displayName = c.nome;
              return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
              >
              <Card data-card-id={c.id} className={`overflow-hidden w-full border transition-colors flex flex-col ${selectionMode && selectedCards.has(c.id) ? "border-primary" : "border-border/50 hover:border-border"}`}
                onClick={selectionMode ? () => toggleSelectCard(c.id) : undefined}
                style={selectionMode ? { cursor: "pointer" } : undefined}
              >
                <CardContent className="flex flex-col flex-1 p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    {selectionMode && (
                      <button className="mr-2 shrink-0" onClick={(e) => { e.stopPropagation(); toggleSelectCard(c.id); }}>
                        {selectedCards.has(c.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold leading-tight truncate max-w-[160px] text-sm" title={c.nome}>{displayName}</h3>
                        {c.tipo === "50/50" && <Badge className="text-[11px] px-3 py-0.5 bg-yellow-900/40 border border-yellow-600/60 text-yellow-500 hover:bg-yellow-900/50 shrink-0 rounded-full font-medium">50/50</Badge>}
                        {c.saques > 0 && !(c.saques === c.depositos && c.lucro === 0) && (
                          <Badge className="text-[11px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 shrink-0">Concluído</Badge>
                        )}
                        {c.saques > 0 && c.saques === c.depositos && c.lucro === 0 && (
                          <Badge className="text-[11px] px-1.5 py-0.5 bg-warning/20 text-warning hover:bg-warning/30 shrink-0">Devolvido</Badge>
                        )}
                        {c.depositos > 0 && c.saques === 0 && (
                          <Badge className="text-[11px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 shrink-0 flex items-center gap-1">
                            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400"></span></span>
                            Operando
                          </Badge>
                        )}
                        {c.depositos === 0 && c.saques === 0 && !(c.deposito_pendente && c.deposito_pendente > 0) && (
                          <Badge className="text-[11px] px-1.5 py-0.5 bg-primary/20 text-primary hover:bg-primary/30 shrink-0">Ativo</Badge>
                        )}
                        {(c.deposito_pendente ?? 0) > 0 && (
                          <Badge className="text-[11px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 shrink-0 flex items-center gap-1 animate-pulse">
                            <Clock className="h-3 w-3" />
                            Depósito Pendente
                          </Badge>
                        )}
                        {c.status === "saque_pendente" && (
                          <Badge className="text-[11px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 shrink-0 flex items-center gap-1 animate-pulse">
                            <ArrowUpCircle className="h-3 w-3" />
                            Saque Pendente
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-0 shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDialog(c)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteCliente(c)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>

                  {/* Credentials */}
                  <div className="flex items-start gap-2 mt-2">
                    {getCasaLogo(c.casa) && <img src={getCasaLogo(c.casa)} alt={c.casa} className="w-6 h-6 rounded-sm shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0 text-muted-foreground space-y-0.5 text-xs">
                      <p className="text-muted-foreground text-xs mb-0.5">{c.casa}</p>
                      {c.login && (
                        <div className="flex items-center gap-1">
                          <span className="uppercase tracking-wider shrink-0 text-[11px]">Login:</span>
                          <span className="font-mono text-foreground truncate flex-1 font-semibold text-xs">{hideAllCredentials ? "••••••" : c.login}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-40 hover:opacity-100" onClick={() => copyToClipboard(c.login!)}><Copy className="h-3 w-3" /></Button>
                        </div>
                      )}
                      {c.senha && (
                        <div className="flex items-center gap-1">
                          <span className="uppercase tracking-wider shrink-0 text-[11px]">Senha:</span>
                          <span className="font-mono text-foreground truncate flex-1 font-semibold text-xs">{hideAllCredentials ? "••••••" : c.senha}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-40 hover:opacity-100" onClick={() => copyToClipboard(c.senha!)}><Copy className="h-3 w-3" /></Button>
                        </div>
                      )}
                      {c.informacoes_adicionais && c.informacoes_adicionais.trim() !== "" && (
                        <div className="flex items-center gap-1">
                          <span className="uppercase tracking-wider shrink-0 text-[11px]">Pix:</span>
                          <span className="font-mono text-foreground truncate flex-1 font-semibold text-xs">{hideAllCredentials ? "••••••" : c.informacoes_adicionais}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-40 hover:opacity-100" onClick={() => copyToClipboard(c.informacoes_adicionais!)}><Copy className="h-3 w-3" /></Button>
                        </div>
                      )}
                      <p className="text-muted-foreground uppercase tracking-wider text-[11px]">
                        {formatFornecedorLabel(c.fornecedor)}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-2" />

                  {/* Financeiro */}
                  <div className="flex items-stretch gap-2 mt-2">
                    {c.depositos > 0 && (
                      <div className="flex-1 rounded-md border border-primary/20 bg-primary/10 flex flex-col items-center justify-center text-center gap-0.5 px-3 py-2">
                        <ArrowDownCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                        <p className="text-primary/70 leading-none text-[11px]">Valor Depositado</p>
                        <span className="font-bold font-mono text-primary text-sm">{fmt(c.depositos)}</span>
                      </div>
                    )}
                    {c.custos > 0 && (
                      <div className="flex-1 rounded-md border border-destructive/20 bg-destructive/10 flex flex-col items-center justify-center text-center gap-0.5 px-3 py-2">
                        <DollarSign className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <p className="text-destructive/70 leading-none text-[11px]">Custo</p>
                        <span className="font-bold font-mono text-destructive text-sm">{fmt(c.custos)}</span>
                      </div>
                    )}
                    {c.saques > 0 && c.saques === c.depositos && c.lucro === 0 ? (
                      <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex flex-col items-center justify-center text-center gap-0.5 px-3 py-2">
                        <TrendingUp className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                        <p className="text-yellow-500/70 leading-none text-[11px]">Devolução</p>
                        <span className="font-bold font-mono text-yellow-500 text-sm">+{fmt(0)}</span>
                      </div>
                    ) : (
                      <div className={`flex-1 rounded-md border flex flex-col items-center justify-center text-center gap-0.5 px-3 py-2 ${c.lucro >= 0 ? "bg-blue-500/10 border-blue-500/20" : "bg-destructive/10 border-destructive/20"}`}>
                        <TrendingUp className={`h-3.5 w-3.5 shrink-0 ${c.lucro >= 0 ? "text-blue-400" : "text-destructive"}`} />
                        <p className={`leading-none text-[11px] ${c.lucro >= 0 ? "text-blue-400/70" : "text-destructive/70"}`}>{c.lucro < 0 ? "Red" : "Lucro"}</p>
                        <span className={`font-bold font-mono text-sm ${c.lucro >= 0 ? "text-blue-400" : "text-destructive"}`}>
                          {c.lucro >= 0 ? "+" : ""}{fmt(c.lucro)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Data do Saque */}
                  {(() => {
                    const lastSaque = allTransacoes
                      .filter(t => t.cliente_id === c.id && (t.tipo === "saque" || t.tipo === "devolucao"))
                      .sort((a, b) => b.data_transacao.localeCompare(a.data_transacao))[0];
                    return lastSaque ? (
                      <p className="mt-1.5 text-muted-foreground text-center text-[11px]">
                        <CalendarDays className="inline h-3.5 w-3.5 mr-1 align-text-bottom" />
                        Saque: {format(new Date(lastSaque.data_transacao + "T12:00:00"), "dd/MM/yyyy")}
                      </p>
                    ) : null;
                  })()}

                  {/* Pending Deposit Approval */}
                  {(c.deposito_pendente ?? 0) > 0 && (
                    <div className="mt-2 p-2.5 rounded-md border border-orange-500/30 bg-orange-500/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs">
                          <p className="text-orange-400 font-semibold flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Depósito pendente de aprovação
                          </p>
                          <p className="text-foreground font-mono font-bold mt-0.5">
                            R$ {(c.deposito_pendente ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            <span className="text-muted-foreground font-normal ml-1">→ {c.banco_deposito === "c6" ? "C6 Bank" : "Santander"}</span>
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500 border-0 text-xs h-7 px-3"
                            onClick={() => handleApproveDeposit(c)}>
                            <Check className="h-3 w-3 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive text-xs h-7 px-2"
                            onClick={() => handleRejectDeposit(c)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <Button size="sm" className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-0 text-xs h-7"
                      onClick={() => { setTransDialog({ type: "deposito", cliente: c }); setTransValor(""); setTransCasa(c.casa); setTransData(new Date()); setTransDestino("santander"); }}>
                      <ArrowDownCircle className="h-3 w-3 mr-0.5" /> Depósito
                    </Button>
                    <Button size="sm" className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500 border-0 text-xs h-7"
                      onClick={() => { setTransDialog({ type: "saque", cliente: c }); setTransValor(""); setTransCusto(""); setTransDividirLucro(c.tipo === "50/50"); setTransData(new Date()); setTransCasa(c.casa); setTransDestino("santander"); }}>
                      <ArrowUpCircle className="h-3 w-3 mr-0.5" /> Saque
                    </Button>
                    {c.status === "ativo" && (
                      <>
                        <Button size="sm" className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-0 text-[10px] h-6 w-6 p-0"
                          onClick={() => handleSaquePendente(c)} title="Marcar saque pendente">
                          <ArrowUpCircle className="h-3 w-3" />
                        </Button>
                        <Button size="sm" className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border-0 text-[10px] h-6 w-6 p-0"
                          onClick={() => handleConcluir(c)} title="Marcar como concluído">
                          <Check className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {c.status === "saque_pendente" && (
                      <Button size="sm" className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-0 text-[10px] h-6 px-2"
                        onClick={async () => {
                          await handleReverterSaquePendente(c);
                          setTransDialog({ type: "saque", cliente: c });
                          setTransValor("");
                          setTransCusto("");
                          setTransDividirLucro(c.tipo === "50/50");
                          setTransData(new Date());
                          setTransCasa(c.casa);
                          setTransDestino("santander");
                        }} title="Reverter saque pendente e abrir saque">
                        <RotateCcw className="h-2.5 w-2.5 mr-0.5" /> Ativo
                      </Button>
                    )}
                    {c.status === "concluido" && (
                      <Button size="sm" className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-0 text-[10px] h-6 px-2"
                        onClick={() => handleReativar(c)} title="Reativar cliente">
                        <RotateCcw className="h-2.5 w-2.5 mr-0.5" /> Ativos
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="text-muted-foreground h-6 w-6" onClick={() => openHistorico(c)} title="Detalhes">
                      <Info className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>


              </Card>
              </motion.div>
              
              );
            })}
          </motion.div>
          </AnimatePresence>
        )}
          </div> {/* Closing the scrollable client list section */}
        </div> {/* Closing the h-full flex flex-col container */}
      </div> {/* Closing the flex-1 overflow-hidden container */}

      {/* New/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editCliente ? "Editar Cliente" : "Adicionar Cliente"}</DialogTitle>
            <DialogDescription className="sr-only">
              {editCliente ? "Edite os dados do cliente." : "Preencha os dados do novo cliente."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-bold">Nome</Label>
              <Input placeholder="Nome do cliente" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="font-bold">Casa de Aposta</Label>
              <Popover open={casaPopoverOpen} onOpenChange={setCasaPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={casaPopoverOpen} className="w-full justify-between mt-1 font-normal">
                    <span className="flex items-center gap-2">
                      {getCasaLogo(form.casa) && <img src={getCasaLogo(form.casa)} alt={form.casa} className="w-4 h-4 rounded-sm" />}
                      {form.casa || "Selecione a casa"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar casa..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma casa encontrada.</CommandEmpty>
                      <CommandGroup>
                        {CASAS_APOSTAS.map(c => (
                          <CommandItem
                            key={c.nome}
                            value={c.nome}
                            onSelect={() => {
                              setForm(f => ({ ...f, casa: c.nome }));
                              setCasaPopoverOpen(false);
                            }}
                          >
                            <span className="flex items-center gap-2 flex-1">
                              {c.logo && <img src={c.logo} alt={c.nome} className="w-4 h-4 rounded-sm" />}
                              {c.nome}
                            </span>
                            {form.casa === c.nome && <Check className="h-4 w-4 text-primary" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="font-bold">Login</Label>
              <Input placeholder="Login da conta" value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="font-bold">Senha</Label>
              <Input placeholder="Senha da conta" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="font-bold">Fornecedor</Label>
              <Input placeholder="Nome do fornecedor" value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="font-bold">Pix</Label>
              <Input placeholder="Chave Pix do cliente" value={form.informacoes_adicionais} onChange={e => setForm(f => ({ ...f, informacoes_adicionais: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="font-bold">Valor do Depósito</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={depositoInicial}
                onChange={e => setDepositoInicial(e.target.value)}
                className="mt-1"
              />
              {!editCliente && (
                <div className="flex gap-2 mt-2">
                  {[500, 1000, 2000].map(v => (
                    <Button
                      key={v}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setDepositoInicial(String(v))}
                    >
                      R$ {v.toLocaleString("pt-BR")}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            {!editCliente && (
              <div>
                <Label className="font-bold">Debitar de</Label>
                <Select value={depositoBanco} onValueChange={(v) => setDepositoBanco(v as "santander" | "c6")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="santander">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> Santander
                      </span>
                    </SelectItem>
                    <SelectItem value="c6">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> C6 Bank
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {editCliente && (
              <>
                <div>
                  <Label className="font-bold">Data de Cadastro</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !editDate && "text-muted-foreground")}>
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {format(editDate, "dd/MM/yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDate}
                        onSelect={(date) => date && setEditDate(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {editCliente?.data_deposito && (
                  <div>
                    <Label className="font-bold">Data de Depósito</Label>
                    <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal cursor-default" disabled>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {format(new Date(editCliente.data_deposito), "dd/MM/yyyy")}
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-bold">Tipo</Label>
                    <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50/50">50/50</SelectItem>
                        <SelectItem value="70/30">70/30</SelectItem>
                        <SelectItem value="100%">100%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-bold">Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="saque_pendente">Saque Pendente</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="font-bold">Exibir no Link</Label>
                  <Select value={form.link_visualizacao || "_admin"} onValueChange={v => setForm(f => ({ ...f, link_visualizacao: v === "_admin" ? "" : v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o link" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_admin">Visualização Admin</SelectItem>
                      {shareLinks.filter(l => l.ativo && (l.tipo === "visualizador_pessoa")).map(link => (
                        <SelectItem key={link.id} value={link.id}>{link.nick || "Sem nick"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="mt-2">
            {editCliente ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving || !form.nome.trim()}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </>
            ) : (
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold"
                onClick={handleSave}
                disabled={saving || !form.nome.trim()}
              >
                {saving ? "Salvando..." : "Adicionar Cliente"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteCliente} onOpenChange={open => !open && setDeleteCliente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteCliente?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transaction Dialog */}
      <Dialog open={!!transDialog} onOpenChange={open => !open && setTransDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {transDialog?.type === "saque" ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
              {transDialog?.type === "deposito" ? "Depósito" : "Saque"} — {transDialog?.cliente.nome}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {transDialog?.type === "deposito" ? "Depósito" : "Saque"} para {transDialog?.cliente.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Casa de Aposta - both deposit and withdrawal */}
            <div>
              <Label className="font-bold text-xs">Casa de Aposta</Label>
              <Select value={transCasa} onValueChange={setTransCasa}>
                <SelectTrigger className="mt-1">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      {getCasaLogo(transCasa) && <img src={getCasaLogo(transCasa)} alt={transCasa} className="w-4 h-4 rounded-sm" />}
                      {transCasa}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CASAS_APOSTAS.map(ca => (
                    <SelectItem key={ca.nome} value={ca.nome}>
                      <span className="flex items-center gap-2">
                        {ca.logo && <img src={ca.logo} alt={ca.nome} className="w-4 h-4 rounded-sm" />}
                        {ca.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bold text-xs">Valor</Label>
              <Input type="number" min="0" step="0.01" value={transValor} onChange={e => setTransValor(e.target.value)} placeholder="0,00" className="mt-1" />
            </div>
            {transDialog?.type === "saque" && (
              <>
                <div>
                  <Label className="font-bold text-xs">Custo da Conta</Label>
                  <Input type="number" min="0" step="0.01" value={transCusto} onChange={e => setTransCusto(e.target.value)} placeholder="0,00" className="mt-1" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-xs">Dividir Lucro ({transDialog?.cliente.tipo || "50/50"})</Label>
                  <Switch checked={transDividirLucro} onCheckedChange={setTransDividirLucro} />
                </div>
                {/* Resumo do cálculo em tempo real */}
                {(() => {
                  const val = parseFloat(transValor) || 0;
                  const cst = parseFloat(transCusto) || 0;
                  const deposito = transDialog?.cliente.depositos || 0;
                  const lucroBruto = val - deposito - cst;
                  const lucroFinal = transDividirLucro ? lucroBruto / 2 : lucroBruto;
                  return val > 0 ? (
                    <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1.5 text-xs">
                      <p className="font-semibold text-sm text-foreground mb-2">Resumo do Cálculo</p>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor do Saque</span>
                        <span className="font-mono font-medium">{fmt(val)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">− Depósito da Conta</span>
                        <span className="font-mono font-medium text-destructive">−{fmt(deposito)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">− Custo da Conta</span>
                        <span className="font-mono font-medium text-destructive">−{fmt(cst)}</span>
                      </div>
                      <div className="border-t border-border my-1" />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">= Lucro Bruto</span>
                        <span className={`font-mono font-bold ${lucroBruto >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(lucroBruto)}</span>
                      </div>
                      {transDividirLucro ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">÷ 2 (Dividido)</span>
                            <span className="font-mono font-medium">{fmt(lucroBruto / 2)}</span>
                          </div>
                          <div className="border-t border-border my-1" />
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Lucro 100% (Sem divisão)</span>
                            <span className="font-mono font-medium">{fmt(lucroBruto)}</span>
                          </div>
                          <div className="border-t border-border my-1" />
                        </>
                      )}
                      <div className="flex justify-between items-center pt-1">
                        <span className="font-semibold text-foreground">Lucro Final</span>
                        <span className={`font-mono font-bold text-base ${lucroFinal >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(lucroFinal)}</span>
                      </div>
                    </div>
                  ) : null;
                })()}
              </>
            )}
            <div>
              <Label className="font-bold text-xs">{transDialog?.type === "deposito" ? "Debitar de" : "Creditar em"}</Label>
              <Select value={transDestino} onValueChange={(v) => setTransDestino(v as "santander" | "c6")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="santander">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Santander
                    </span>
                  </SelectItem>
                  <SelectItem value="c6">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> C6 Bank
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bold text-xs">Data {transDialog?.type === "deposito" ? "do Depósito" : "do Saque"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal mt-1", !transData && "text-muted-foreground")}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {transData ? format(transData, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={transData}
                    onSelect={(d) => d && setTransData(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full bg-primary hover:bg-primary/90 font-bold"
              onClick={handleTransaction}
              disabled={!transValor || parseFloat(transValor) <= 0}
            >
              {transDialog?.type === "deposito" ? "Confirmar Depósito" : "Confirmar Saque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit/Withdraw Choice Dialog */}
      <Dialog open={!!showDepositChoice} onOpenChange={open => !open && setShowDepositChoice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{showDepositChoice === "depositar" ? "Onde deseja depositar?" : "De onde deseja retirar?"}</DialogTitle>
            <DialogDescription>
              Escolha o destino da operação
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              variant="outline"
              className="h-14 justify-start gap-3 border-red-500/30 hover:bg-red-500/10"
              onClick={() => {
                setShowDepositChoice(null);
                setBankDialog({ banco: "santander", tipo: showDepositChoice! });
                setBankValor("");
              }}
            >
              <div className="rounded-lg bg-red-500/20 p-2">
                <Building2 className="h-4 w-4 text-red-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Santander</p>
                <p className="text-[10px] text-muted-foreground">Saldo: {fmt(bankBalances.santander)}</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-14 justify-start gap-3 border-purple-500/30 hover:bg-purple-500/10"
              onClick={() => {
                setShowDepositChoice(null);
                setBankDialog({ banco: "c6", tipo: showDepositChoice! });
                setBankValor("");
              }}
            >
              <div className="rounded-lg bg-purple-500/20 p-2">
                <Building2 className="h-4 w-4 text-purple-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">C6 Bank</p>
                <p className="text-[10px] text-muted-foreground">Saldo: {fmt(bankBalances.c6)}</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wallet Deposit/Withdraw Dialog */}
      <Dialog open={!!walletDialog} onOpenChange={open => !open && setWalletDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{walletDialog === "depositar" ? "Depositar na Caixa" : "Retirar da Caixa"}</DialogTitle>
            <DialogDescription>
              {walletDialog === "depositar"
                ? "O valor será distribuído entre todos os clientes ativos."
                : "O valor será retirado proporcionalmente dos clientes ativos."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={walletValor}
              onChange={e => setWalletValor(formatCurrencyInput(e.target.value))}
              placeholder="0,00"
            />
            <div className="flex gap-2 mt-2">
              {[500, 1000, 2000, 5000].map(v => (
                <Button key={v} type="button" variant="outline" size="sm" className="flex-1 text-xs"
                  onClick={() => setWalletValor(formatCurrencyInput(String(v * 100)))}>
                  R$ {v.toLocaleString("pt-BR")}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletDialog(null)}>Cancelar</Button>
            <Button onClick={handleWalletOperation} disabled={!walletValor || parseCurrency(walletValor) <= 0}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Deposit/Withdraw Dialog */}
      <Dialog open={!!bankDialog} onOpenChange={open => !open && setBankDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {bankDialog?.tipo === "depositar" ? "Depositar" : "Retirar"} - {bankDialog?.banco === "santander" ? "Santander" : "C6 Bank"}
            </DialogTitle>
            <DialogDescription>
              Saldo atual: {fmt(bankDialog?.banco === "santander" ? bankBalances.santander : bankBalances.c6)}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={bankValor}
              onChange={e => setBankValor(formatCurrencyInput(e.target.value))}
              placeholder="0,00"
            />
            <div className="flex gap-2 mt-2">
              {[500, 1000, 2000, 5000].map(v => (
                <Button key={v} type="button" variant="outline" size="sm" className="flex-1 text-xs"
                  onClick={() => setBankValor(formatCurrencyInput(String(v * 100)))}>
                  R$ {v.toLocaleString("pt-BR")}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialog(null)}>Cancelar</Button>
            <Button onClick={handleBankOperation} disabled={!bankValor || parseCurrency(bankValor) <= 0}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zerar Confirmation */}
      <AlertDialog open={confirmZerar} onOpenChange={setConfirmZerar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zerar saldo da carteira?</AlertDialogTitle>
            <AlertDialogDescription>
              O saldo da carteira será zerado. Os dados dos clientes e o histórico não serão alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleZerar} className="bg-destructive text-destructive-foreground">Zerar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Client History Dialog */}
      <Dialog open={!!historicoCliente} onOpenChange={open => !open && setHistoricoCliente(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Histórico — {historicoCliente?.nome}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Histórico de transações de {historicoCliente?.nome}
            </DialogDescription>
          </DialogHeader>

          {/* Summary */}
          {transacoes.length > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-primary/10 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Depósitos</p>
                <p className="text-sm font-bold font-mono text-primary">
                  {fmt(transacoes.filter(t => t.tipo === "deposito").reduce((a, t) => a + t.valor, 0))}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Saques</p>
                <p className="text-sm font-bold font-mono">
                  {fmt(transacoes.filter(t => t.tipo === "saque").reduce((a, t) => a + t.valor, 0))}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Lucro</p>
                <p className="text-sm font-bold font-mono">
                  {fmt(transacoes.filter(t => t.tipo === "saque").reduce((a, t) => a + t.lucro, 0))}
                </p>
              </div>
            </div>
          )}

          {/* Transactions list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loadingTransacoes ? (
              <p className="text-center text-muted-foreground py-4">Carregando...</p>
            ) : transacoes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma transação registrada.</p>
            ) : (
              transacoes.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {t.tipo === "deposito" ? (
                      <ArrowDownCircle className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold capitalize">{t.tipo}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(t.data_transacao + "T12:00:00").toLocaleDateString("pt-BR")}
                        {t.casa && ` · ${t.casa}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold font-mono ${t.tipo === "deposito" ? "text-primary" : ""}`}>
                      {t.tipo === "deposito" ? "+" : "-"}{fmt(t.valor)}
                    </p>
                    {t.tipo === "saque" && t.lucro > 0 && (
                      <p className="text-[10px] text-muted-foreground">Lucro: {fmt(t.lucro)}</p>
                    )}
                  </div>
                  <div className="flex gap-0.5 ml-2 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                      setEditTransacao(t);
                      setEditTransValor(String(t.valor));
                      setEditTransCusto(String(t.custo));
                      setEditTransData(new Date(t.data_transacao + "T12:00:00"));
                    }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteTransacao(t)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={!!editTransacao} onOpenChange={open => !open && setEditTransacao(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
            <DialogDescription className="sr-only">Editar valor da transação</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-bold text-xs">Valor</Label>
              <Input type="number" min="0" step="0.01" value={editTransValor} onChange={e => setEditTransValor(e.target.value)} className="mt-1" />
            </div>
            {editTransacao?.tipo === "saque" && (
              <div>
                <Label className="font-bold text-xs">Custo da Conta</Label>
                <Input type="number" min="0" step="0.01" value={editTransCusto} onChange={e => setEditTransCusto(e.target.value)} className="mt-1" />
              </div>
            )}
            <div>
              <Label className="font-bold text-xs">Data da Transação</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1 justify-start text-left font-normal text-xs">
                    <CalendarDays className="mr-2 h-3.5 w-3.5" />
                    {format(editTransData, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={editTransData} onSelect={d => d && setEditTransData(d)} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTransacao(null)}>Cancelar</Button>
            <Button onClick={handleEditTransacao} disabled={!editTransValor || parseFloat(editTransValor) <= 0}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Transaction Confirmation */}
      <AlertDialog open={!!deleteTransacao} onOpenChange={open => !open && setDeleteTransacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação reverterá os valores no cliente e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransacao} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Links Dialog */}
      <Dialog open={shareLinkDialogOpen} onOpenChange={setShareLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Links Compartilháveis</DialogTitle>
            <DialogDescription>Crie links individuais para cada pessoa gerenciar seus clientes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Create new link */}
            <div className="flex gap-2">
              <Input
                placeholder="Nick da pessoa (ex: João)"
                value={newLinkNick}
                onChange={e => setNewLinkNick(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreateShareLink()}
              />
              <Button onClick={handleCreateShareLink} disabled={shareLinkLoading || !newLinkNick.trim()} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Criar
              </Button>
            </div>

            {/* Admin: Create viewer link */}
            {isAdmin && (
              <div className="border border-dashed border-primary/40 rounded-lg p-3 space-y-2">
                <p className="text-xs font-bold flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-primary" /> Link de Visualização (Admin)
                </p>
                <p className="text-[10px] text-muted-foreground">Quem acessar verá <strong>todos</strong> os clientes, mas sem poder editar.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={shareLinkLoading}
                  onClick={async () => {
                    if (!user) return;
                    setShareLinkLoading(true);
                    try {
                      const { error } = await supabase
                        .from("delay_share_links")
                        .insert({ user_id: user.id, nick: "Visualizador", tipo: "visualizador" } as any);
                      if (error) throw error;
                      await fetchShareLinks();
                      toast({ title: "Link de visualização criado!" });
                    } catch (err: any) {
                      toast({ title: "Erro", description: getSafeErrorMessage(err), variant: "destructive" });
                    } finally {
                      setShareLinkLoading(false);
                    }
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" /> Criar Link de Visualização
                </Button>
              </div>
            )}

            {/* Admin: Create person viewer link */}
            {isAdmin && (
              <div className="border border-dashed border-purple-500/40 rounded-lg p-3 space-y-2">
                <p className="text-xs font-bold flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-purple-400" /> Link de Visualização (Pessoa)
                </p>
                <p className="text-[10px] text-muted-foreground">Crie links de visualização para pessoas específicas. Atribua clientes a cada link na tela de edição.</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da pessoa (ex: João)"
                    value={newLinkNick}
                    onChange={e => setNewLinkNick(e.target.value)}
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={shareLinkLoading || !newLinkNick.trim()}
                    onClick={async () => {
                      if (!user) return;
                      setShareLinkLoading(true);
                      try {
                        const { error } = await supabase
                          .from("delay_share_links")
                          .insert({ user_id: user.id, nick: newLinkNick.trim(), tipo: "visualizador_pessoa" } as any);
                        if (error) throw error;
                        setNewLinkNick("");
                        await fetchShareLinks();
                        toast({ title: `Link de visualização para "${newLinkNick.trim()}" criado!` });
                      } catch (err: any) {
                        toast({ title: "Erro", description: getSafeErrorMessage(err), variant: "destructive" });
                      } finally {
                        setShareLinkLoading(false);
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Criar
                  </Button>
                </div>
              </div>
            )}

            {/* List of links */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {shareLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum link criado ainda.</p>
              ) : (
                shareLinks.map(link => (
                  <div key={link.id} className={`flex items-center justify-between p-3 rounded-lg border ${link.ativo ? "border-border" : "border-border/30 opacity-50"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate flex items-center gap-1.5">
                        {link.nick || "Sem nick"}
                        {link.tipo === "visualizador" && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            <Eye className="h-2.5 w-2.5 mr-0.5" /> Visualização
                          </Badge>
                        )}
                        {(link.tipo === "visualizador_vodka" || link.tipo === "visualizador_pessoa") && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-500/50 text-purple-400">
                            <Eye className="h-2.5 w-2.5 mr-0.5" /> Pessoa
                          </Badge>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {link.ativo ? "Ativo" : "Revogado"}
                      </p>
                    </div>
                    {link.ativo && (
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyShareLink(link.token, link.tipo || "editor")} title="Copiar link">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRevokeShareLink(link.id)} title="Revogar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {shareLinks.some(l => !l.ativo) && (
              <Button variant="outline" size="sm" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleClearRevokedLinks}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Limpar revogados
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Notepad Dialog */}
      <Dialog open={notaOpen} onOpenChange={setNotaOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-primary" />
              Bloco de Notas
            </DialogTitle>
            <DialogDescription>Suas anotações são salvas automaticamente na sua conta.</DialogDescription>
          </DialogHeader>
          {notaLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">Carregando...</div>
          ) : (
            <div className="space-y-3">
              <Textarea
                placeholder="Escreva suas anotações aqui..."
                value={notaConteudo}
                onChange={(e) => setNotaConteudo(e.target.value)}
                className="min-h-[200px] resize-y font-mono text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUndoNota}
                  disabled={notaHistory.length <= 1}
                  className="text-xs gap-1"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Desfazer
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveNota}
                  disabled={notaSaving}
                  className="text-xs gap-1"
                >
                  {notaSaving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve deposit with link selection dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aprovar Depósito</DialogTitle>
            <DialogDescription>
              Escolha em qual link externo o cliente será exibido.
            </DialogDescription>
          </DialogHeader>
          {approveCliente && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Cliente: <span className="font-bold text-foreground">{approveCliente.nome}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Valor: <span className="font-bold text-emerald-400">R$ {(approveCliente.deposito_pendente || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <Label className="font-bold">Exibir no Link</Label>
                <Select value={approveLinkChoice} onValueChange={setApproveLinkChoice}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o link" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_admin">Visualização Admin</SelectItem>
                    {shareLinks.filter(l => l.ativo && l.tipo === "visualizador_pessoa").map(link => (
                      <SelectItem key={link.id} value={link.id}>{link.nick || "Sem nick"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={confirmApproveDeposit}>Aprovar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        size="icon"
        onClick={() => setNotaOpen(true)}
        className="fixed bottom-6 right-4 z-30 h-12 w-12 rounded-full shadow-lg md:hidden"
        aria-label="Abrir bloco de notas"
      >
        <StickyNote className="h-5 w-5" />
      </Button>
    </div>
  );
};

export default DelayEsportivo;
