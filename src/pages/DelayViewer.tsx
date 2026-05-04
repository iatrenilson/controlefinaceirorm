import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getCasaLogo } from "@/lib/casas-apostas";
import { Users, Copy, Search, Eye, EyeOff, Filter, Lock, CalendarIcon, ArrowDownCircle, ArrowUpCircle, Clock, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const rwLogo = "/rw-logo.png";

interface ClienteViewer {
  id: string;
  nome: string;
  casa: string;
  login: string | null;
  senha: string | null;
  fornecedor: string | null;
  tipo: string | null;
  banco_deposito: string | null;
  status: string;
  operacao: string;
  depositos: number;
  saques: number;
  custos: number;
  lucro: number;
  deposito_pendente: number;
  informacoes_adicionais: string | null;
  created_at: string;
  updated_at: string;
  nick_criador: string | null;
}

interface DelayTransacaoViewer {
  id: string;
  cliente_id: string;
  tipo: string;
  lucro: number;
  data_transacao: string;
}

const DelayViewer = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { toast } = useToast();

  const [clientes, setClientes] = useState<ClienteViewer[]>([]);
  const [transacoes, setTransacoes] = useState<DelayTransacaoViewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("operando");
  const [filtroCasa, setFiltroCasa] = useState("todas");
  const [senhaVisivel, setSenhaVisivel] = useState<Record<string, boolean>>({});
  const [viewerNick, setViewerNick] = useState<string | null>(null);
  const [linkTipo, setLinkTipo] = useState<string>("visualizador");
  const [lucroDate, setLucroDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Editor action dialog state
  const [transDialog, setTransDialog] = useState<{ cliente: ClienteViewer; tipo: "deposito" | "saque" | "saque_pendente" | "saque_fornecedor" } | null>(null);
  const [transValor, setTransValor] = useState("");
  const [transCusto, setTransCusto] = useState("");
  const [transLoading, setTransLoading] = useState(false);

  // Edit client dialog state
  const [editDialog, setEditDialog] = useState<ClienteViewer | null>(null);
  const [editFields, setEditFields] = useState({ nome: "", login: "", senha: "", banco_deposito: "", informacoes_adicionais: "" });
  const [editLoading, setEditLoading] = useState(false);

  // IDs de contas queimadas — persistidos no localStorage por token
  const queimadaStorageKey = `queimada_${token || ""}`;
  const queimadaIdsRef = useRef<Set<string>>(
    new Set(JSON.parse(localStorage.getItem(`queimada_${token || ""}`) || "[]"))
  );
  const addQueimada = (id: string) => {
    queimadaIdsRef.current.add(id);
    localStorage.setItem(queimadaStorageKey, JSON.stringify([...queimadaIdsRef.current]));
  };
  const removeQueimada = (id: string) => {
    queimadaIdsRef.current.delete(id);
    localStorage.setItem(queimadaStorageKey, JSON.stringify([...queimadaIdsRef.current]));
  };

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  useEffect(() => {
    if (!token) {
      setError("Token não fornecido.");
      setLoading(false);
      return;
    }
    fetchClientes();

    const interval = setInterval(() => {
      fetchClientesSilent();
    }, 4000);

    let hiddenAt: number | null = null;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (document.visibilityState === "visible") {
        if (hiddenAt && Date.now() - hiddenAt > 30000) {
          window.location.reload();
        } else {
          fetchClientesSilent();
        }
        hiddenAt = null;
      }
    };
    const handleFocus = () => fetchClientesSilent();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [token]);

  const fetchClientesSilent = async () => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delay-viewer?token=${token}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (res.ok) {
        const tipo = result.tipo || "visualizador";
        // A Edge Function já controla o que retorna — não filtra aqui
        setClientes(result.clientes || []);
        setTransacoes(result.transacoes || []);
        setViewerNick(result.nick || null);
        setLinkTipo(tipo);
      }
    } catch {}
  };

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delay-viewer?token=${token}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Erro ao carregar dados.");
        return;
      }

      const tipo = result.tipo || "visualizador";
      // A Edge Function já controla o que retorna — não filtra aqui
      setClientes(result.clientes || []);
      setTransacoes(result.transacoes || []);
      setViewerNick(result.nick || null);
      setLinkTipo(tipo);
    } catch {
      setError("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const casas = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach((c) => {
      if (c.casa) set.add(c.casa);
    });
    return Array.from(set).sort();
  }, [clientes]);

  const getClienteStatus = (c: ClienteViewer) => {
    if (c.saques > 0 && c.saques === c.depositos && c.lucro === 0) return "devolvido";
    if (c.saques > 0) return "concluido";
    if (c.status === "saque_pendente") return "saque_pendente";
    if (c.deposito_pendente > 0 && c.depositos === 0) return "aguardando";
    return "operando";
  };

  const statusCounts = useMemo(() => {
    const baseList = clientes.filter((c) => {
      if (linkTipo !== "visualizador_vodka" && c.nome.toLowerCase().includes("vodka")) return false;
      if (getClienteStatus(c) === "aguardando") return false;
      return true;
    });
    const aguardandoCount = clientes.filter((c) => {
      if (linkTipo !== "visualizador_vodka" && c.nome.toLowerCase().includes("vodka")) return false;
      return getClienteStatus(c) === "aguardando";
    }).length;
    const counts: Record<string, number> = { todos: baseList.length, operando: 0, concluido: 0, devolvido: 0, saque_pendente: 0, aguardando: aguardandoCount, red: 0 };
    baseList.forEach(c => { counts[getClienteStatus(c)]++; if (c.lucro < 0) counts.red++; });
    return counts;
  }, [clientes, linkTipo]);

  const filtered = useMemo(() => {
    let list = clientes.filter((c) => {
      if (linkTipo !== "visualizador_vodka" && c.nome.toLowerCase().includes("vodka")) return false;
      if (getClienteStatus(c) === "aguardando") {
        // Para editor: mostra apenas na aba "Aguardando"; para os outros links: sempre oculta
        return linkTipo === "editor" && filtroStatus === "aguardando";
      }
      // Oculta saque_pendente de links não-editor, exceto quando está na aba Saque Pendente
      if (linkTipo !== "editor" && c.status === "saque_pendente" && filtroStatus !== "saque_pendente") return false;
      return true;
    });

    if (filtroStatus === "red") {
      list = list.filter(c => c.lucro < 0);
    } else if (filtroStatus !== "todos") {
      list = list.filter(c => getClienteStatus(c) === filtroStatus);
    }

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.nome.toLowerCase().includes(s) ||
          c.casa.toLowerCase().includes(s) ||
          (c.fornecedor || "").toLowerCase().includes(s)
      );
    }
    if (filtroCasa !== "todas") {
      list = list.filter((c) => c.casa === filtroCasa);
    }
    return list;
  }, [clientes, search, filtroStatus, filtroCasa, linkTipo]);

  const casaOrder: Record<string, number> = {
    "Bet365": 0, "Betano": 1, "Superbet": 2, "Betfair": 3,
    "Novibet": 4, "Sportingbet": 5, "KTO": 6, "Sistema": 7,
  };

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const statusA = getClienteStatus(a);
    const statusB = getClienteStatus(b);
    const isFinalA = statusA === "concluido" || statusA === "devolvido";
    const isFinalB = statusB === "concluido" || statusB === "devolvido";

    if (isFinalA && isFinalB) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    const ca = casaOrder[a.casa] ?? 99;
    const cb = casaOrder[b.casa] ?? 99;
    if (ca !== cb) return ca - cb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }), [filtered]);

  // Use ALL clients (not filtered by status) for lucro calculations
  const allClienteIds = useMemo(() => new Set(clientes.map((c) => c.id)), [clientes]);
  const minLucroDate = "2026-03-19";
  const lucroDateStr = format(lucroDate, "yyyy-MM-dd");

  const lucroDiario = useMemo(() => {
    if (lucroDateStr < minLucroDate) return 0;
    return transacoes
      .filter((t) => allClienteIds.has(t.cliente_id) && t.data_transacao === lucroDateStr && t.tipo !== "deposito")
      .reduce((a, t) => a + Number(t.lucro || 0), 0);
  }, [transacoes, allClienteIds, lucroDateStr]);

  const lucroTotal = useMemo(() => {
    return transacoes
      .filter((t) => allClienteIds.has(t.cliente_id) && t.data_transacao >= minLucroDate && t.tipo !== "deposito")
      .reduce((a, t) => a + Number(t.lucro || 0), 0);
  }, [transacoes, allClienteIds]);

  const openEditDialog = (c: ClienteViewer) => {
    setEditDialog(c);
    setEditFields({
      nome: c.nome || "",
      login: c.login || "",
      senha: c.senha || "",
      banco_deposito: c.banco_deposito || "",
      informacoes_adicionais: c.informacoes_adicionais || "",
    });
  };

  const handleEditCliente = async () => {
    if (!editDialog) return;
    setEditLoading(true);
    try {
      const { error } = await supabase
        .from("delay_clientes")
        .update({
          nome: editFields.nome.trim() || editDialog.nome,
          login: editFields.login.trim() || null,
          senha: editFields.senha.trim() || null,
          banco_deposito: editFields.banco_deposito.trim() || null,
          informacoes_adicionais: editFields.informacoes_adicionais.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editDialog.id);
      if (error) throw error;
      toast({ title: "Cliente atualizado!" });
      setEditDialog(null);
      fetchClientesSilent();
    } catch (e: unknown) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "Erro desconhecido", variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  };


  const handleContaQueimada = async (cliente: ClienteViewer) => {
    // Persiste no localStorage E no ref — nunca volta mesmo após refresh
    addQueimada(cliente.id);
    setClientes(prev => prev.filter(c => c.id !== cliente.id));
    toast({ title: "Conta Queimada! Enviada para aprovação do administrador." });
    // Usa Edge Function (service_role) para garantir que o update passa mesmo sem RLS
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delay-viewer?token=${token}&_t=${Date.now()}`;
      await fetch(url, {
        method: "POST",
        headers: {
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cliente_id: cliente.id }),
      });
    } catch {
      // Silencioso — a ocultação local já foi feita
    }
  };

  const handleTransacao = async () => {
    if (!transDialog) return;
    const valor = parseFloat(transValor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    setTransLoading(true);
    try {
      const { cliente, tipo } = transDialog;
      if (tipo === "deposito") {
        const novoDeposito = cliente.depositos + valor;
        const { error } = await supabase
          .from("delay_clientes")
          .update({ depositos: novoDeposito, updated_at: new Date().toISOString() })
          .eq("id", cliente.id);
        if (error) throw error;
        await supabase.from("delay_transacoes").insert({
          cliente_id: cliente.id,
          tipo: "deposito",
          valor,
          lucro: 0,
          custo: 0,
          data_transacao: format(new Date(), "yyyy-MM-dd"),
        });
      } else if (tipo === "saque") {
        const novoSaque = cliente.saques + valor;
        const lucroCalculado = novoSaque - cliente.custos - cliente.depositos;
        const { error } = await supabase
          .from("delay_clientes")
          .update({ saques: novoSaque, lucro: lucroCalculado, status: "concluido", operacao: "concluido", updated_at: new Date().toISOString() })
          .eq("id", cliente.id);
        if (error) throw error;
        await supabase.from("delay_transacoes").insert({
          cliente_id: cliente.id,
          tipo: "saque",
          valor,
          lucro: lucroCalculado,
          custo: cliente.custos,
          data_transacao: format(new Date(), "yyyy-MM-dd"),
        });
      } else if (tipo === "saque_pendente") {
        const novoDeposito = cliente.depositos + valor;
        const now = new Date().toISOString();
        const { error } = await supabase
          .from("delay_clientes")
          .update({
            status: "saque_pendente",
            operacao: "saque_pendente",
            depositos: novoDeposito,
            data_deposito: now,
            updated_at: now,
          })
          .eq("id", cliente.id);
        if (error) throw error;
        await supabase.from("delay_transacoes").insert({
          cliente_id: cliente.id,
          tipo: "deposito",
          valor,
          lucro: 0,
          custo: 0,
          data_transacao: format(new Date(), "yyyy-MM-dd"),
        });
      } else if (tipo === "saque_fornecedor") {
        const custo = parseFloat(transCusto.replace(",", ".")) || 0;
        // Remove imediatamente da lista e persiste no localStorage (igual ao handleContaQueimada)
        addQueimada(cliente.id);
        setClientes(prev => prev.filter(c => c.id !== cliente.id));
        // Usa a Edge Function via POST (service_role) para garantir que o update no banco passa mesmo sem RLS
        try {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delay-viewer?token=${token}&_t=${Date.now()}`;
          await fetch(url, {
            method: "POST",
            headers: {
              "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cliente_id: cliente.id,
              deposito_pendente: valor,
              custos: custo,
            }),
          });
        } catch {
          // Silencioso — a ocultação local já foi feita
        }
      }
      toast({ title: tipo === "deposito" ? "Depósito registrado!" : tipo === "saque" ? "Saque registrado!" : tipo === "saque_fornecedor" ? "Saque enviado para confirmação!" : "Saque pendente marcado!" });
      setTransDialog(null);
      setTransValor("");
      setTransCusto("");
      if (tipo !== "saque_fornecedor") fetchClientesSilent();
    } catch (e: unknown) {
      toast({ title: "Erro ao registrar transação", description: e instanceof Error ? e.message : "Erro desconhecido", variant: "destructive" });
    } finally {
      setTransLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!`, duration: 1500 });
  };

  const getStatusBadge = (c: ClienteViewer) => {
    if (c.operacao === "saque_pendente")
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">Saque Pendente</Badge>;
    if (c.deposito_pendente > 0 && c.status === "ativo")
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">Aguardando Depósito</Badge>;
    if (c.status === "ativo" && c.operacao === "operando")
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Operando</Badge>;
    if (c.status === "concluido")
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Concluído</Badge>;
    if (c.status === "devolvido")
      return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]">Devolvido</Badge>;
    return <Badge variant="outline" className="text-[10px]">{c.status}</Badge>;
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <Lock className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground text-center">Link inválido. Nenhum token fornecido.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <Lock className="h-12 w-12 text-destructive" />
            <p className="text-destructive text-center font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="fixed top-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-b px-4 py-3 space-y-2">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <img src={rwLogo} alt="RW" className="h-8 w-8 rounded-full" />
            <div>
              <h1 className="text-sm font-bold">Delay Esportivo</h1>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3" /> Visualização · {sorted.length} clientes
                {viewerNick && <span className="text-primary font-semibold">· {viewerNick}</span>}
              </p>
            </div>
          </div>
          {linkTipo === "editor" ? (
            <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">
              Editor
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              <Lock className="h-3 w-3 mr-1" /> Somente leitura
            </Badge>
          )}
        </div>

        <div className="max-w-6xl mx-auto flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {casas.length > 1 && (
            <Select value={filtroCasa} onValueChange={setFiltroCasa}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Casas</SelectItem>
                {casas.map((c) => {
                  const logo = getCasaLogo(c);
                  return (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-1.5">
                        {logo && <img src={logo} alt={c} className="h-4 w-4 rounded-sm object-contain" />}
                        {c}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="max-w-6xl mx-auto flex items-center gap-2 flex-wrap">
          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {viewerNick && (
            <Badge variant="secondary" className="text-[10px]">{viewerNick}</Badge>
          )}
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {([
            { key: "operando", label: "Operando" },
            { key: "saque_pendente", label: "Saque Pendente" },
            { key: "concluido", label: "Concluídos" },
            { key: "devolvido", label: "Devolvido" },
            { key: "red", label: "Red" },
            ...(linkTipo === "editor" ? [{ key: "aguardando", label: "Aguardando" }] : []),
          ] as { key: string; label: string }[]).map(f => (
            <Button
              key={f.key}
              size="sm"
              variant={filtroStatus === f.key ? "default" : "outline"}
              className="h-7 text-xs px-2.5"
              onClick={() => setFiltroStatus(f.key)}
            >
              {f.label} ({statusCounts[f.key] || 0})
            </Button>
          ))}
        </div>

        {/* Stats row - fixed below filters */}
        <div className="max-w-6xl mx-auto grid grid-cols-4 gap-3">
          <div className="rounded-lg border bg-background/60 px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Lucro Total</p>
            <p className={`text-base font-bold font-mono ${lucroTotal >= 0 ? "text-emerald-500" : "text-destructive"}`}>{fmt(lucroTotal)}</p>
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <div className="rounded-lg border bg-background/60 px-4 py-3 text-center cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-center gap-1">Lucro Diário <CalendarIcon className="h-3 w-3" /></p>
                <p className={`text-base font-bold font-mono ${lucroDiario >= 0 ? "text-green-500" : "text-destructive"}`}>{fmt(lucroDiario)}</p>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="center">
              <Calendar
                mode="single"
                selected={lucroDate}
                onSelect={(d) => { if (d) { setLucroDate(d); setCalendarOpen(false); } }}
                locale={ptBR}
                className="p-3 pointer-events-auto"
                initialFocus
              />
              <div className="p-2 border-t">
                <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => { setLucroDate(new Date()); setCalendarOpen(false); }}>
                  Voltar para Hoje
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <div className="rounded-lg border bg-background/60 px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total</p>
            <p className="text-base font-bold">{sorted.length}</p>
          </div>
          <div className="rounded-lg border bg-background/60 px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Depósitos</p>
            <p className="text-base font-bold font-mono text-primary">{fmt(sorted.reduce((a, c) => a + c.depositos, 0))}</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-56 space-y-4">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {sorted.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum cliente encontrado.
              </CardContent>
            </Card>
          ) : (
            sorted.map((c) => {
              const logo = getCasaLogo(c.casa);
              const showSenha = senhaVisivel[c.id];
              return (
                <Card key={c.id} className="overflow-hidden">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {logo && <img src={logo} alt={c.casa} className="h-5 w-5 rounded-sm object-contain" />}
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{c.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{c.casa} · {c.tipo || "50/50"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(c)}
                        {linkTipo === "editor" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={() => openEditDialog(c)}
                            title="Editar cliente"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {(c.login || c.senha) && (
                      <div className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          {c.login && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground w-10">Login:</span>
                              <span className="text-xs font-mono truncate">{c.login}</span>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => copyToClipboard(c.login!, "Login")}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {c.senha && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground w-10">Senha:</span>
                              <span className="text-xs font-mono truncate">{showSenha ? c.senha : "••••••"}</span>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setSenhaVisivel((p) => ({ ...p, [c.id]: !p[c.id] }))}>
                                {showSenha ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => copyToClipboard(c.senha!, "Senha")}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {c.fornecedor && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground uppercase">Fornecedor {(c.fornecedor || "").replace(/^fornecedor\s+/i, "")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(() => {
                      const bruto = (c.deposito_pendente ?? 0) - (c.depositos ?? 0) - (c.custos ?? 0);
                      const pendingLucro = (c.status === "saque_pendente" && (c.deposito_pendente ?? 0) > 0)
                        ? (c.tipo === "50/50" ? bruto / 2 : bruto)
                        : c.lucro;
                      return (
                        <div className="grid grid-cols-4 gap-1 text-center">
                          <div className="bg-primary/10 rounded p-1.5">
                            <p className="text-[9px] text-muted-foreground">Depósitos</p>
                            <p className="text-[11px] font-bold font-mono text-primary">{fmt(c.depositos)}</p>
                          </div>
                          <div className="bg-muted/40 rounded p-1.5">
                            <p className="text-[9px] text-muted-foreground">Saques</p>
                            <p className="text-[11px] font-bold font-mono">{fmt(c.saques)}</p>
                          </div>
                          <div className="bg-muted/40 rounded p-1.5">
                            <p className="text-[9px] text-muted-foreground">Custos</p>
                            <p className="text-[11px] font-bold font-mono">{fmt(c.custos)}</p>
                          </div>
                          <div className={`rounded p-1.5 ${pendingLucro < 0 ? "bg-destructive/10" : "bg-green-500/10"}`}>
                            <p className="text-[9px] text-muted-foreground">{pendingLucro < 0 ? "Red" : "Lucro"}</p>
                            <p className={`text-[11px] font-bold font-mono ${pendingLucro < 0 ? "text-destructive" : "text-green-500"}`}>{fmt(pendingLucro)}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {(linkTipo === "editor" || linkTipo === "visualizador_individual") && (
                      <div className="flex gap-1.5 pt-1">
                        {linkTipo === "editor" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
                              onClick={() => { setTransDialog({ cliente: c, tipo: "deposito" }); setTransValor(""); }}
                            >
                              <ArrowDownCircle className="h-3.5 w-3.5" /> Depósito
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-7 text-xs gap-1 border-green-500/40 text-green-500 hover:bg-green-500/10"
                              onClick={() => { setTransDialog({ cliente: c, tipo: "saque" }); setTransValor(""); }}
                            >
                              <ArrowUpCircle className="h-3.5 w-3.5" /> Saque
                            </Button>
                          </>
                        )}
                        {linkTipo === "visualizador_individual" && c.status !== "saque_pendente" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs gap-1 border-green-500/40 text-green-500 hover:bg-green-500/10"
                            onClick={() => { setTransDialog({ cliente: c, tipo: "saque_fornecedor" }); setTransValor(""); setTransCusto(""); }}
                          >
                            <ArrowUpCircle className="h-3.5 w-3.5" /> Saque
                          </Button>
                        )}
                        {c.status !== "saque_pendente" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={transLoading}
                            className="flex-1 h-7 text-xs gap-1 border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10"
                            onClick={() => {
                              if (linkTipo === "visualizador_individual") {
                                handleContaQueimada(c);
                              } else {
                                setTransDialog({ cliente: c, tipo: "saque_pendente" });
                                setTransValor("");
                              }
                            }}
                          >
                            <Clock className="h-3.5 w-3.5" /> {linkTipo === "visualizador_individual" ? "Conta Queimada" : "Saque Pendente"}
                          </Button>
                        )}
                      </div>
                    )}

                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Edit client dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) setEditDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Editar Cliente</DialogTitle>
          </DialogHeader>
          {editDialog && (
            <div className="space-y-3 py-1">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input className="h-8 text-sm" value={editFields.nome} onChange={(e) => setEditFields(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Login</label>
                <Input className="h-8 text-sm font-mono" value={editFields.login} onChange={(e) => setEditFields(p => ({ ...p, login: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Senha</label>
                <Input className="h-8 text-sm font-mono" value={editFields.senha} onChange={(e) => setEditFields(p => ({ ...p, senha: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Banco / PIX</label>
                <Input className="h-8 text-sm" value={editFields.banco_deposito} onChange={(e) => setEditFields(p => ({ ...p, banco_deposito: e.target.value }))} placeholder="Ex: Santander / 99999999999" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Informações adicionais</label>
                <Input className="h-8 text-sm" value={editFields.informacoes_adicionais} onChange={(e) => setEditFields(p => ({ ...p, informacoes_adicionais: e.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditDialog(null)}>
              Cancelar
            </Button>
            <Button size="sm" className="h-8 text-xs" disabled={editLoading} onClick={handleEditCliente}>
              {editLoading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor transaction dialog */}
      <Dialog open={!!transDialog} onOpenChange={(open) => { if (!open) { setTransDialog(null); setTransValor(""); setTransCusto(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {transDialog?.tipo === "deposito" && "Registrar Depósito"}
              {transDialog?.tipo === "saque" && "Registrar Saque"}
              {transDialog?.tipo === "saque_pendente" && (linkTipo === "visualizador_individual" ? "Conta Queimada" : "Marcar Saque Pendente")}
              {transDialog?.tipo === "saque_fornecedor" && `Saque — ${transDialog.cliente.nome}`}
            </DialogTitle>
          </DialogHeader>
          {transDialog && (
            <div className="space-y-3 py-2">
              {transDialog.tipo === "saque_fornecedor" ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Casa de Aposta</label>
                    <div className="h-9 px-3 rounded-md border border-input bg-muted/30 flex items-center text-sm font-medium">
                      {transDialog.cliente.casa}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Valor</label>
                    <Input className="h-9 text-sm font-mono" placeholder="0,00" value={transValor}
                      onChange={(e) => setTransValor(e.target.value)} autoFocus />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Custo da Conta</label>
                    <Input className="h-9 text-sm font-mono" placeholder="0,00" value={transCusto}
                      onChange={(e) => setTransCusto(e.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Cliente: <span className="font-semibold text-foreground">{transDialog.cliente.nome}</span>
                    {" · "}{transDialog.cliente.casa}
                  </p>
                  {transDialog.tipo !== "saque_pendente" && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        {transDialog.tipo === "deposito" ? "Depósito atual: " : "Depósito: "}
                        <span className="font-mono font-semibold text-foreground">{fmt(transDialog.cliente.depositos)}</span>
                      </p>
                      {transDialog.tipo === "saque" && (
                        <p className="text-xs text-muted-foreground">
                          Custos: <span className="font-mono font-semibold text-foreground">{fmt(transDialog.cliente.custos)}</span>
                        </p>
                      )}
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      {transDialog.tipo === "saque_pendente" ? "Valor Depositado (R$)" : "Valor (R$)"}
                    </label>
                    <Input className="h-9 text-sm font-mono" placeholder="0,00" value={transValor}
                      onChange={(e) => setTransValor(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleTransacao(); }} autoFocus />
                  </div>
                  {transDialog.tipo === "saque" && transValor && !isNaN(parseFloat(transValor.replace(",", "."))) && (
                    <div className="bg-muted/40 rounded p-2 text-xs space-y-0.5">
                      <p className="text-muted-foreground">
                        Lucro estimado: <span className={`font-mono font-bold ${(parseFloat(transValor.replace(",", ".")) - transDialog.cliente.custos - transDialog.cliente.depositos) >= 0 ? "text-green-500" : "text-destructive"}`}>
                          {fmt(parseFloat(transValor.replace(",", ".")) - transDialog.cliente.custos - transDialog.cliente.depositos)}
                        </span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setTransDialog(null); setTransValor(""); setTransCusto(""); }}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={transLoading || !transValor}
              onClick={handleTransacao}
            >
              {transLoading ? "Salvando..." : transDialog?.tipo === "saque_fornecedor" ? "Confirmar Saque" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DelayViewer;
