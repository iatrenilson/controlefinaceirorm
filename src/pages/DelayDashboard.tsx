import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safe-error";
import {
  Users, TrendingUp, ArrowDownCircle, ArrowUpCircle, DollarSign,
  Wallet, BarChart3, PieChart, Activity, Timer, CalendarDays, Target, Building2, RotateCcw
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { getCasaLogo } from "@/lib/casas-apostas";

interface DelayCliente {
  id: string;
  user_id: string;
  nome: string;
  casa: string;
  status: string;
  tipo: string | null;
  depositos: number;
  saques: number;
  custos: number;
  lucro: number;
  created_at: string;
  updated_at: string;
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

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DelayDashboard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [clientes, setClientes] = useState<DelayCliente[]>([]);
  const [transacoes, setTransacoes] = useState<DelayTransacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoFiltro, setPeriodoFiltro] = useState("todos");
  const [lucroDiaDate, setLucroDiaDate] = useState<Date>(new Date());
  const [bankBalances, setBankBalances] = useState<{ santander: number; c6: number }>({ santander: 0, c6: 0 });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: clientesData, error: e1 }, { data: transData, error: e2 }] = await Promise.all([
        supabase.from("delay_clientes").select("*").neq("status", "system"),
        supabase.from("delay_transacoes").select("*").order("data_transacao", { ascending: true }),
      ]);

      if (e1) toast({ title: "Erro ao carregar clientes", description: getSafeErrorMessage(e1), variant: "destructive" });
      if (e2) toast({ title: "Erro ao carregar transações", description: getSafeErrorMessage(e2), variant: "destructive" });

      setClientes((clientesData as unknown as DelayCliente[]) || []);
      setTransacoes((transData as unknown as DelayTransacao[]) || []);

      // Fetch bank balances
      if (user) {
        const { data: bankData } = await supabase
          .from("bank_balances")
          .select("banco, saldo")
          .eq("user_id", user.id);
        if (bankData) {
          const balances = { santander: 0, c6: 0 };
          bankData.forEach((b: any) => {
            if (b.banco === "santander") balances.santander = Number(b.saldo);
            if (b.banco === "c6") balances.c6 = Number(b.saldo);
          });
          setBankBalances(balances);
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [user]);

  const transacoesFiltradas = useMemo(() => {
    if (periodoFiltro === "todos") return transacoes;
    const now = new Date();
    const meses = periodoFiltro === "1m" ? 1 : periodoFiltro === "3m" ? 3 : 6;
    const inicio = subMonths(now, meses);
    return transacoes.filter(t => new Date(t.data_transacao) >= inicio);
  }, [transacoes, periodoFiltro]);

  // Stats gerais
  const stats = useMemo(() => {
    const clientesReais = clientes.filter(c => c.status !== "system");
    const ativos = clientesReais.filter(c => c.status === "ativo");
    const concluidos = clientesReais.filter(c => c.status === "concluido");
    const totalDepositos = clientesReais.reduce((a, c) => a + c.depositos, 0);
    const minSaquesDate = "2026-03-19";
    const totalSaques = clientesReais
      .filter(c => c.updated_at && c.updated_at.slice(0, 10) >= minSaquesDate)
      .reduce((a, c) => a + c.saques, 0);
    const totalCustos = clientesReais.reduce((a, c) => a + c.custos, 0);
    const totalLucro = clientesReais.reduce((a, c) => a + c.lucro, 0);
    const depositosAtivos = ativos.reduce((a, c) => a + c.depositos, 0);
    const tipo5050 = clientesReais.filter(c => c.tipo === "50/50").length;
    const diaFiltro = format(lucroDiaDate, "yyyy-MM-dd");
    const lucroDia = transacoesFiltradas
      .filter(t => t.data_transacao === diaFiltro && t.tipo !== "deposito")
      .reduce((a, t) => a + t.lucro, 0);
    return {
      total: clientesReais.length,
      ativos: ativos.length,
      concluidos: concluidos.length,
      totalDepositos,
      totalSaques,
      totalCustos,
      totalLucro,
      depositosAtivos,
      tipo5050,
      lucroDia,
    };
  }, [clientes, transacoesFiltradas, lucroDiaDate]);

  // Lucro por dia (line chart)
  const lucroPorDia = useMemo(() => {
    const map = new Map<string, { depositos: number; saques: number; lucro: number; custos: number }>();
    transacoesFiltradas.forEach(t => {
      const dia = t.data_transacao;
      const curr = map.get(dia) || { depositos: 0, saques: 0, lucro: 0, custos: 0 };
      if (t.tipo === "deposito") curr.depositos += t.valor;
      else {
        curr.saques += t.valor;
        curr.lucro += t.lucro;
        curr.custos += t.custo;
      }
      map.set(dia, curr);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, vals]) => ({
        dia: format(new Date(dia + "T12:00:00"), "dd/MM"),
        ...vals,
      }));
  }, [transacoesFiltradas]);

  // Distribuição por casa (pie)
  const distribuicaoCasa = useMemo(() => {
    const map = new Map<string, number>();
    clientes.forEach(c => {
      map.set(c.casa, (map.get(c.casa) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [clientes]);

  // Lucro por casa (bar)
  const lucroPorCasa = useMemo(() => {
    const map = new Map<string, { lucro: number; depositos: number; saques: number }>();
    clientes.forEach(c => {
      const curr = map.get(c.casa) || { lucro: 0, depositos: 0, saques: 0 };
      curr.lucro += c.lucro;
      curr.depositos += c.depositos;
      curr.saques += c.saques;
      map.set(c.casa, curr);
    });
    return Array.from(map.entries())
      .map(([casa, vals]) => ({ casa, ...vals }))
      .sort((a, b) => b.lucro - a.lucro);
  }, [clientes]);

  // ROI por cliente
  const roiPorCliente = useMemo(() => {
    return [...clientes]
      .filter(c => c.depositos > 0)
      .map(c => ({
        nome: c.nome.length > 12 ? c.nome.substring(0, 12) + "…" : c.nome,
        nomeCompleto: c.nome,
        casa: c.casa,
        roi: (c.lucro / c.depositos) * 100,
        lucro: c.lucro,
        depositos: c.depositos,
      }))
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 15);
  }, [clientes]);

  // Top clientes por lucro
  const topClientes = useMemo(() => {
    return [...clientes]
      .filter(c => c.lucro > 0)
      .sort((a, b) => b.lucro - a.lucro)
      .slice(0, 10);
  }, [clientes]);

  // Lucro acumulado
  const lucroAcumulado = useMemo(() => {
    let acc = 0;
    return lucroPorDia.map(d => {
      acc += d.lucro;
      return { ...d, acumulado: acc };
    });
  }, [lucroPorDia]);

  // Transações por mês
  const transacoesPorMes = useMemo(() => {
    const map = new Map<string, { depositos: number; saques: number; lucro: number; count: number }>();
    transacoesFiltradas.forEach(t => {
      const mes = t.data_transacao.substring(0, 7);
      const curr = map.get(mes) || { depositos: 0, saques: 0, lucro: 0, count: 0 };
      curr.count++;
      if (t.tipo === "deposito") curr.depositos += t.valor;
      else {
        curr.saques += t.valor;
        curr.lucro += t.lucro;
      }
      map.set(mes, curr);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, vals]) => {
        const [y, m] = mes.split("-");
        return {
          mes: format(new Date(Number(y), Number(m) - 1), "MMM/yy", { locale: ptBR }),
          ...vals,
        };
      });
  }, [transacoesFiltradas]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-primary text-primary">DASHBOARD</Badge>
                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">DELAY ESPORTIVO</Badge>
                </div>
                <h1 className="text-lg font-bold tracking-tight">Dashboard - Delay Esportivo</h1>
                <p className="text-xs text-muted-foreground">Análise completa das operações de delay</p>
              </div>
            </div>
            <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo período</SelectItem>
                <SelectItem value="1m">Último mês</SelectItem>
                <SelectItem value="3m">Últimos 3 meses</SelectItem>
                <SelectItem value="6m">Últimos 6 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1 - Total Contas */}
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className="rounded-lg bg-primary/10 p-2 mb-2"><Users className="h-4 w-4 text-primary" /></div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Contas</p>
              <p className="text-xl font-bold font-mono">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">{stats.ativos} ativos • {stats.concluidos} concl.</p>
            </CardContent>
          </Card>
          {/* 2 - Lucro do Dia */}
          <Popover>
            <PopoverTrigger asChild>
              <Card className="cursor-pointer hover:ring-2 hover:ring-purple-500/30 transition-all">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="rounded-lg bg-emerald-500/10 p-2 mb-2"><DollarSign className="h-4 w-4 text-emerald-400" /></div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lucro do Dia</p>
                  <p className={`text-lg font-bold font-mono ${stats.lucroDia >= 0 ? "text-primary" : "text-destructive"}`}>
                    {stats.lucroDia >= 0 ? "+" : ""}{fmt(stats.lucroDia)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{format(lucroDiaDate, "dd/MM/yyyy")}</p>
                </CardContent>
              </Card>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={lucroDiaDate}
                onSelect={(d) => d && setLucroDiaDate(d)}
                locale={ptBR}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
              {format(lucroDiaDate, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd") && (
                <div className="px-3 pb-3">
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setLucroDiaDate(new Date())}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Voltar para Hoje
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          {/* 3 - Lucro Total */}
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className="rounded-lg bg-amber-500/10 p-2 mb-2"><TrendingUp className="h-4 w-4 text-amber-500" /></div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lucro Total</p>
              <p className={`text-lg font-bold font-mono ${stats.totalLucro >= 0 ? "text-primary" : "text-destructive"}`}>
                {stats.totalLucro >= 0 ? "+" : ""}{fmt(stats.totalLucro)}
              </p>
            </CardContent>
          </Card>
          {/* 4 - Custos */}
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className="rounded-lg bg-destructive/10 p-2 mb-2"><DollarSign className="h-4 w-4 text-destructive" /></div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Custos</p>
              <p className="text-lg font-bold font-mono">{fmt(stats.totalCustos)}</p>
            </CardContent>
          </Card>
          {/* 5 - Saques */}
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className="rounded-lg bg-emerald-500/10 p-2 mb-2"><ArrowUpCircle className="h-4 w-4 text-emerald-500" /></div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saques Totais</p>
              <p className="text-lg font-bold font-mono">{fmt(stats.totalSaques)}</p>
            </CardContent>
          </Card>
          {/* 6 - Investido */}
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <div className="rounded-lg bg-blue-500/10 p-2 mb-2"><ArrowDownCircle className="h-4 w-4 text-blue-500" /></div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Investido</p>
              <p className="text-lg font-bold font-mono">{fmt(stats.totalDepositos)}</p>
              <p className="text-[10px] text-muted-foreground">Ativos: {fmt(stats.depositosAtivos)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Bank Balances */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-red-500/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-red-500/20 p-2">
                <Building2 className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Santander</p>
                <p className={`text-lg font-bold font-mono ${bankBalances.santander >= 0 ? "text-primary" : "text-destructive"}`}>
                  {fmt(bankBalances.santander)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-500/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/20 p-2">
                <Building2 className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">C6 Bank</p>
                <p className={`text-lg font-bold font-mono ${bankBalances.c6 >= 0 ? "text-primary" : "text-destructive"}`}>
                  {fmt(bankBalances.c6)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/20 p-2">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo Total (Bancos)</p>
                <p className={`text-lg font-bold font-mono ${(bankBalances.santander + bankBalances.c6) >= 0 ? "text-primary" : "text-destructive"}`}>
                  {fmt(bankBalances.santander + bankBalances.c6)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Lucro acumulado */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Lucro Acumulado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lucroAcumulado.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-12">Sem dados suficientes</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={lucroAcumulado}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => [fmt(value), "Acumulado"]}
                    />
                    <defs>
                      <linearGradient id="gradientLucro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="acumulado" stroke="hsl(var(--primary))" fill="url(#gradientLucro)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Transações por mês */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Movimentações Mensais
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transacoesPorMes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-12">Sem dados suficientes</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={transacoesPorMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number, name: string) => [fmt(value), name === "depositos" ? "Depósitos" : name === "saques" ? "Saques" : "Lucro"]}
                    />
                    <Legend formatter={(v) => v === "depositos" ? "Depósitos" : v === "saques" ? "Saques" : "Lucro"} />
                    <Bar dataKey="depositos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saques" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lucro" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Distribuição por casa */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <PieChart className="h-4 w-4 text-primary" /> Distribuição por Casa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {distribuicaoCasa.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-12">Sem dados</p>
              ) : (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPie>
                      <Pie
                        data={distribuicaoCasa}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {distribuicaoCasa.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(value: number, name: string) => [`${value} contas`, name]}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {distribuicaoCasa.slice(0, 6).map((c, i) => (
                      <div key={c.name} className="flex items-center gap-1.5 text-[10px]">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground">{c.name} ({c.value})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lucro por casa */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Lucro por Casa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lucroPorCasa.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-12">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={lucroPorCasa} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v}`} />
                    <YAxis type="category" dataKey="casa" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={80} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number, name: string) => [fmt(value), name === "lucro" ? "Lucro" : name === "depositos" ? "Depósitos" : "Saques"]}
                    />
                    <Legend formatter={(v) => v === "lucro" ? "Lucro" : v === "depositos" ? "Depósitos" : "Saques"} />
                    <Bar dataKey="depositos" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="saques" fill="#10b981" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="lucro" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ROI por Cliente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-500" /> ROI por Cliente (Retorno sobre Investimento)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roiPorCliente.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-12">Sem dados suficientes</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={roiPorCliente} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={100} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    itemStyle={{ color: "hsl(var(--muted-foreground))" }}
                    formatter={(value: number, name: string, props: any) => {
                      const item = props.payload;
                      return [
                        `${value.toFixed(1)}% | Lucro: ${fmt(item.lucro)} | Dep: ${fmt(item.depositos)}`,
                        `ROI - ${item.nomeCompleto} (${item.casa})`
                      ];
                    }}
                  />
                  <Bar dataKey="roi" radius={[0, 4, 4, 0]}>
                    {roiPorCliente.map((entry, i) => (
                      <Cell key={i} fill={entry.roi >= 0 ? "#10b981" : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Clientes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Top 10 Clientes por Lucro
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topClientes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhum cliente com lucro registrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {topClientes.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                    <span className={`text-lg font-bold font-mono shrink-0 ${i < 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                      #{i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {getCasaLogo(c.casa) && <img src={getCasaLogo(c.casa)} alt={c.casa} className="w-4 h-4 rounded-sm shrink-0" />}
                        <p className="text-sm font-semibold truncate">{c.nome}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{c.casa}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono text-primary">+{fmt(c.lucro)}</p>
                      <p className="text-[10px] text-muted-foreground">Dep: {fmt(c.depositos)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lucro diário detalhado */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Lucro Diário
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lucroPorDia.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-12">Sem dados suficientes</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={lucroPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [fmt(value), name === "lucro" ? "Lucro" : name === "saques" ? "Saques" : "Depósitos"]}
                  />
                  <Legend formatter={(v) => v === "lucro" ? "Lucro" : v === "saques" ? "Saques" : "Depósitos"} />
                  <Line type="monotone" dataKey="depositos" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="saques" stroke="#10b981" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="lucro" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DelayDashboard;
