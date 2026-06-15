import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpCircle, ArrowDownCircle, ArrowRight, Loader2, ShieldAlert, HandCoins, BadgePercent, CircleDollarSign, BadgeCheck, Timer, Landmark, Users, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RevenueChart from "@/components/dashboard/RevenueChart";
import EmprestimosChart from "@/components/dashboard/EmprestimosChart";
import FinanceiroChart from "@/components/dashboard/FinanceiroChart";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isPast, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [saldo, setSaldo] = useState(0);
  const [clientes, setClientes] = useState<any[]>([]);
  const [financeiro, setFinanceiro] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState("todos");

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [walletRes, clientesRes, financeiroRes] = await Promise.all([
        supabase.from("wallets").select("saldo").eq("user_id", user.id).maybeSingle(),
        supabase.from("clientes").select("valor, juros, data_pagamento, nome").eq("user_id", user.id),
        supabase.from("financeiro").select("*").eq("user_id", user.id),
      ]);

      if (walletRes.data) setSaldo(Number(walletRes.data.saldo));
      if (clientesRes.data) setClientes(clientesRes.data);
      if (financeiroRes.data) setFinanceiro(financeiroRes.data);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const emprestimosStats = useMemo(() => {
    const totalEmprestado = clientes.reduce((a, c) => a + Number(c.valor), 0);
    const totalJuros = clientes.reduce((a, c) => a + Number(c.valor) * (Number(c.juros) / 100), 0);
    const atrasados = clientes.filter((c) => isPast(parseISO(c.data_pagamento)));
    const lucroTotal = totalEmprestado + totalJuros;
    return { totalEmprestado, totalJuros, lucroTotal, atrasados: atrasados.length, clientesAtrasados: atrasados };
  }, [clientes]);

  const financeiroStats = useMemo(() => {
    const receitas = financeiro.filter(f => f.tipo === "receita");
    const despesas = financeiro.filter(f => f.tipo === "despesa");
    const totalReceitas = receitas.reduce((a, f) => a + Number(f.valor), 0);
    const totalDespesas = despesas.reduce((a, f) => a + Number(f.valor), 0);
    const pagas = financeiro.filter(f => f.status === "paga").length;
    const emAberto = financeiro.filter(f => f.status === "em_aberto").length;
    const vencidas = financeiro.filter(f => f.status === "em_aberto" && isPast(parseISO(f.data_vencimento))).length;
    return { totalReceitas, totalDespesas, saldoLiquido: totalReceitas - totalDespesas, pagas, emAberto, vencidas, total: financeiro.length };
  }, [financeiro]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
    },
  };

  const currentMonth = format(new Date(), "MMMM yyyy", { locale: ptBR });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, subtitle, colorClass = "text-foreground", iconBg = "bg-primary/15", iconColor = "text-primary" }: {
    icon: any; label: string; value: string; subtitle: string; colorClass?: string; iconBg?: string; iconColor?: string;
  }) => (
    <Card className="glass-card glass-card-hover group relative overflow-hidden">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-primary/5 to-transparent" />
      <CardContent className="p-4 sm:p-5 relative">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl ${iconBg} p-2.5 shrink-0 transition-transform duration-300 group-hover:scale-110`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-lg sm:text-xl font-bold font-mono tracking-tight mt-0.5 ${colorClass}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const renderFinanceiroCards = () => (
    <motion.div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={cardVariants}>
        <StatCard icon={CircleDollarSign} label="Saldo Líquido" value={fmt(financeiroStats.saldoLiquido)} subtitle="Receitas - Despesas"
          colorClass={financeiroStats.saldoLiquido >= 0 ? "text-primary" : "text-destructive"} iconBg="bg-primary/15" iconColor="text-primary" />
      </motion.div>
      <motion.div variants={cardVariants}>
        <StatCard icon={ArrowUpCircle} label="Receitas" value={fmt(financeiroStats.totalReceitas)} subtitle="Total recebido"
          colorClass="text-primary" iconBg="bg-primary/15" iconColor="text-primary" />
      </motion.div>
      <motion.div variants={cardVariants}>
        <StatCard icon={ArrowDownCircle} label="Despesas" value={fmt(financeiroStats.totalDespesas)} subtitle="Total gasto"
          colorClass="text-destructive" iconBg="bg-destructive/15" iconColor="text-destructive" />
      </motion.div>
      <motion.div variants={cardVariants}>
        <StatCard icon={BadgeCheck} label="Pagas" value={String(financeiroStats.pagas)} subtitle="Contas quitadas"
          iconBg="bg-primary/15" iconColor="text-primary" />
      </motion.div>
      <motion.div variants={cardVariants}>
        <StatCard icon={Timer} label="Em Aberto" value={String(financeiroStats.emAberto)}
          subtitle={financeiroStats.vencidas > 0 ? `${financeiroStats.vencidas} vencida(s)` : "Nenhuma vencida"}
          colorClass="text-warning" iconBg="bg-warning/15" iconColor="text-warning" />
      </motion.div>
    </motion.div>
  );

  const renderEmprestimosCards = () => (
    <motion.div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={cardVariants}>
        <StatCard icon={Landmark} label="Saldo" value={fmt(saldo)} subtitle="Disponível"
          iconBg="bg-primary/15" iconColor="text-primary" />
      </motion.div>
      <motion.div variants={cardVariants}>
        <StatCard icon={HandCoins} label="Emprestado" value={fmt(emprestimosStats.totalEmprestado)} subtitle={`${clientes.length} ativo(s)`}
          iconBg="bg-accent/15" iconColor="text-accent" />
      </motion.div>
      <motion.div variants={cardVariants}>
        <StatCard icon={BadgePercent} label="Juros" value={fmt(emprestimosStats.totalJuros)} subtitle="A receber"
          colorClass="text-warning" iconBg="bg-warning/15" iconColor="text-warning" />
      </motion.div>
      <motion.div variants={cardVariants}>
        <StatCard icon={CircleDollarSign} label="Lucro Total" value={fmt(emprestimosStats.lucroTotal)} subtitle="Emprestado + Juros"
          colorClass="text-primary" iconBg="bg-primary/15" iconColor="text-primary" />
      </motion.div>
      <motion.div variants={cardVariants}>
        <StatCard icon={ShieldAlert} label="Atrasados" value={String(emprestimosStats.atrasados)}
          subtitle={emprestimosStats.atrasados === 0 ? "Nenhum atraso" : "Atenção necessária"}
          colorClass="text-destructive" iconBg="bg-destructive/15" iconColor="text-destructive" />
      </motion.div>
    </motion.div>
  );

  const renderTodosCards = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-base sm:text-lg font-display font-bold uppercase tracking-wide text-foreground mb-4 flex items-center gap-2.5">
          <div className="h-1 w-1 rounded-full bg-primary" />
          <Users className="h-5 w-5 text-primary" /> Cliente Empréstimos
        </h2>
        {renderEmprestimosCards()}
      </div>
      <div>
        <h2 className="text-base sm:text-lg font-display font-bold uppercase tracking-wide text-foreground mb-4 flex items-center gap-2.5">
          <div className="h-1 w-1 rounded-full bg-accent" />
          <Receipt className="h-5 w-5 text-accent" /> Controle Financeiro
        </h2>
        {renderFinanceiroCards()}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <header className="relative overflow-hidden border-b bg-card/60 backdrop-blur-xl sticky top-12 z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/5" />
        <div className="relative px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                Dashboard
              </p>
              <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">
                Olá, bem-vindo de volta! 👋
              </h1>
              <p className="text-sm text-muted-foreground capitalize">{currentMonth}</p>
            </div>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="h-9 w-full sm:w-52 border-primary/30 text-primary glass-card">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Categorias</SelectItem>
                <SelectItem value="financeiro">Controle Financeiro</SelectItem>
                <SelectItem value="emprestimos">Cliente Empréstimos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-6">
        <section>
          {categoria === "todos" && renderTodosCards()}
          {categoria === "financeiro" && renderFinanceiroCards()}
          {categoria === "emprestimos" && renderEmprestimosCards()}
        </section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {categoria === "todos" && (
            <div className="space-y-4">
              <EmprestimosChart clientes={clientes} />
              <FinanceiroChart financeiro={financeiro} />
            </div>
          )}
          {categoria === "emprestimos" && <EmprestimosChart clientes={clientes} />}
          {categoria === "financeiro" && <FinanceiroChart financeiro={financeiro} />}
        </motion.section>

        <motion.section
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Quick Links */}
          <motion.div variants={cardVariants} className="lg:col-span-2">
            <Card className="glass-card glass-card-hover h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Acesso Rápido
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link to="/financeiro" className="group/link">
                  <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 space-y-2">
                    <div className="rounded-lg bg-primary/15 p-2 w-fit">
                      <ArrowUpCircle className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-semibold font-display">Controle Financeiro</p>
                    <p className="text-xs text-muted-foreground">Receitas e despesas</p>
                  </div>
                </Link>
                <Link to="/emprestimos" className="group/link">
                  <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 hover:border-accent/40 hover:bg-accent/5 transition-all duration-300 space-y-2">
                    <div className="rounded-lg bg-accent/15 p-2 w-fit">
                      <HandCoins className="h-4 w-4 text-accent" />
                    </div>
                    <p className="text-sm font-semibold font-display">Empréstimos</p>
                    <p className="text-xs text-muted-foreground">Gerencie clientes</p>
                  </div>
                </Link>
                <Link to="/relatorios" className="group/link">
                  <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 hover:border-warning/40 hover:bg-warning/5 transition-all duration-300 space-y-2">
                    <div className="rounded-lg bg-warning/15 p-2 w-fit">
                      <CircleDollarSign className="h-4 w-4 text-warning" />
                    </div>
                    <p className="text-sm font-semibold font-display">Relatórios</p>
                    <p className="text-xs text-muted-foreground">Análises detalhadas</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Alerts */}
          <motion.div variants={cardVariants}>
            <Card className="glass-card h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-warning" /> Alertas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {emprestimosStats.atrasados === 0 ? (
                  <div className="text-center py-6">
                    <div className="rounded-full bg-primary/10 p-3 w-fit mx-auto mb-3">
                      <BadgeCheck className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm font-medium font-display">Tudo em dia!</p>
                    <p className="text-xs text-muted-foreground mt-1">Nenhum pagamento atrasado.</p>
                  </div>
                ) : (
                  <>
                    {emprestimosStats.clientesAtrasados.slice(0, 4).map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">{c.nome}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Venceu: {format(parseISO(c.data_pagamento), "dd/MM/yyyy")}
                          </p>
                        </div>
                        <p className="text-xs font-bold font-mono text-destructive">
                          R$ {Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    ))}
                    {emprestimosStats.atrasados > 4 && (
                      <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                        <Link to="/emprestimos">
                          Ver todos ({emprestimosStats.atrasados}) <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.section>
      </main>

      <footer className="border-t border-border/50 px-4 sm:px-6 py-4 mt-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p className="font-display">© 2026 FinControl — Controle Financeiro</p>
          <p className="font-mono text-[10px]">v2.0</p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
