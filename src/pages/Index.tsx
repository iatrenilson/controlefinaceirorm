import { useState, useEffect, useMemo } from "react";
import { format, parseISO, isPast, differenceInMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Plus, TrendingUp, TrendingDown, Wallet, Calendar as CalendarIcon, Pencil, Trash2, Loader2, Search, DollarSign, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safe-error";

interface FormFieldsProps {
  desc: string; setDesc: (v: string) => void;
  val: string; setVal: (v: string) => void;
  tp: "receita" | "despesa"; setTp: (v: "receita" | "despesa") => void;
  dc: Date | undefined; setDc: (v: Date | undefined) => void;
  dt: Date | undefined; setDt: (v: Date | undefined) => void;
}

const FormFields = ({ desc, setDesc, val, setVal, tp, setTp, dc, setDc, dt, setDt }: FormFieldsProps) => (
  <>
    <div className="space-y-2">
      <Label>Tipo</Label>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={tp === "despesa" ? "default" : "outline"}
          className={cn("w-full", tp === "despesa" && "bg-orange-500 hover:bg-orange-600 text-white")}
          onClick={() => setTp("despesa")}
        >
          <TrendingDown className="h-4 w-4 mr-2" />
          Despesas
        </Button>
        <Button
          type="button"
          variant={tp === "receita" ? "default" : "outline"}
          className={cn("w-full", tp === "receita" && "bg-green-600 hover:bg-green-700 text-white")}
          onClick={() => setTp("receita")}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Receita
        </Button>
      </div>
    </div>
    <div className="space-y-2">
      <Label>Descrição</Label>
      <Input placeholder="Ex: Salário, Aluguel..." value={desc} onChange={(e) => setDesc(e.target.value.toUpperCase())} maxLength={200} required />
    </div>
    <div className="space-y-2">
      <Label>Valor (R$)</Label>
      <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={val} onChange={(e) => setVal(e.target.value)} required />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label>Data de Compra</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dc && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dc ? format(dc, "dd/MM/yyyy") : "Selecione"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dc} onSelect={setDc} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2">
        <Label>Data de Vencimento</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dt && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dt ? format(dt, "dd/MM/yyyy") : "Selecione"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dt} onSelect={setDt} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  </>
);

interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  dataCompra: string;
  dataVencimento: string;
  status: "paga" | "vencida" | "em_aberto";
  parcelas: number | null;
  parcelaAtual: number | null;
  createdAt: string;
  ultimoPagamento: string | null;
}

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);

  // Add dialog
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [dataCompra, setDataCompra] = useState<Date>();
  const [dataVencimento, setDataVencimento] = useState<Date>();
  const [parcelas, setParcelas] = useState("");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDescricao, setEditDescricao] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editTipo, setEditTipo] = useState<"receita" | "despesa">("receita");
  const [editStatus, setEditStatus] = useState<"em_aberto" | "paga" | "vencida">("em_aberto");
  const [editDataCompra, setEditDataCompra] = useState<Date>();
  const [editDataVencimento, setEditDataVencimento] = useState<Date>();
  const [editParcelas, setEditParcelas] = useState("");
  const [editParcelaAtual, setEditParcelaAtual] = useState("");

  // Filters
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "receita" | "despesa">("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "paga" | "vencida" | "em_aberto">("todos");
  const [filtroMes, setFiltroMes] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const [mostrarPagas, setMostrarPagas] = useState(false);
  const [pagasOpen, setPagasOpen] = useState(true);
  const [filtroMesPagas, setFiltroMesPagas] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const [mesDespesas, setMesDespesas] = useState(() => format(new Date(), "yyyy-MM"));

  // Cartão de Crédito
  interface CartaoItem { id: string; cartao: string; descricao: string; valor: number; data_compra: string; data_vencimento: string | null; quantidade: number; }
  const [cartaoItens, setCartaoItens] = useState<CartaoItem[]>([]);
  const [cartaoOpen, setCartaoOpen] = useState(false);
  const [cartaoNome, setCartaoNome] = useState("");
  const [cartaoDesc, setCartaoDesc] = useState("");
  const [cartaoValor, setCartaoValor] = useState("");
  const [cartaoDataCompra, setCartaoDataCompra] = useState<Date>(new Date());
  const [cartaoDataVencimento, setCartaoDataVencimento] = useState<Date | undefined>(undefined);
  const [cartaoQuantidade, setCartaoQuantidade] = useState("1");
  const [cartaoSectionOpen, setCartaoSectionOpen] = useState(true);
  const [cartaoExpandidos, setCartaoExpandidos] = useState<Set<string>>(new Set());
  const toggleCartao = (nome: string) => setCartaoExpandidos(prev => { const s = new Set(prev); s.has(nome) ? s.delete(nome) : s.add(nome); return s; });
  const [cartaoEditOpen, setCartaoEditOpen] = useState(false);
  const [cartaoEditId, setCartaoEditId] = useState<string>("");
  const [cartaoEditNome, setCartaoEditNome] = useState("");
  const [cartaoEditDesc, setCartaoEditDesc] = useState("");
  const [cartaoEditValor, setCartaoEditValor] = useState("");
  const [cartaoEditDataCompra, setCartaoEditDataCompra] = useState<Date>(new Date());
  const [cartaoEditDataVenc, setCartaoEditDataVenc] = useState<Date | undefined>(undefined);
  const [cartaoEditQtd, setCartaoEditQtd] = useState("1");

  const openCartaoEdit = (item: CartaoItem) => {
    setCartaoEditId(item.id);
    setCartaoEditNome(item.cartao);
    setCartaoEditDesc(item.descricao);
    setCartaoEditValor(String(item.valor));
    setCartaoEditDataCompra(parseISO(item.data_compra));
    setCartaoEditDataVenc(item.data_vencimento ? parseISO(item.data_vencimento) : undefined);
    setCartaoEditQtd(String(item.quantidade));
    setCartaoEditOpen(true);
  };

  const handleEditCartaoItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartaoEditId || !cartaoEditNome.trim() || !cartaoEditDesc.trim() || !cartaoEditValor) return;
    const { error } = await supabase.from("cartao_itens").update({
      cartao: cartaoEditNome.trim().toUpperCase(),
      descricao: cartaoEditDesc.trim().toUpperCase(),
      valor: parseFloat(cartaoEditValor),
      data_compra: format(cartaoEditDataCompra, "yyyy-MM-dd"),
      data_vencimento: cartaoEditDataVenc ? format(cartaoEditDataVenc, "yyyy-MM-dd") : null,
      quantidade: parseInt(cartaoEditQtd) || 1,
    }).eq("id", cartaoEditId);
    if (error) { toast.error("Erro ao editar item"); return; }
    toast.success("Item atualizado!");
    setCartaoEditOpen(false);
    fetchCartaoItens();
  };

  const fetchCartaoItens = async () => {
    if (!user) return;
    const { data } = await supabase.from("cartao_itens").select("*").eq("user_id", user.id).order("data_vencimento", { ascending: true });
    setCartaoItens((data || []).map((d: any) => ({ id: d.id, cartao: d.cartao, descricao: d.descricao, valor: Number(d.valor), data_compra: d.data_compra, data_vencimento: d.data_vencimento ?? null, quantidade: d.quantidade ?? 1 })));
  };

  const handleAddCartaoItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !cartaoNome.trim() || !cartaoDesc.trim() || !cartaoValor) return;
    const { error } = await supabase.from("cartao_itens").insert({
      user_id: user.id, cartao: cartaoNome.trim().toUpperCase(),
      descricao: cartaoDesc.trim().toUpperCase(), valor: parseFloat(cartaoValor),
      data_compra: format(cartaoDataCompra, "yyyy-MM-dd"),
      data_vencimento: cartaoDataVencimento ? format(cartaoDataVencimento, "yyyy-MM-dd") : null,
      quantidade: parseInt(cartaoQuantidade) || 1,
    });
    if (error) { toast.error("Erro ao adicionar item"); return; }
    toast.success("Item adicionado!");
    setCartaoDesc(""); setCartaoValor(""); setCartaoQuantidade("1"); setCartaoDataVencimento(undefined); setCartaoOpen(false);
    fetchCartaoItens();
  };

  const handleDeleteCartaoItem = async (id: string) => {
    await supabase.from("cartao_itens").delete().eq("id", id);
    setCartaoItens(prev => prev.filter(i => i.id !== id));
  };

  const fetchTransacoes = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("financeiro")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar transações");
      return;
    }

    setTransacoes(
      (data || []).map((d: any) => ({
        id: d.id,
        descricao: d.descricao,
        valor: Number(d.valor),
        tipo: d.tipo,
        dataCompra: d.data_compra,
        dataVencimento: d.data_vencimento,
        status: d.status,
        parcelas: d.parcelas,
        parcelaAtual: d.parcela_atual,
        createdAt: d.created_at,
        ultimoPagamento: d.ultimo_pagamento,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    if (user) { fetchTransacoes(); fetchCartaoItens(); }
  }, [user]);

  const resetForm = () => {
    setDescricao("");
    setValor("");
    setTipo("despesa");
    setDataCompra(undefined);
    setDataVencimento(undefined);
    setParcelas("");
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim() || !valor || !dataVencimento || !user) return;

    const val = parseFloat(valor);
    if (isNaN(val) || val <= 0) {
      toast.error("Valor inválido");
      return;
    }

    const numParcelas = parcelas ? parseInt(parcelas) : null;
    const { error } = await supabase.from("financeiro").insert({
      user_id: user.id,
      descricao: descricao.trim().toUpperCase(),
      valor: val,
      tipo,
      data_compra: dataCompra ? format(dataCompra, "yyyy-MM-dd") : null,
      data_vencimento: format(dataVencimento, "yyyy-MM-dd"),
      status: "em_aberto",
      parcelas: numParcelas && numParcelas > 0 ? numParcelas : null,
      parcela_atual: numParcelas && numParcelas > 0 ? numParcelas : null,
    });

    if (error) {
      toast.error("Erro ao cadastrar: " + getSafeErrorMessage(error));
      return;
    }

    resetForm();
    setOpen(false);
    fetchTransacoes();
    toast.success("Transação cadastrada com sucesso!");
  };

  const openEdit = (t: Transacao) => {
    setEditId(t.id);
    setEditDescricao(t.descricao.toUpperCase());
    setEditValor(String(t.valor));
    setEditTipo(t.tipo);
    setEditStatus(t.status as "em_aberto" | "paga" | "vencida");
    setEditDataCompra(t.dataCompra ? parseISO(t.dataCompra) : undefined);
    setEditDataVencimento(parseISO(t.dataVencimento));
    setEditParcelas(t.parcelas ? String(t.parcelas) : "");
    setEditParcelaAtual(t.parcelaAtual ? String(t.parcelaAtual) : "");
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDescricao.trim() || !editValor || !editDataVencimento || !editId) return;

    const val = parseFloat(editValor);
    if (isNaN(val) || val <= 0) {
      toast.error("Valor inválido");
      return;
    }

    const { error } = await supabase
      .from("financeiro")
      .update({
        descricao: editDescricao.trim().toUpperCase(),
        valor: val,
        tipo: editTipo,
        status: editStatus,
        data_compra: editDataCompra ? format(editDataCompra, "yyyy-MM-dd") : null,
        data_vencimento: format(editDataVencimento, "yyyy-MM-dd"),
        parcelas: editParcelas ? parseInt(editParcelas) : null,
        parcela_atual: editParcelaAtual ? parseInt(editParcelaAtual) : null,
      })
      .eq("id", editId);

    if (error) {
      toast.error("Erro ao editar: " + getSafeErrorMessage(error));
      return;
    }

    setEditOpen(false);
    fetchTransacoes();
    toast.success("Transação atualizada!");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("financeiro").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    fetchTransacoes();
    toast.success("Transação excluída!");
  };

  const handleMarkPaid = async (id: string) => {
    const t = transacoes.find((t) => t.id === id);
    if (!t) return;

    // Se tem parcelas, diminui a parcela atual e avança o vencimento 1 mês
    if (t.parcelaAtual && t.parcelaAtual > 1) {
      const novaData = addMonths(parseISO(t.dataVencimento), 1);
      const novaDataStr = format(novaData, "yyyy-MM-dd");
      const { error } = await supabase
        .from("financeiro")
        .update({
          parcela_atual: t.parcelaAtual - 1,
          data_vencimento: novaDataStr,
          ultimo_pagamento: format(new Date(), "yyyy-MM-dd"),
        })
        .eq("id", id);
      if (error) {
        toast.error("Erro ao confirmar pagamento");
        return;
      }
      fetchTransacoes();
      const pago = (t.parcelas || 0) - (t.parcelaAtual - 1);
      toast.success(`Parcela ${pago - 1}/${t.parcelas} paga! Próximo vencimento: ${format(novaData, "dd/MM/yyyy")}`);
    } else {
      const { error } = await supabase.from("financeiro").update({ status: "paga" }).eq("id", id);
      if (error) {
        toast.error("Erro ao confirmar pagamento");
        return;
      }
      fetchTransacoes();
      toast.success("Pagamento confirmado!");
    }
  };

  const gruposCartaoFiltrados = useMemo(() => {
    const itensFiltrados = cartaoItens.filter(item => {
      if (filtroMes === "todos") return true;
      const dataRef = item.data_vencimento ?? item.data_compra;
      if (!dataRef) return true;
      const [ano, mes] = filtroMes.split("-").map(Number);
      const d = parseISO(dataRef);
      const dvAno = d.getFullYear();
      const dvMes = d.getMonth() + 1;
      if (item.quantidade > 1) {
        const monthDiff = (ano - dvAno) * 12 + (mes - dvMes);
        // aparece do mês do vencimento até o último mês de pagamento
        return monthDiff >= 0 && monthDiff < item.quantidade;
      } else {
        // item único: só no mês exato
        return dvAno === ano && dvMes === mes;
      }
    });
    return itensFiltrados.reduce<Record<string, CartaoItem[]>>((acc, i) => {
      if (!acc[i.cartao]) acc[i.cartao] = [];
      acc[i.cartao].push(i);
      return acc;
    }, {});
  }, [cartaoItens, filtroMes]);

  const filtered = useMemo(() => {
    return transacoes.filter((t) => {
      // Se mostrarPagas está ativo, mostra apenas as pagas
      if (mostrarPagas) {
        if (t.status !== "paga") return false;
      } else {
        // Por padrão, esconde as pagas
        if (t.status === "paga") return false;
      }
      if (busca && !t.descricao.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroTipo !== "todos" && t.tipo !== filtroTipo) return false;
      if (!mostrarPagas && filtroStatus !== "todos" && t.status !== filtroStatus) return false;
      if (filtroMes !== "todos") {
        const [ano, mes] = filtroMes.split("-").map(Number);
        const d = parseISO(t.dataVencimento);
        const dvAno = d.getFullYear();
        const dvMes = d.getMonth() + 1;
        const parcelasRestantes = t.parcelas && t.parcelas > 1 && t.status !== "paga" ? (t.parcelaAtual ?? 0) : 0;
        if (parcelasRestantes > 0) {
          const monthDiff = (ano - dvAno) * 12 + (mes - dvMes);
          // aparece do mês do vencimento até o último mês de pagamento
          if (monthDiff < 0 || monthDiff >= parcelasRestantes) return false;
        } else {
          // sem parcelas: só aparece no mês exato
          if (dvAno !== ano || dvMes !== mes) return false;
        }
      }
      return true;
    });
  }, [transacoes, busca, filtroTipo, filtroStatus, filtroMes, mostrarPagas]);

  const stats = useMemo(() => {
    const receitas = transacoes.filter((t) => t.tipo === "receita").reduce((a, t) => a + t.valor, 0);
    const despesas = transacoes.filter((t) => t.tipo === "despesa").reduce((a, t) => a + t.valor, 0);
    const saldo = receitas - despesas;
    const vencidas = transacoes.filter((t) => t.status === "vencida" || (t.status === "em_aberto" && isPast(parseISO(t.dataVencimento)))).length;
    const vencidasAPagar = transacoes.filter((t) => t.status !== "paga" && (t.status === "vencida" || (t.status === "em_aberto" && isPast(parseISO(t.dataVencimento))))).length;
    const pagasList = transacoes.filter((t) => t.status === "paga" || (t.status !== "paga" && !!t.ultimoPagamento));
    const pagas = pagasList.length;
    const pagasTotal = pagasList.reduce((a, t) => a + t.valor, 0);
    const emAberto = transacoes.filter((t) => t.status === "em_aberto" && !isPast(parseISO(t.dataVencimento))).length;
    return { receitas, despesas, saldo, vencidas, vencidasAPagar, pagas, pagasTotal, emAberto };
  }, [transacoes]);

  const statsPagasFiltradas = useMemo(() => {
    const filtrar = (dataRef: string) => {
      if (filtroMesPagas === "todos") return true;
      const [ano, mes] = filtroMesPagas.split("-").map(Number);
      const d = parseISO(dataRef);
      return d.getFullYear() === ano && (d.getMonth() + 1) === mes;
    };
    const lista = transacoes.filter(t =>
      (t.status === "paga" || (t.status !== "paga" && !!t.ultimoPagamento)) &&
      filtrar(t.ultimoPagamento || t.dataVencimento)
    );
    return { count: lista.length, total: lista.reduce((s, t) => s + t.valor, 0) };
  }, [transacoes, filtroMesPagas]);

  const despesasMensal = useMemo(() => {
    const transTotal = filtered
      .filter(t => t.tipo === "despesa")
      .reduce((a, t) => a + t.valor, 0);
    const cartaoTotal = Object.values(gruposCartaoFiltrados).flat().reduce((s, i) => s + i.valor, 0);
    return transTotal + cartaoTotal;
  }, [filtered, gruposCartaoFiltrados]);

  const getVencimentoExibido = (t: Transacao): string => {
    if (filtroMes === "todos") return t.dataVencimento;
    const [ano, mes] = filtroMes.split("-").map(Number);
    const dv = parseISO(t.dataVencimento);
    const dvAno = dv.getFullYear();
    const dvMes = dv.getMonth() + 1;
    if (dvAno === ano && dvMes === mes) return t.dataVencimento;
    const mesesDiff = (ano - dvAno) * 12 + (mes - dvMes);
    if (mesesDiff > 0) return format(addMonths(dv, mesesDiff), "yyyy-MM-dd");
    return t.dataVencimento;
  };

  const getDisplayStatus = (t: Transacao) => {
    if (t.status === "paga") return "paga";
    if (t.status === "vencida" || (t.status === "em_aberto" && isPast(parseISO(t.dataVencimento)))) return "vencida";
    return "em_aberto";
  };

  const statusLabel = (s: string) => {
    if (s === "paga") return "Paga";
    if (s === "vencida") return "Vencida";
    return "Em Aberto";
  };

  const statusBadgeClass = (s: string) => {
    if (s === "paga") return "bg-green-600 hover:bg-green-700 text-white";
    if (s === "vencida") return "bg-destructive hover:bg-destructive/90 text-destructive-foreground";
    return "bg-blue-500 hover:bg-blue-600 text-white";
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getParcelasRestantes = (t: Transacao) => {
    if (!t.parcelas || !t.parcelaAtual) return null;
    return t.parcelas - t.parcelaAtual + 1;
  };

  const getParcelaExibida = (t: Transacao): string | null => {
    if (!t.parcelas) return null;
    const base = getParcelasRestantes(t) ?? 1;
    let avanco = 0;
    if (filtroMes !== "todos") {
      const [ano, mes] = filtroMes.split("-").map(Number);
      const dv = parseISO(t.dataVencimento);
      avanco = (ano - dv.getFullYear()) * 12 + (mes - (dv.getMonth() + 1));
      if (avanco < 0) avanco = 0;
    }
    const parcelaAtual = Math.min(base + avanco, t.parcelas);
    return `${parcelaAtual}/${t.parcelas}`;
  };


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-12 lg:top-12 z-10">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">Controle Financeiro</h1>
            <p className="text-xs text-muted-foreground">Receitas e Despesas</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" /> Cadastrar Transação
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 mt-2">
                <FormFields desc={descricao} setDesc={setDescricao} val={valor} setVal={setValor} tp={tipo} setTp={setTipo} dc={dataCompra} setDc={setDataCompra} dt={dataVencimento} setDt={setDataVencimento} />
                <div className="space-y-2">
                  <Label>Parcelas (opcional)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                      <Button
                        key={p}
                        type="button"
                        variant={parcelas === String(p) ? "default" : "outline"}
                        size="sm"
                        className="h-7 px-2.5 text-xs min-w-0"
                        onClick={() => setParcelas(parcelas === String(p) ? "" : String(p))}
                      >
                        {p}x
                      </Button>
                    ))}
                  </div>
                  <Input type="number" min="1" placeholder="Ou digite o número de parcelas" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
                </div>
                <Button type="submit" className="w-full">Cadastrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="group hover:shadow-lg transition-all hover:-translate-y-0.5">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-green-500/15 p-2.5 shrink-0">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Receitas</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-green-500 mt-0.5">
                    R$ {stats.receitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="group hover:shadow-lg transition-all hover:-translate-y-0.5">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-orange-500/15 p-2.5 shrink-0">
                  <TrendingDown className="h-5 w-5 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Despesas</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-orange-500 mt-0.5">
                    R$ {stats.despesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="group hover:shadow-lg transition-all hover:-translate-y-0.5">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-destructive/15 p-2.5 shrink-0">
                  <CalendarIcon className="h-5 w-5 text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Vencidas</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-destructive mt-0.5">
                    {stats.vencidas}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={cn(
              "group hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer",
              mostrarPagas && "ring-2 ring-emerald-500"
            )}
            onClick={() => setMostrarPagas(!mostrarPagas)}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-500/15 p-2.5 shrink-0">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Pagas</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-emerald-500 mt-0.5">
                    {statsPagasFiltradas.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{statsPagasFiltradas.count} conta{statsPagasFiltradas.count !== 1 ? "s" : ""}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="group hover:shadow-lg transition-all hover:-translate-y-0.5">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-blue-500/15 p-2.5 shrink-0">
                  <Wallet className="h-5 w-5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Em Aberto</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-blue-500 mt-0.5">
                    {stats.emAberto}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Despesas Mensais Card */}
        <Card className="group hover:shadow-lg transition-all">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-orange-500/15 p-2.5 shrink-0">
                <CalendarIcon className="h-5 w-5 text-orange-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Despesas {filtroMes === "todos" ? "— Todos os Meses" : `— ${format(parseISO(filtroMes + "-01"), "MMM yyyy", { locale: ptBR })}`}
                </p>
                <p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-orange-500 mt-0.5">
                  R$ {despesasMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cartão de Crédito */}
        {(() => {
          const grupos = gruposCartaoFiltrados;
          const cartaoTotalGeral = Object.values(grupos).flat().reduce((s, i) => s + i.valor, 0);
          return (
            <Card className="border border-blue-500/30 bg-blue-500/5">
              <CardHeader className="pb-2 pt-4 px-4 cursor-pointer" onClick={() => setCartaoSectionOpen(o => !o)}>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-400 shrink-0" />
                    <CardTitle className="text-sm font-semibold text-blue-400">Cartão de Crédito</CardTitle>
                    {Object.entries(grupos).map(([nome, itens]) => {
                      const total = itens.reduce((s, i) => s + i.valor, 0);
                      const isMp = nome === "MERCADO PAGO";
                      const isNu = nome === "NUBANK";
                      return (
                        <span key={nome} className={`text-xs font-mono rounded px-1.5 py-0.5 border ${isMp ? "text-blue-300 bg-blue-600/15 border-blue-500/30" : isNu ? "text-purple-300 bg-purple-600/15 border-purple-500/30" : "text-blue-300 bg-blue-500/10 border-blue-500/20"}`}>
                          {nome}: R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      );
                    })}
                    <span className="text-xs font-mono text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5">
                      Total: R$ {cartaoTotalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Dialog open={cartaoOpen} onOpenChange={setCartaoOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-blue-500/40 text-blue-400 hover:bg-blue-500/10">
                          <Plus className="h-3 w-3" /> Adicionar item
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-400" /> Adicionar Item ao Cartão</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddCartaoItem} className="space-y-3 mt-2">
                          <div className="space-y-1.5">
                            <Label>Cartão</Label>
                            <div className="flex gap-2 mb-1.5">
                              <Button type="button" size="sm" onClick={() => setCartaoNome("MERCADO PAGO")}
                                className={`flex-1 text-xs h-8 border transition-all ${cartaoNome === "MERCADO PAGO" ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700" : "bg-transparent text-blue-400 border-blue-500/50 hover:bg-blue-500/10"}`}>
                                MERCADO PAGO
                              </Button>
                              <Button type="button" size="sm" onClick={() => setCartaoNome("NUBANK")}
                                className={`flex-1 text-xs h-8 border transition-all ${cartaoNome === "NUBANK" ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700" : "bg-transparent text-purple-400 border-purple-500/50 hover:bg-purple-500/10"}`}>
                                NUBANK
                              </Button>
                            </div>
                            <Input placeholder="Ou digite outro cartão..." value={cartaoNome} onChange={e => setCartaoNome(e.target.value)} required />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Descrição do Item</Label>
                            <Input placeholder="Ex: SUPERMERCADO, NETFLIX..." value={cartaoDesc} onChange={e => setCartaoDesc(e.target.value)} required />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Valor (R$)</Label>
                            <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={cartaoValor} onChange={e => setCartaoValor(e.target.value)} required />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label>Data da Compra</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start text-left font-normal text-xs px-2">
                                    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                                    {format(cartaoDataCompra, "dd/MM/yyyy")}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar mode="single" selected={cartaoDataCompra} onSelect={d => d && setCartaoDataCompra(d)} initialFocus className="p-3 pointer-events-auto" />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Data de Vencimento</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start text-left font-normal text-xs px-2">
                                    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                                    {cartaoDataVencimento ? format(cartaoDataVencimento, "dd/MM/yyyy") : "Selecionar"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar mode="single" selected={cartaoDataVencimento} onSelect={d => setCartaoDataVencimento(d)} initialFocus className="p-3 pointer-events-auto" />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Quantidade de Parcelas</Label>
                            <div className="flex gap-2 items-center">
                              <Input type="number" min="1" max="48" placeholder="1" value={cartaoQuantidade} onChange={e => setCartaoQuantidade(e.target.value)} className="w-24" />
                              <div className="flex gap-1 flex-wrap">
                                {[1,2,3,6,12].map(n => (
                                  <Button key={n} type="button" size="sm" variant={cartaoQuantidade === String(n) ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setCartaoQuantidade(String(n))}>
                                    {n}x
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Adicionar</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    {cartaoSectionOpen ? <ChevronUp className="h-4 w-4 text-blue-400" /> : <ChevronDown className="h-4 w-4 text-blue-400" />}
                  </div>
                </div>
              </CardHeader>
              {cartaoSectionOpen && (
                <CardContent className="px-4 pb-4 space-y-4">
                  {cartaoItens.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum item de cartão cadastrado.</p>
                  ) : (
                    Object.entries(grupos).map(([nomeCartao, itens]) => {
                      const totalCartao = itens.reduce((s, i) => s + i.valor, 0);
                      const expandido = cartaoExpandidos.has(nomeCartao);
                      const isMp = nomeCartao === "MERCADO PAGO";
                      const isNu = nomeCartao === "NUBANK";
                      return (
                        <div key={nomeCartao} className="rounded-lg border border-blue-500/15 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleCartao(nomeCartao)}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-500/5 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <CreditCard className={`h-3.5 w-3.5 ${isNu ? "text-purple-400" : "text-blue-400"}`} />
                              <span className={`text-sm font-bold ${isNu ? "text-purple-300" : "text-blue-300"}`}>{nomeCartao}</span>
                              <span className="text-[10px] text-muted-foreground">{itens.length} item{itens.length !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-mono font-semibold ${isNu ? "text-purple-300" : "text-blue-300"}`}>
                                -R$ {totalCartao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                              {expandido ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </button>
                          {expandido && (
                            <div className="border-t border-blue-500/15 px-3 pb-2 pt-1 space-y-1 bg-blue-500/3">
                              {itens.map(item => (
                                <div key={item.id} className="flex items-center justify-between text-sm py-1.5">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-foreground font-medium">{item.descricao}</span>
                                      {item.quantidade > 1 && (
                                        <span className="text-[10px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/20 rounded px-1">{item.quantidade}x</span>
                                      )}
                                    </div>
                                    <div className="flex gap-3 mt-0.5">
                                      <span className="text-xs text-muted-foreground">Compra: {format(parseISO(item.data_compra), "dd/MM/yyyy")}</span>
                                      {item.data_vencimento && (
                                        <span className="text-xs text-orange-400 font-medium">Vence: {format(parseISO(item.data_vencimento), "dd/MM/yyyy")}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-2 shrink-0">
                                    <span className="font-mono text-sm text-destructive">-R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => openCartaoEdit(item)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteCartaoItem(item.id)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              )}
            </Card>
          );
        })()}

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base font-semibold">Transações</CardTitle>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8 h-9 w-full sm:w-48" />
                </div>
                <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as any)}>
                  <SelectTrigger className="h-9 w-full sm:w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="receita">Receitas</SelectItem>
                    <SelectItem value="despesa">Despesas</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
                  <SelectTrigger className="h-9 w-full sm:w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="paga">Paga</SelectItem>
                    <SelectItem value="em_aberto">Em Aberto</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroMes} onValueChange={setFiltroMes}>
                  <SelectTrigger className="h-9 w-full sm:w-36"><SelectValue placeholder="Mês" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Meses</SelectItem>
                    {Array.from({ length: 18 }, (_, i) => {
                      const now = new Date();
                      const d = new Date(now.getFullYear(), now.getMonth() - 3 + i, 1);
                      const val = format(d, "yyyy-MM");
                      const label = format(d, "MMM yyyy", { locale: ptBR });
                      const isCurrentMonth = val === format(now, "yyyy-MM");
                      return <SelectItem key={val} value={val}>{label}{isCurrentMonth ? " ★" : ""}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação encontrada.</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {Object.entries(gruposCartaoFiltrados).map(([nomeCartao, itens]) => {
                    const total = itens.reduce((s, i) => s + i.valor, 0);
                    const isNu = nomeCartao === "NUBANK";
                    const vencMin = itens.filter(i => i.data_vencimento).sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""))[0]?.data_vencimento;
                    return (
                      <div key={`cartao-m-${nomeCartao}`} className={`border rounded-lg p-3 space-y-1 ${isNu ? "border-purple-500/30 bg-purple-500/5" : "border-blue-500/30 bg-blue-500/5"}`}>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={isNu ? "border-purple-500/40 text-purple-400" : "border-blue-500/40 text-blue-400"}>
                            <CreditCard className="h-3 w-3 mr-1" />Cartão
                          </Badge>
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Em Aberto</Badge>
                        </div>
                        <p className={`text-sm font-bold ${isNu ? "text-purple-300" : "text-blue-300"}`}>{nomeCartao}</p>
                        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                          <span>Valor: <span className={`font-mono font-semibold ${isNu ? "text-purple-300" : "text-blue-300"}`}>-R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                          <span>Itens: <span className="text-foreground">{itens.length}</span></span>
                          <span>Vencimento: <span className="text-foreground">{vencMin ? format(parseISO(vencMin), "dd/MM/yy") : "—"}</span></span>
                        </div>
                      </div>
                    );
                  })}
                  {filtered.map((t) => {
                    const displayStatus = getDisplayStatus(t);
                    return (
                      <div key={t.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={t.tipo === "receita" ? "border-green-500/30 text-green-500" : "border-orange-500/30 text-orange-500"}>
                              {t.tipo === "receita" ? "Receita" : "Despesa"}
                            </Badge>
                            <Badge className={statusBadgeClass(displayStatus)}>{statusLabel(displayStatus)}</Badge>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {displayStatus !== "paga" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-success hover:text-success/80">
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar pagamento?</AlertDialogTitle>
                                    <AlertDialogDescription>Deseja marcar esta transação como paga?</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleMarkPaid(t.id)} className="bg-success hover:bg-success/90">Confirmar</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive/80">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
                                  <AlertDialogDescription>A transação "{t.descricao}" será excluída permanentemente.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(t.id)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-foreground">{t.descricao}</p>
                        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                          <span>Valor: <span className="font-mono font-semibold text-foreground">{t.tipo === "receita" ? "+" : "-"}R$ {t.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                          <span>Parcelas: <span className="font-mono text-foreground">{getParcelaExibida(t) ?? "-"}</span></span>
                          <span>Vencimento: <span className="text-foreground">{format(parseISO(getVencimentoExibido(t)), "dd/MM/yy")}</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Parcelas</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(gruposCartaoFiltrados).map(([nomeCartao, itens]) => {
                        const total = itens.reduce((s, i) => s + i.valor, 0);
                        const isNu = nomeCartao === "NUBANK";
                        const vencMin = itens.filter(i => i.data_vencimento).sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""))[0]?.data_vencimento;
                        return (
                          <TableRow key={`cartao-${nomeCartao}`} className={isNu ? "bg-purple-500/5 hover:bg-purple-500/10" : "bg-blue-500/5 hover:bg-blue-500/10"}>
                            <TableCell>
                              <Badge variant="outline" className={isNu ? "border-purple-500/40 text-purple-400" : "border-blue-500/40 text-blue-400"}>
                                <CreditCard className="h-3 w-3 mr-1" />Cartão
                              </Badge>
                            </TableCell>
                            <TableCell className={`font-bold ${isNu ? "text-purple-300" : "text-blue-300"}`}>{nomeCartao}</TableCell>
                            <TableCell className={`font-mono font-semibold ${isNu ? "text-purple-300" : "text-blue-300"}`}>
                              -R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">—</TableCell>
                            <TableCell className="text-foreground">{vencMin ? format(parseISO(vencMin), "dd/MM/yyyy") : "—"}</TableCell>
                            <TableCell><Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Em Aberto</Badge></TableCell>
                            <TableCell />
                          </TableRow>
                        );
                      })}
                      {filtered.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <Badge variant="outline" className={t.tipo === "receita" ? "border-green-500/30 text-green-500" : "border-orange-500/30 text-orange-500"}>
                              {t.tipo === "receita" ? "Receita" : "Despesa"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{t.descricao}</TableCell>
                          <TableCell className="font-mono font-semibold text-foreground">
                            {t.tipo === "receita" ? "+" : "-"}R$ {t.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-foreground text-center">
                            {getParcelaExibida(t) ?? "-"}
                          </TableCell>
                          <TableCell className="text-foreground">{format(parseISO(getVencimentoExibido(t)), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            <Badge className={statusBadgeClass(getDisplayStatus(t))}>{statusLabel(getDisplayStatus(t))}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {getDisplayStatus(t) !== "paga" && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success/80" title="Confirmar pagamento">
                                      <CheckCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Confirmar pagamento?</AlertDialogTitle>
                                      <AlertDialogDescription>Deseja marcar esta transação como paga? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleMarkPaid(t.id)} className="bg-success hover:bg-success/90">Confirmar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/80">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
                                    <AlertDialogDescription>A transação "{t.descricao}" será excluída permanentemente.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(t.id)}>Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

      {/* Contas Pagas */}
      {(() => {
        const filtrarPorMesPagas = (dataRef: string) => {
          if (filtroMesPagas === "todos") return true;
          const [ano, mes] = filtroMesPagas.split("-").map(Number);
          const d = parseISO(dataRef);
          return d.getFullYear() === ano && (d.getMonth() + 1) === mes;
        };
        const pagas = transacoes.filter(t => t.status === "paga" && filtrarPorMesPagas(t.ultimoPagamento || t.dataVencimento));
        const parcelasRecentes = transacoes.filter(t => t.status !== "paga" && t.ultimoPagamento && filtrarPorMesPagas(t.ultimoPagamento));
        const itens = [...pagas, ...parcelasRecentes].sort((a, b) => {
          const da = a.ultimoPagamento || a.dataVencimento;
          const db = b.ultimoPagamento || b.dataVencimento;
          return db.localeCompare(da);
        });
        const totalPagas = transacoes.filter(t => t.status === "paga" || (t.status !== "paga" && t.ultimoPagamento)).length;
        if (totalPagas === 0) return null;
        return (
          <Card className="border border-green-500/30 bg-green-500/5">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPagasOpen(o => !o)}>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <CardTitle className="text-sm font-semibold text-green-400">Contas Pagas / Parcelas Pagas</CardTitle>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">{itens.length}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={filtroMesPagas} onValueChange={setFiltroMesPagas}>
                    <SelectTrigger className="h-7 w-32 text-xs border-green-500/30 bg-green-500/10 text-green-400" onClick={e => e.stopPropagation()}>
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {Array.from({ length: 18 }, (_, i) => {
                        const now = new Date();
                        const d = new Date(now.getFullYear(), now.getMonth() - 3 + i, 1);
                        const val = format(d, "yyyy-MM");
                        const label = format(d, "MMM yyyy", { locale: ptBR });
                        const isCurrent = val === format(now, "yyyy-MM");
                        return <SelectItem key={val} value={val}>{label}{isCurrent ? " ★" : ""}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  <div className="cursor-pointer" onClick={() => setPagasOpen(o => !o)}>
                    {pagasOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </div>
            </CardHeader>
            {pagasOpen && (
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {itens.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta paga neste mês.</p>
                  )}
                  {itens.map(t => {
                    const isParcela = t.parcelas && t.parcelas > 1 && t.status !== "paga";
                    const pagoEm = t.ultimoPagamento ? format(parseISO(t.ultimoPagamento), "dd/MM/yyyy", { locale: ptBR }) : "—";
                    const parcelaLabel = isParcela
                      ? `Parcela ${(t.parcelas ?? 0) - (t.parcelaAtual ?? 0)}/${t.parcelas} paga`
                      : t.parcelas && t.parcelas > 1
                      ? `${t.parcelas}/${t.parcelas} parcelas — Quitado`
                      : "Paga";
                    return (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{t.descricao}</p>
                            <p className="text-[11px] text-muted-foreground">{parcelaLabel} · {pagoEm}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="font-mono font-bold text-sm text-green-400">
                            -{t.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })()}
      </main>

      {/* Cartão Edit Dialog */}
      <Dialog open={cartaoEditOpen} onOpenChange={setCartaoEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> Editar Item do Cartão</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditCartaoItem} className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label>Cartão</Label>
              <div className="flex gap-2 mb-1.5">
                <Button type="button" size="sm" onClick={() => setCartaoEditNome("MERCADO PAGO")}
                  className={`flex-1 text-xs h-8 border transition-all ${cartaoEditNome === "MERCADO PAGO" ? "bg-blue-600 text-white border-blue-600" : "bg-transparent text-blue-400 border-blue-500/50 hover:bg-blue-500/10"}`}>
                  MERCADO PAGO
                </Button>
                <Button type="button" size="sm" onClick={() => setCartaoEditNome("NUBANK")}
                  className={`flex-1 text-xs h-8 border transition-all ${cartaoEditNome === "NUBANK" ? "bg-purple-600 text-white border-purple-600" : "bg-transparent text-purple-400 border-purple-500/50 hover:bg-purple-500/10"}`}>
                  NUBANK
                </Button>
              </div>
              <Input placeholder="Ou digite outro cartão..." value={cartaoEditNome} onChange={e => setCartaoEditNome(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={cartaoEditDesc} onChange={e => setCartaoEditDesc(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0.01" value={cartaoEditValor} onChange={e => setCartaoEditValor(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data da Compra</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal text-xs px-2">
                      <CalendarIcon className="mr-1 h-3.5 w-3.5" />{format(cartaoEditDataCompra, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={cartaoEditDataCompra} onSelect={d => d && setCartaoEditDataCompra(d)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label>Data de Vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal text-xs px-2">
                      <CalendarIcon className="mr-1 h-3.5 w-3.5" />{cartaoEditDataVenc ? format(cartaoEditDataVenc, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={cartaoEditDataVenc} onSelect={d => setCartaoEditDataVenc(d)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Parcelas</Label>
              <div className="flex gap-2 items-center">
                <Input type="number" min="1" max="48" value={cartaoEditQtd} onChange={e => setCartaoEditQtd(e.target.value)} className="w-24" />
                <div className="flex gap-1 flex-wrap">
                  {[1,2,3,6,12].map(n => (
                    <Button key={n} type="button" size="sm" variant={cartaoEditQtd === String(n) ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setCartaoEditQtd(String(n))}>
                      {n}x
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full">Salvar Alterações</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" /> Editar Transação
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <FormFields desc={editDescricao} setDesc={setEditDescricao} val={editValor} setVal={setEditValor} tp={editTipo} setTp={setEditTipo} dc={editDataCompra} setDc={setEditDataCompra} dt={editDataVencimento} setDt={setEditDataVencimento} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Parcelas (opcional)</Label>
                <Input type="number" min="1" placeholder="Total" value={editParcelas} onChange={(e) => setEditParcelas(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Parcela Atual</Label>
                <Input type="number" min="0" placeholder="Restante" value={editParcelaAtual} onChange={(e) => setEditParcelaAtual(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <div className="flex gap-2">
                {(["em_aberto", "paga", "vencida"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={editStatus === s ? "default" : "outline"}
                    className={cn(
                      "flex-1",
                      editStatus === s && s === "em_aberto" && "bg-blue-500 text-white hover:bg-blue-600",
                      editStatus === s && s === "paga" && "bg-success text-success-foreground hover:bg-success/90",
                      editStatus === s && s === "vencida" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                    )}
                    onClick={() => setEditStatus(s)}
                  >
                    {s === "em_aberto" ? "Em Aberto" : s === "paga" ? "Paga" : "Vencida"}
                  </Button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full">Salvar Alterações</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
