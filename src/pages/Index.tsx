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
import { Plus, TrendingUp, TrendingDown, Wallet, Calendar as CalendarIcon, Pencil, Trash2, Loader2, Search, DollarSign, CheckCircle, AlertTriangle } from "lucide-react";
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
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [mostrarPagas, setMostrarPagas] = useState(false);
  const [mesDespesas, setMesDespesas] = useState(() => format(new Date(), "yyyy-MM"));

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
    if (user) fetchTransacoes();
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

    const hoje = format(new Date(), "yyyy-MM-dd");

    if (t.parcelas && t.parcelaAtual && t.parcelaAtual > 1) {
      // Parcelas restantes > 1: decrementa e avança vencimento
      const proximoVencimento = addMonths(parseISO(t.dataVencimento), 1);
      const novaParcelaAtual = t.parcelaAtual - 1;
      const novoVencimento = format(proximoVencimento, "yyyy-MM-dd");

      // Atualiza estado local imediatamente — sem fetchTransacoes para não reverter
      setTransacoes(prev => prev.map(item =>
        item.id === id
          ? { ...item, parcelaAtual: novaParcelaAtual, dataVencimento: novoVencimento, ultimoPagamento: hoje }
          : item
      ));

      const { error } = await supabase
        .from("financeiro")
        .update({
          parcela_atual: novaParcelaAtual,
          data_vencimento: novoVencimento,
          ultimo_pagamento: hoje,
        })
        .eq("id", id);

      if (error) {
        toast.error("Erro ao confirmar pagamento");
        fetchTransacoes(); // reverte apenas em caso de erro
        return;
      }
      toast.success(`Parcela paga! Restam ${novaParcelaAtual} de ${t.parcelas} parcela(s). Próximo vencimento: ${format(proximoVencimento, "dd/MM/yyyy")}.`);

    } else if (t.parcelas && t.parcelaAtual === 1) {
      // Última parcela — marca como paga
      setTransacoes(prev => prev.map(item =>
        item.id === id
          ? { ...item, parcelaAtual: 0, status: "paga", ultimoPagamento: hoje }
          : item
      ));

      const { error } = await supabase.from("financeiro").update({
        parcela_atual: 0,
        status: "paga",
        ultimo_pagamento: hoje,
      }).eq("id", id);

      if (error) {
        toast.error("Erro ao confirmar pagamento");
        fetchTransacoes();
        return;
      }
      toast.success("Última parcela paga! Transação quitada.");

    } else {
      // Sem parcelas — marca como paga diretamente
      setTransacoes(prev => prev.map(item =>
        item.id === id ? { ...item, status: "paga", ultimoPagamento: hoje } : item
      ));

      const { error } = await supabase.from("financeiro").update({ status: "paga", ultimo_pagamento: hoje }).eq("id", id);

      if (error) {
        toast.error("Erro ao confirmar pagamento");
        fetchTransacoes();
        return;
      }
      toast.success("Pagamento confirmado!");
    }
  };

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
        if (d.getFullYear() !== ano || d.getMonth() + 1 !== mes) return false;
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
    const pagas = transacoes.filter((t) => t.status === "paga").length;
    const emAberto = transacoes.filter((t) => t.status === "em_aberto" && !isPast(parseISO(t.dataVencimento))).length;
    return { receitas, despesas, saldo, vencidas, vencidasAPagar, pagas, emAberto };
  }, [transacoes]);

  const despesasMensal = useMemo(() => {
    const [ano, mes] = mesDespesas.split("-").map(Number);
    return transacoes
      .filter((t) => {
        if (t.tipo !== "despesa") return false;
        const d = parseISO(t.dataVencimento);
        return d.getFullYear() === ano && d.getMonth() + 1 === mes;
      })
      .reduce((a, t) => a + t.valor, 0);
  }, [transacoes, mesDespesas]);

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
    if (!t.parcelas || t.parcelaAtual == null) return null;
    return t.parcelaAtual;
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
                    {stats.pagas}
                  </p>
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
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-orange-500/15 p-2.5 shrink-0">
                  <CalendarIcon className="h-5 w-5 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Despesas do Mês</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-orange-500 mt-0.5">
                    R$ {despesasMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-orange-500 hover:text-orange-400" title="Filtrar mês">
                    <Search className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="end">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Selecionar Mês</p>
                    <Input
                      type="month"
                      value={mesDespesas}
                      onChange={(e) => setMesDespesas(e.target.value)}
                      className="w-44 h-9"
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

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
                    {Array.from({ length: 12 }, (_, i) => {
                      const now = new Date();
                      const d = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
                      const val = format(d, "yyyy-MM");
                      const label = format(d, "MMM yyyy", { locale: ptBR });
                      return <SelectItem key={val} value={val}>{label}</SelectItem>;
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
                          <span>Parcelas: <span className="font-mono text-foreground">{t.parcelas ? `${getParcelasRestantes(t)}/${t.parcelas}` : "-"}</span></span>
                          <span>Vencimento: <span className="text-foreground">{format(parseISO(t.dataVencimento), "dd/MM/yy")}</span></span>
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
                            {t.parcelas ? `${getParcelasRestantes(t)}/${t.parcelas}` : "-"}
                          </TableCell>
                          <TableCell className="text-foreground">{format(parseISO(t.dataVencimento), "dd/MM/yyyy")}</TableCell>
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
      </main>

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
