import { useState, useEffect, useMemo } from "react";
import { format, parseISO, isPast, isWithinInterval, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { BarChart3, Calendar as CalendarIcon, TrendingUp, Loader2, PieChart, Users, Banknote, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Cliente {
  id: string;
  nome: string;
  valor: number;
  juros: number;
  dataEmprestimo: string;
  dataPagamento: string;
  status?: "ativo" | "pago" | "removido";
}

const CHART_COLORS = [
  "hsl(145, 65%, 42%)",
  "hsl(260, 60%, 58%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(200, 70%, 50%)",
  "hsl(320, 60%, 50%)",
];

const Relatorios = () => {
  const { user, loading: authLoading } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [periodo, setPeriodo] = useState<"todos" | "mes_atual" | "ultimo_mes" | "personalizado">("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "em_dia" | "atrasado">("todos");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [dataInicio, setDataInicio] = useState<Date>();
  const [dataFim, setDataFim] = useState<Date>();

  const fetchClientes = async () => {
    if (!user) return;

    // Fetch active clients
    const { data: activeData } = await supabase
      .from("clientes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Fetch archived clients
    const { data: archivedData } = await supabase
      .from("clientes_historico" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("archived_at", { ascending: false });

    const active: Cliente[] = (activeData || []).map((d: any) => ({
      id: d.id,
      nome: d.nome,
      valor: Number(d.valor),
      juros: Number(d.juros),
      dataEmprestimo: d.data_emprestimo,
      dataPagamento: d.data_pagamento,
      status: "ativo" as const,
    }));

    const archived: Cliente[] = (archivedData || []).map((d: any) => ({
      id: d.id,
      nome: d.nome,
      valor: Number(d.valor),
      juros: Number(d.juros),
      dataEmprestimo: d.data_emprestimo,
      dataPagamento: d.data_pagamento,
      status: d.tipo === "pago" ? "pago" as const : "removido" as const,
    }));

    setClientes([...active, ...archived]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchClientes();

    // Listen for realtime changes to refresh data
    const channel = supabase
      .channel("relatorios-clientes")
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () => {
        fetchClientes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const filtered = useMemo(() => {
    const now = new Date();
    return clientes.filter((c) => {
      // Client name filter
      if (filtroCliente && !c.nome.toLowerCase().includes(filtroCliente.toLowerCase())) return false;

      // Status filter
      const atrasado = isPast(parseISO(c.dataPagamento));
      if (filtroStatus === "atrasado" && !atrasado) return false;
      if (filtroStatus === "em_dia" && atrasado) return false;

      // Period filter
      const empDate = parseISO(c.dataEmprestimo);
      if (periodo === "mes_atual") {
        if (!isWithinInterval(empDate, { start: startOfMonth(now), end: endOfMonth(now) })) return false;
      } else if (periodo === "ultimo_mes") {
        const prev = subMonths(now, 1);
        if (!isWithinInterval(empDate, { start: startOfMonth(prev), end: endOfMonth(prev) })) return false;
      } else if (periodo === "personalizado" && dataInicio && dataFim) {
        if (!isWithinInterval(empDate, { start: dataInicio, end: dataFim })) return false;
      }

      return true;
    });
  }, [clientes, filtroCliente, filtroStatus, periodo, dataInicio, dataFim]);

  const stats = useMemo(() => {
    // Only count active clients for KPIs (exclude archived: paid/removed)
    const activeOnly = filtered.filter((c) => c.status === "ativo");
    const totalEmprestado = activeOnly.reduce((a, c) => a + c.valor, 0);
    const totalJuros = activeOnly.reduce((a, c) => a + c.valor * (c.juros / 100), 0);
    const totalReceber = totalEmprestado + totalJuros;
    const atrasados = activeOnly.filter((c) => isPast(parseISO(c.dataPagamento))).length;
    const emDia = activeOnly.length - atrasados;
    return { totalEmprestado, totalJuros, totalReceber, atrasados, emDia, total: activeOnly.length };
  }, [filtered]);

  // Bar chart: top clients by amount
  const barData = useMemo(() => {
    return filtered
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8)
      .map((c) => ({
        nome: c.nome.length > 12 ? c.nome.slice(0, 12) + "…" : c.nome,
        valor: c.valor,
        juros: c.valor * (c.juros / 100),
      }));
  }, [filtered]);

  // Pie chart: status distribution
  const pieData = useMemo(() => [
    { name: "Em dia", value: stats.emDia },
    { name: "Atrasado", value: stats.atrasados },
  ], [stats]);

  // Pie chart: interest rate distribution
  const jurosDistribution = useMemo(() => {
    const groups: Record<string, number> = {};
    filtered.forEach((c) => {
      const key = `${c.juros}%`;
      groups[key] = (groups[key] || 0) + 1;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight">Relatórios</h1>
            <p className="text-xs text-muted-foreground truncate">Análise detalhada dos empréstimos</p>
          </div>
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-0.5">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-500/15 p-2.5 shrink-0">
                  <Banknote className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Emprestado</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tracking-tight mt-0.5">
                    R$ {stats.totalEmprestado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-0.5">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-500/15 p-2.5 shrink-0">
                  <PieChart className="h-5 w-5 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Juros</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-amber-500 mt-0.5">
                    R$ {stats.totalJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-0.5">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-green-500/15 p-2.5 shrink-0">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Lucro Total</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-green-500 mt-0.5">
                    R$ {stats.totalReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-0.5">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-destructive/15 p-2.5 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Atrasados</p>
                  <p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-destructive mt-0.5">
                    {stats.atrasados}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">de {stats.total} cliente(s)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Período</Label>
                <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="mes_atual">Mês atual</SelectItem>
                    <SelectItem value="ultimo_mes">Último mês</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="em_dia">Em dia</SelectItem>
                    <SelectItem value="atrasado">Em atraso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente</Label>
                <Input placeholder="Buscar cliente..." value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} className="h-9" />
              </div>
              {periodo === "personalizado" && (
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label className="text-xs">Intervalo</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                          {dataInicio ? format(dataInicio, "dd/MM/yy") : "Início"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left font-normal", !dataFim && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                          {dataFim ? format(dataFim, "dd/MM/yy") : "Fim"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dataFim} onSelect={setDataFim} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" /> Top Clientes por Valor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, ""]}
                    />
                    <Bar dataKey="valor" name="Emprestado" fill="hsl(145, 65%, 42%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="juros" name="Juros" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <div className="grid grid-rows-2 gap-4">
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" /> Status dos Clientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={120}>
                    <RePieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "hsl(145, 65%, 42%)" : "hsl(0, 72%, 51%)"} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </RePieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-muted-foreground" /> Distribuição por Juros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={120}>
                    <RePieChart>
                      <Pie data={jurosDistribution} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {jurosDistribution.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </RePieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Detailed Table */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Detalhamento ({filtered.length} registro{filtered.length !== 1 ? "s" : ""})
            </CardTitle>
            {filtered.some((c) => c.status !== "ativo") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="h-8 text-xs gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" /> Limpar tudo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar todo o histórico?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Todos os registros arquivados (pagos e removidos) serão excluídos permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        if (!user) return;
                        const { error } = await supabase
                          .from("clientes_historico")
                          .delete()
                          .eq("user_id", user.id);
                        if (error) {
                          toast.error("Erro ao limpar histórico");
                        } else {
                          toast.success("Histórico limpo com sucesso");
                          fetchClientes();
                        }
                      }}
                    >
                      Excluir tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum empréstimo encontrado com os filtros selecionados.</p>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Juros</TableHead>
                      <TableHead>Valor Juros</TableHead>
                      <TableHead>Total a Receber</TableHead>
                      <TableHead>Data Empréstimo</TableHead>
                      <TableHead>Data Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => {
                      const atrasado = c.status === "ativo" && isPast(parseISO(c.dataPagamento));
                      const valorJuros = c.valor * (c.juros / 100);
                      const total = c.valor + valorJuros;
                      const statusLabel = c.status === "pago" ? "Pago" : c.status === "removido" ? "Removido" : atrasado ? "Atrasado" : "Em dia";
                      const statusVariant = c.status === "pago" ? "default" : c.status === "removido" ? "secondary" : atrasado ? "destructive" : "default";
                      const statusClass = c.status === "pago" ? "bg-blue-600 hover:bg-blue-700 text-white" : c.status === "removido" ? "" : !atrasado && c.status === "ativo" ? "bg-green-600 hover:bg-green-700 text-white" : "";
                      return (
                        <TableRow key={c.id} className={c.status !== "ativo" ? "opacity-60" : ""}>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell className="font-mono">R$ {c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="font-mono">{c.juros}%</TableCell>
                          <TableCell className="font-mono text-warning">R$ {valorJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="font-mono font-semibold text-success">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-muted-foreground">{format(parseISO(c.dataEmprestimo), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-muted-foreground">{format(parseISO(c.dataPagamento), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant} className={statusClass}>
                              {statusLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {c.status !== "ativo" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O registro de "{c.nome}" será excluído permanentemente do histórico.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={async () => {
                                        const { error } = await supabase
                                          .from("clientes_historico")
                                          .delete()
                                          .eq("id", c.id);
                                        if (error) {
                                          toast.error("Erro ao excluir registro");
                                        } else {
                                          toast.success("Registro excluído");
                                          fetchClientes();
                                        }
                                      }}
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {/* Totals row */}
                <div className="mt-3 flex flex-wrap gap-4 text-sm border-t pt-3">
                  <span className="text-muted-foreground">Total emprestado: <strong className="font-mono text-foreground">R$ {stats.totalEmprestado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
                  <span className="text-muted-foreground">Total juros: <strong className="font-mono text-warning">R$ {stats.totalJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
                  <span className="text-muted-foreground">Total a receber: <strong className="font-mono text-success">R$ {stats.totalReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Relatorios;
