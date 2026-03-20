import { useState, useMemo, useEffect, useRef } from "react";
import { format, isPast, parseISO, addDays, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Landmark, Calendar as CalendarIcon, CalendarDays, Banknote, Plus, UserPlus, AlertTriangle, Pencil, Trash2, Search, Percent, Wallet, ArrowUpCircle, ArrowDownCircle, CheckCircle, BarChart3, Copy, MessageCircle, Clock, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safe-error";

interface Cliente {
  id: string;
  nome: string;
  valor: number;
  juros: number;
  telefone: string;
  dataEmprestimo: string;
  dataPagamento: string;
}

const Emprestimos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [paidJurosIds, setPaidJurosIds] = useState<Set<string>>(new Set());
  const [originalDates, setOriginalDates] = useState<Map<string, string>>(new Map());

  // Add dialog state
  const [open, setOpen] = useState(false);
  const submittingRef = useRef(false);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [juros, setJuros] = useState("30");
  const [dataEmprestimo, setDataEmprestimo] = useState<Date>();
  const [dataPagamento, setDataPagamento] = useState<Date>();

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editJuros, setEditJuros] = useState("");
  const [editDataEmprestimo, setEditDataEmprestimo] = useState<Date>();
  const [editDataPagamento, setEditDataPagamento] = useState<Date>();

  // Search & filter state
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "em_dia" | "atrasado">("todos");

  // Wallet state
  const [saldo, setSaldo] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositValor, setDepositValor] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawValor, setWithdrawValor] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showTransactions, setShowTransactions] = useState(false);
  
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [zerarConfirmOpen, setZerarConfirmOpen] = useState(false);
  const [filtroMes, setFiltroMes] = useState<string>("todos");


  const transacoesFiltradas = useMemo(() => {
    if (filtroMes === "todos") return transactions;
    return transactions.filter(t => {
      const date = parseISO(t.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return key === filtroMes;
    });
  }, [transactions, filtroMes]);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      const date = parseISO(t.created_at);
      set.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const fetchClientes = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar clientes", description: getSafeErrorMessage(error), variant: "destructive" });
      return;
    }

    setClientes(
      (data || []).map((d: any) => ({
        id: d.id,
        nome: d.nome,
        valor: Number(d.valor),
        juros: Number(d.juros),
        telefone: d.telefone || "",
        dataEmprestimo: d.data_emprestimo,
        dataPagamento: d.data_pagamento,
      }))
    );
    setLoading(false);
  };

  const fetchWallet = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("wallets")
      .select("saldo")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data && !error) {
      // Create wallet if not exists
      await supabase.from("wallets").insert({ user_id: user.id, saldo: 0 });
      setSaldo(0);
    } else if (data) {
      setSaldo(Number(data.saldo));
    }
    setWalletLoading(false);
  };

  const logTransaction = async (tipo: string, valor: number, saldoAnterior: number, saldoPosterior: number, descricao: string) => {
    if (!user) return;
    await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      tipo,
      valor,
      saldo_anterior: saldoAnterior,
      saldo_posterior: saldoPosterior,
      descricao,
    });
  };

  const fetchTransactions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("origem", "emprestimos")
      .order("created_at", { ascending: false })
      .limit(20);
    setTransactions(data || []);
  };

  const handleDeposit = async () => {
    if (!user || !depositValor) return;
    const val = parseFloat(depositValor);
    if (isNaN(val) || val <= 0 || val > 1000000) {
      toast({ title: "Valor inválido", description: "Insira um valor entre R$ 0,01 e R$ 1.000.000,00.", variant: "destructive" });
      return;
    }

    const newSaldo = saldo + val;
    const { error } = await supabase
      .from("wallets")
      .update({ saldo: newSaldo })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Erro ao depositar", description: getSafeErrorMessage(error), variant: "destructive" });
      return;
    }

    await logTransaction("deposito", val, saldo, newSaldo, `Depósito manual de R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    setSaldo(newSaldo);
    setDepositValor("");
    setDepositOpen(false);
    fetchTransactions();
    toast({ title: `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} adicionado à carteira` });
  };

  const handleWithdraw = async () => {
    if (!user || !withdrawValor) return;
    const val = parseFloat(withdrawValor);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    if (val > saldo) {
      toast({ title: "Saldo insuficiente", description: "O valor da retirada excede o saldo disponível.", variant: "destructive" });
      return;
    }

    const newSaldo = saldo - val;
    const { error } = await supabase
      .from("wallets")
      .update({ saldo: newSaldo })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Erro ao retirar", description: getSafeErrorMessage(error), variant: "destructive" });
      return;
    }

    await logTransaction("retirada", val, saldo, newSaldo, `Retirada manual de R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    setSaldo(newSaldo);
    setWithdrawValor("");
    setWithdrawOpen(false);
    fetchTransactions();
    toast({ title: `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} retirado da carteira` });
  };

  const handleClearHistory = async () => {
    if (!user) return;

    const { error } = await supabase
      .from("wallet_transactions")
      .delete()
      .eq("user_id", user.id)
      .eq("origem", "emprestimos");

    if (error) {
      toast({ title: "Erro ao limpar histórico", description: getSafeErrorMessage(error), variant: "destructive" });
      return;
    }

    setClearConfirmOpen(false);
    fetchTransactions();
    toast({ title: "Histórico limpo com sucesso" });
  };

  const handleDeleteTransaction = async (transaction: any) => {
    if (!user) return;
    const isPositive = ["deposito", "pagamento", "estorno", "pagamento_juros"].includes(transaction.tipo);
    const revertValue = isPositive ? -Number(transaction.valor) : Number(transaction.valor);
    const newSaldo = saldo + revertValue;

    const { error: walletError } = await supabase
      .from("wallets")
      .update({ saldo: newSaldo })
      .eq("user_id", user.id);

    if (walletError) {
      toast({ title: "Erro ao reverter saldo", description: getSafeErrorMessage(walletError), variant: "destructive" });
      return;
    }

    // If it's a juros payment, revert the client's payment date to -1 month
    if (transaction.tipo === "pagamento_juros" && transaction.descricao) {
      // Extract client name from description "Juros recebidos de <nome>"
      const match = transaction.descricao.match(/Juros recebidos de (.+)/);
      if (match) {
        const clienteNome = match[1];
        const cliente = clientes.find(c => c.nome === clienteNome);
        if (cliente) {
          const pagDate = parseISO(cliente.dataPagamento);
          const year = pagDate.getFullYear();
          const month = pagDate.getMonth();
          const day = pagDate.getDate();
          const prevMonth = month === 0 ? 11 : month - 1;
          const prevYear = month === 0 ? year - 1 : year;
          const dataAnterior = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

          await supabase
            .from("clientes")
            .update({ data_pagamento: dataAnterior })
            .eq("id", cliente.id);
        }
      }
    }

    // If it's a full payment, restore the client from archive
    if (transaction.tipo === "pagamento" && transaction.descricao) {
      const match = transaction.descricao.match(/Pagamento recebido de (.+?) \(/);
      if (match) {
        const clienteNome = match[1];
        // Find the most recent archived record for this client
        const { data: archived } = await supabase
          .from("clientes_historico")
          .select("*")
          .eq("user_id", user.id)
          .eq("nome", clienteNome)
          .eq("tipo", "pago")
          .order("archived_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (archived) {
          // Restore client to active list
          await supabase.from("clientes").insert({
            id: archived.cliente_id || undefined,
            user_id: user.id,
            nome: archived.nome,
            valor: archived.valor,
            juros: archived.juros,
            telefone: archived.telefone || "",
            data_emprestimo: archived.data_emprestimo,
            data_pagamento: archived.data_pagamento,
          });

          // Remove from archive
          await supabase.from("clientes_historico").delete().eq("id", archived.id);
        }
      }
    }
    const { error } = await supabase
      .from("wallet_transactions")
      .delete()
      .eq("id", transaction.id);

    if (error) {
      toast({ title: "Erro ao excluir movimentação", description: getSafeErrorMessage(error), variant: "destructive" });
      return;
    }

    setSaldo(newSaldo);
    fetchClientes();
    fetchTransactions();
    toast({ title: "Movimentação excluída", description: `Saldo revertido para R$ ${newSaldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` });
  };

  const handleZerar = async () => {
    if (!user || saldo === 0) return;
    const { error } = await supabase
      .from("wallets")
      .update({ saldo: 0 })
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro ao zerar saldo", description: getSafeErrorMessage(error), variant: "destructive" });
      return;
    }
    await logTransaction("retirada", saldo, saldo, 0, "Saldo zerado manualmente");
    setSaldo(0);
    setZerarConfirmOpen(false);
    fetchTransactions();
    toast({ title: "Saldo zerado com sucesso" });
  };

  useEffect(() => {
    if (user) {
      fetchClientes();
      fetchWallet();
      fetchTransactions();
    }
  }, [user]);

  const resetAddForm = () => {
    setNome("");
    setValor("");
    setJuros("");
    setDataEmprestimo(undefined);
    setDataPagamento(undefined);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!nome || !valor || !juros || !dataEmprestimo || !dataPagamento || !user) return;

    submittingRef.current = true;
    try {
      const empValor = parseFloat(valor);


      const { error } = await supabase.from("clientes").insert({
        user_id: user.id,
        nome,
        telefone: "",
        valor: empValor,
        juros: parseFloat(juros),
        data_emprestimo: format(dataEmprestimo, "yyyy-MM-dd"),
        data_pagamento: format(dataPagamento, "yyyy-MM-dd"),
      });

      if (error) {
        toast({ title: "Erro ao cadastrar", description: getSafeErrorMessage(error), variant: "destructive" });
        return;
      }

      // Deduct from wallet
      const newSaldo = saldo - empValor;
      await supabase.from("wallets").update({ saldo: newSaldo }).eq("user_id", user.id);
      await logTransaction("emprestimo", empValor, saldo, newSaldo, `Empréstimo para ${nome}`);
      setSaldo(newSaldo);

      resetAddForm();
      setOpen(false);
      fetchClientes();
      fetchTransactions();
    } finally {
      submittingRef.current = false;
    }
  };

  const openEdit = (c: Cliente) => {
    setEditId(c.id);
    setEditNome(c.nome);
    setEditValor(String(c.valor));
    setEditJuros(String(c.juros));
    setEditDataEmprestimo(parseISO(c.dataEmprestimo));
    setEditDataPagamento(parseISO(c.dataPagamento));
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNome || !editValor || !editJuros || !editDataEmprestimo || !editDataPagamento || !editId) return;

    const { error } = await supabase
      .from("clientes")
      .update({
        nome: editNome,
        telefone: "",
        valor: parseFloat(editValor),
        juros: parseFloat(editJuros),
        data_emprestimo: format(editDataEmprestimo, "yyyy-MM-dd"),
        data_pagamento: format(editDataPagamento, "yyyy-MM-dd"),
      })
      .eq("id", editId);

    if (error) {
      toast({ title: "Erro ao editar", description: getSafeErrorMessage(error), variant: "destructive" });
      return;
    }

    setEditOpen(false);
    fetchClientes();
  };

  const archiveCliente = async (cliente: Cliente, tipo: "removido" | "pago") => {
    if (!user) return;
    await supabase.from("clientes_historico" as any).insert({
      cliente_id: cliente.id,
      user_id: user.id,
      nome: cliente.nome,
      valor: cliente.valor,
      juros: cliente.juros,
      telefone: cliente.telefone,
      data_emprestimo: cliente.dataEmprestimo,
      data_pagamento: cliente.dataPagamento,
      tipo,
    });
  };

  const handleDelete = async (id: string) => {
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente || !user) return;

    // Archive before deleting
    await archiveCliente(cliente, "removido");

    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: getSafeErrorMessage(error), variant: "destructive" });
      return;
    }
    const newSaldo = saldo + cliente.valor;
    await supabase.from("wallets").update({ saldo: newSaldo }).eq("user_id", user.id);
    await logTransaction("estorno", cliente.valor, saldo, newSaldo, `Estorno - exclusão de ${cliente.nome}`);
    setSaldo(newSaldo);
    fetchClientes();
    fetchTransactions();
  };

  const gerarMensagemCobranca = (cliente: { nome: string; valor: number; juros: number; dataPagamento: string }) => {
    const valorTotal = cliente.valor + cliente.valor * (cliente.juros / 100);
    return `Olá, ${cliente.nome}! Tudo bem?\n\nPassando para lembrar que o pagamento no valor de R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, com vencimento em ${format(parseISO(cliente.dataPagamento), "dd/MM/yyyy")}, ainda está em aberto.\n\nSe já realizou o pagamento, por favor desconsidere esta mensagem. Caso precise de algum ajuste ou tenha alguma dúvida, estou à disposição.\n\nAgradeço sua atenção! 😊`;
  };

  const copiarMensagemCobranca = (cliente: { nome: string; valor: number; juros: number; dataPagamento: string }) => {
    const msg = gerarMensagemCobranca(cliente);
    navigator.clipboard.writeText(msg);
    toast({ title: "Mensagem copiada!", description: "A mensagem de cobrança foi copiada para a área de transferência." });
  };

  const enviarWhatsApp = (cliente: { nome: string; valor: number; juros: number; dataPagamento: string; telefone: string }) => {
    try {
      const msg = gerarMensagemCobranca(cliente);
      const telefoneFormatado = cliente.telefone.replace(/\D/g, "");
      if (!telefoneFormatado) {
        toast({ title: "Telefone não cadastrado", description: "Este cliente não possui telefone cadastrado.", variant: "destructive" });
        return;
      }
      const url = `https://wa.me/55${telefoneFormatado}?text=${encodeURIComponent(msg)}`;
      // Use location.href as fallback for iframe environments
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      navigator.clipboard.writeText(msg);
      toast({ title: "WhatsApp", description: "A mensagem foi copiada. Se o WhatsApp não abriu, cole a mensagem manualmente." });
    } catch (error) {
      console.error("Erro ao enviar WhatsApp:", error);
      toast({ title: "Erro", description: "Não foi possível abrir o WhatsApp. Tente copiar a mensagem manualmente.", variant: "destructive" });
    }
  };


  const handlePagarJuros = async (id: string) => {
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente || !user) return;

    const valorJuros = cliente.valor * (cliente.juros / 100);

    // If already paid, revert: remove juros from wallet, revert date -1 month, set status back to "Em dia"
    if (paidJurosIds.has(id)) {
      const newSaldo = saldo - valorJuros;
      const { error: walletError } = await supabase.from("wallets").update({ saldo: newSaldo }).eq("user_id", user.id);
      if (walletError) {
        toast({ title: "Erro ao reverter saldo", description: getSafeErrorMessage(walletError), variant: "destructive" });
        return;
      }

      // Restore the original date saved before paying
      const dataOriginal = originalDates.get(id);
      if (dataOriginal) {
        await supabase.from("clientes").update({ data_pagamento: dataOriginal }).eq("id", id);
      }

      await logTransaction("estorno_juros", valorJuros, saldo, newSaldo, `Estorno de juros de ${cliente.nome}`);
      setSaldo(newSaldo);
      setPaidJurosIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      setOriginalDates(prev => { const next = new Map(prev); next.delete(id); return next; });
      fetchClientes();
      fetchTransactions();
      toast({ title: "Juros estornados", description: `R$ ${valorJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} removido da carteira.` });
      return;
    }

    // First time paying juros: save original date, add to wallet, advance date +1 month
    setOriginalDates(prev => new Map(prev).set(id, cliente.dataPagamento));
    const pagDate = parseISO(cliente.dataPagamento);
    const year = pagDate.getFullYear();
    const month = pagDate.getMonth();
    const day = pagDate.getDate();
    const nextMonth = (month + 1) % 12;
    const nextYear = month + 1 >= 12 ? year + 1 : year;
    const novaDataPagamento = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const { error: updateError } = await supabase
      .from("clientes")
      .update({ data_pagamento: novaDataPagamento })
      .eq("id", id);

    if (updateError) {
      toast({ title: "Erro ao atualizar data", description: getSafeErrorMessage(updateError), variant: "destructive" });
      return;
    }

    const newSaldo = saldo + valorJuros;
    const { error } = await supabase.from("wallets").update({ saldo: newSaldo }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro ao registrar pagamento de juros", description: getSafeErrorMessage(error), variant: "destructive" });
      return;
    }

    await logTransaction("pagamento_juros", valorJuros, saldo, newSaldo, `Juros recebidos de ${cliente.nome}`);
    setSaldo(newSaldo);
    setPaidJurosIds(prev => new Set(prev).add(id));
    fetchClientes();
    fetchTransactions();
    toast({ title: "Juros recebidos!", description: `R$ ${valorJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} creditado na carteira. Próximo pagamento: ${novaDataPagamento.split("-").reverse().join("/")}` });
  };

  const handlePagar = async (id: string) => {
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente || !user) return;

    const valorJuros = cliente.valor * (cliente.juros / 100);
    const valorTotal = cliente.valor + valorJuros;

    // Archive before deleting
    await archiveCliente(cliente, "pago");

    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao registrar pagamento", description: getSafeErrorMessage(error), variant: "destructive" });
      return;
    }

    const newSaldo = saldo + valorTotal;
    await supabase.from("wallets").update({ saldo: newSaldo }).eq("user_id", user.id);
    await logTransaction("pagamento", valorTotal, saldo, newSaldo, `Pagamento recebido de ${cliente.nome} (valor + juros)`);
    setSaldo(newSaldo);
    fetchClientes();
    fetchTransactions();
    toast({ title: "Pagamento recebido!", description: `R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} devolvido à carteira.` });
  };

  const stats = useMemo(() => {
    const total = clientes.reduce((a, c) => a + c.valor, 0);
    const totalJuros = clientes.reduce((a, c) => a + c.valor * (c.juros / 100), 0);
    const atrasados = clientes.filter((c) => isPast(parseISO(c.dataPagamento))).length;
    const lucroTotal = total + totalJuros;
    return { total, totalJuros, lucroTotal, atrasados, ativos: clientes.length };
  }, [clientes]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-12 z-10">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight">Empréstimos</h1>
            <p className="text-xs text-muted-foreground truncate">Cadastro de clientes e controle</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetAddForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" /> Cadastrar Cliente
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Nome do Cliente</Label>
                  <Input placeholder="Ex: João Silva" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Valor do Empréstimo (R$)</Label>
                  <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Juros (%)</Label>
                  <div className="flex gap-2">
                    <Input type="number" step="0.1" min="0" placeholder="Ex: 5" value={juros} onChange={(e) => setJuros(e.target.value)} required className="flex-1" />
                    {["10", "20", "30"].map((v) => (
                      <Button key={v} type="button" size="sm" variant={juros === v ? "default" : "outline"} className="px-3" onClick={() => setJuros(v)}>
                        {v}%
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Data do Empréstimo</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataEmprestimo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataEmprestimo ? format(dataEmprestimo, "dd/MM/yyyy") : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dataEmprestimo} onSelect={setDataEmprestimo} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Pagamento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataPagamento && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataPagamento ? format(dataPagamento, "dd/MM/yyyy") : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dataPagamento} onSelect={setDataPagamento} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Button type="submit" className="w-full">Cadastrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" /> Editar Cliente
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input placeholder="Ex: João Silva" value={editNome} onChange={(e) => setEditNome(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Valor do Empréstimo (R$)</Label>
              <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={editValor} onChange={(e) => setEditValor(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Juros (%)</Label>
              <Input type="number" step="0.1" min="0" placeholder="Ex: 5" value={editJuros} onChange={(e) => setEditJuros(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data do Empréstimo</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editDataEmprestimo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editDataEmprestimo ? format(editDataEmprestimo, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editDataEmprestimo} onSelect={setEditDataEmprestimo} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Data de Pagamento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editDataPagamento && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editDataPagamento ? format(editDataPagamento, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editDataPagamento} onSelect={setEditDataPagamento} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button type="submit" className="w-full">Salvar Alterações</Button>
          </form>
        </DialogContent>
      </Dialog>

      <main className="p-4 sm:p-6 space-y-4 sm:space-y-6">



        {/* Wallet Card - Acima do Lucro Total */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" /> Saldo da Carteira
              </CardTitle>
              <div className="flex items-center gap-1">
                <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-600/30 hover:bg-green-600/10">
                      <ArrowDownCircle className="h-3.5 w-3.5" /> Depositar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Depositar na Carteira</DialogTitle>
                      <DialogDescription>Adicione fundos à sua carteira.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="space-y-2">
                        <Label>Valor (R$)</Label>
                        <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={depositValor} onChange={(e) => setDepositValor(e.target.value)} />
                      </div>
                      <Button className="w-full" onClick={handleDeposit}>Confirmar Depósito</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                      <ArrowUpCircle className="h-3.5 w-3.5" /> Retirar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Retirar da Carteira</DialogTitle>
                      <DialogDescription>Retire fundos da sua carteira.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="space-y-2">
                        <Label>Valor (R$)</Label>
                        <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={withdrawValor} onChange={(e) => setWithdrawValor(e.target.value)} />
                      </div>
                      <p className="text-xs text-muted-foreground">Saldo disponível: R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      <Button className="w-full" onClick={handleWithdraw}>Confirmar Retirada</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col items-center gap-2 mb-4">
              <p className="text-3xl font-bold font-mono text-primary">
                {walletLoading ? "..." : `R$ ${saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => { setShowTransactions(!showTransactions); if (!showTransactions) fetchTransactions(); }}>
                <Clock className="h-3.5 w-3.5" /> {showTransactions ? "Ocultar Histórico" : "Ver Histórico"}
              </Button>
              <div className="flex gap-1">
                <AlertDialog open={zerarConfirmOpen} onOpenChange={setZerarConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs text-warning">Zerar</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Zerar saldo da carteira?</AlertDialogTitle>
                      <AlertDialogDescription>O saldo atual de R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} será zerado.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleZerar} className="bg-warning text-warning-foreground hover:bg-warning/90">Zerar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {showTransactions && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Movimentações</p>
                  <div className="flex items-center gap-2">
                    <Select value={filtroMes} onValueChange={setFiltroMes}>
                      <SelectTrigger className="h-8 w-[140px] text-xs">
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {mesesDisponiveis.map((m) => (
                          <SelectItem key={m} value={m}>
                            {format(parseISO(`${m}-01`), "MMM yyyy", { locale: ptBR })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs text-destructive">Limpar</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Limpar histórico?</AlertDialogTitle>
                          <AlertDialogDescription>Todas as movimentações serão removidas permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Limpar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {transacoesFiltradas.length === 0 ? (
                    <p className="text-center text-muted-foreground text-xs py-4">Nenhuma movimentação registrada.</p>
                  ) : (
                    transacoesFiltradas.map((t) => {
                      const isPositive = ["deposito", "pagamento", "estorno", "pagamento_juros"].includes(t.tipo);
                      return (
                        <div key={t.id} className="flex items-center justify-between border rounded-md p-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            {isPositive ? <ArrowDownCircle className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <ArrowUpCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                            <div className="min-w-0">
                              <p className="truncate font-medium">{t.descricao}</p>
                              <p className="text-muted-foreground">{format(parseISO(t.created_at), "dd/MM/yy HH:mm")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-mono font-medium ${isPositive ? "text-green-500" : "text-destructive"}`}>
                              {isPositive ? "+" : "-"}R$ {Number(t.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
                                  <AlertDialogDescription>O saldo será revertido automaticamente.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteTransaction(t)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Summary */}
        {/* Financial Summary - always visible */}
        <>
            {/* Lucro Total */}
            <div className="mb-4">
              <Card className="bg-card border-border/50 w-full">
                <CardContent className="p-5 sm:p-6 flex flex-col items-center justify-center text-center gap-2">
                  <div className="rounded-xl bg-green-500/15 p-3">
                    <TrendingUp className="h-6 w-6 text-green-500" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lucro Total</p>
                  <p className="text-2xl sm:text-3xl font-bold font-mono text-green-500">R$ {stats.totalJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-[11px] text-muted-foreground">Total de Juros</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card border-border/50 w-full">
              <CardContent className="p-4 flex items-center justify-center gap-3">
                <div className="rounded-xl bg-emerald-500/15 p-2.5">
                  <Banknote className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Emprestado</p>
                  <p className="text-lg font-bold font-mono">R$ {stats.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-card border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-xl bg-purple-500/15 p-2.5">
                    <Landmark className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Clientes Ativos</p>
                    <p className="text-lg font-bold font-mono">{clientes.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-xl bg-destructive/15 p-2.5">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Em Atraso</p>
                    <p className="text-lg font-bold font-mono text-destructive">{stats.atrasados}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>



        {/* Clients Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base font-semibold">Clientes</CardTitle>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                    placeholder="Buscar..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-8 h-9 w-full sm:w-[200px]"
                  />
                </div>
                <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as "todos" | "em_dia" | "atrasado")}>
                  <SelectTrigger className="h-9 w-full sm:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="em_dia">Em dia</SelectItem>
                    <SelectItem value="atrasado">Em atraso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {clientes
                    .filter((c) => {
                      const matchNome = c.nome.toLowerCase().includes(busca.toLowerCase());
                      const atrasado = isPast(parseISO(c.dataPagamento));
                      const matchStatus = filtroStatus === "todos" || (filtroStatus === "atrasado" && atrasado) || (filtroStatus === "em_dia" && !atrasado);
                      return matchNome && matchStatus;
                    })
                    .map((c) => {
                      const atrasado = isPast(parseISO(c.dataPagamento));
                      const mostrarCobranca = isBefore(parseISO(c.dataPagamento), addDays(new Date(), 2));
                      const valorJuros = c.valor * (c.juros / 100);
                      const valorReceber = c.valor + valorJuros;
                      return (
                        <div key={c.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{c.nome}</span>
                            <div className="flex items-center gap-1">
                              <Badge variant={atrasado ? "destructive" : "default"} className={`text-xs ${paidJurosIds.has(c.id) ? "bg-blue-600 hover:bg-blue-700 text-white" : !atrasado ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}>
                                {paidJurosIds.has(c.id) ? "Pago" : atrasado ? "Atraso" : "Em dia"}
                              </Badge>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700">
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar pagamento?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O valor de <strong>R$ {valorReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> será devolvido à carteira.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handlePagar(c.id)} className="bg-green-600 text-white hover:bg-green-700">
                                      Pagar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:text-blue-600" title="Pagar somente juros">
                                    <Percent className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Pagar somente os juros?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O valor de <strong>R$ {valorJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> (juros) será creditado na carteira. O cliente continuará ativo.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handlePagarJuros(c.id)} className="bg-blue-500 text-white hover:bg-blue-600">
                                      Pagar Juros
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              {mostrarCobranca && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-warning hover:text-warning" onClick={() => copiarMensagemCobranca(c)} title="Copiar mensagem de cobrança">
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Ao excluir <strong>{c.nome}</strong>, todos os dados serão removidos permanentemente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                            <span>Valor: <span className="font-mono text-foreground">R$ {c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                            <span>Juros: <span className="font-mono text-foreground">{c.juros}%</span></span>
                            <span>Juros R$: <span className="font-mono text-warning">R$ {valorJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                            <span>Receber: <span className="font-mono font-semibold text-success">R$ {valorReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                            <span>Emp: {format(parseISO(c.dataEmprestimo), "dd/MM/yy")}</span>
                            <span>Pag: {format(parseISO(c.dataPagamento), "dd/MM/yy")}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Juros</TableHead>
                        <TableHead>Valor dos Juros</TableHead>
                        <TableHead>Valor a Receber</TableHead>
                        <TableHead>Data Empréstimo</TableHead>
                        <TableHead>Data Pagamento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientes
                        .filter((c) => {
                          const matchNome = c.nome.toLowerCase().includes(busca.toLowerCase());
                          const atrasado = isPast(parseISO(c.dataPagamento));
                          const matchStatus = filtroStatus === "todos" || (filtroStatus === "atrasado" && atrasado) || (filtroStatus === "em_dia" && !atrasado);
                          return matchNome && matchStatus;
                        })
                        .map((c) => {
                          const atrasado = isPast(parseISO(c.dataPagamento));
                          const mostrarCobranca = isBefore(parseISO(c.dataPagamento), addDays(new Date(), 2));
                          const valorJuros = c.valor * (c.juros / 100);
                          const valorReceber = c.valor + valorJuros;
                          return (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium">{c.nome}</TableCell>
                              <TableCell className="font-mono">R$ {c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="font-mono">{c.juros}%</TableCell>
                              <TableCell className="font-mono text-warning">R$ {valorJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="font-mono font-semibold text-success">R$ {valorReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-muted-foreground">{format(parseISO(c.dataEmprestimo), "dd/MM/yyyy")}</TableCell>
                              <TableCell className="text-muted-foreground">{format(parseISO(c.dataPagamento), "dd/MM/yyyy")}</TableCell>
                              <TableCell>
                                <Badge variant={atrasado ? "destructive" : "default"} className={`whitespace-nowrap ${paidJurosIds.has(c.id) ? "bg-blue-600 hover:bg-blue-700 text-white" : !atrasado ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}>
                                  {paidJurosIds.has(c.id) ? "Pago" : atrasado ? "Em atraso" : "Em dia"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Confirmar pagamento?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          O valor total de <strong>R$ {valorReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> (valor + juros) será devolvido à sua carteira.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handlePagar(c.id)} className="bg-green-600 text-white hover:bg-green-700">
                                          Confirmar Pagamento
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600" title="Pagar somente juros">
                                        <Percent className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Pagar somente os juros?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          O valor de <strong>R$ {valorJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> (juros) será creditado na sua carteira. O cliente continuará ativo.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handlePagarJuros(c.id)} className="bg-blue-500 text-white hover:bg-blue-600">
                                          Pagar Juros
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                  {mostrarCobranca && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-warning hover:text-warning" onClick={() => copiarMensagemCobranca(c)} title="Copiar mensagem de cobrança">
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Ao excluir <strong>{c.nome}</strong>, todos os dados serão permanentemente removidos.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                          Excluir
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Emprestimos;
