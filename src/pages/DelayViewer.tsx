import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { getCasaLogo } from "@/lib/casas-apostas";
import { Users, Copy, Search, Eye, EyeOff, Filter, Lock, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import rwLogo from "@/assets/rw-logo.png";

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

type DelayViewerResponse = {
  clientes?: ClienteViewer[];
  transacoes?: DelayTransacaoViewer[];
  nick?: string | null;
  tipo?: string;
  error?: string;
};

const formatFornecedorLabel = (fornecedor: string | null | undefined) => {
  const value = fornecedor?.trim();

  if (!value) return "Sem fornecedor";

  const normalized = value.replace(/^(?:fornecedor\s+)+/i, "").trim().toUpperCase();

  return normalized ? `FORNECEDOR ${normalized}` : "Sem fornecedor";
};

const DelayViewer = () => {
  const { token: routeToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const token = routeToken ?? searchParams.get("token");
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

  const delayViewerUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/delay-viewer`;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const applyViewerData = (result: DelayViewerResponse) => {
    setClientes(result.clientes || []);
    setTransacoes(result.transacoes || []);
    setViewerNick(result.nick || null);
    setLinkTipo(result.tipo || "visualizador");
    setError("");
  };

  const requestViewerData = async (): Promise<DelayViewerResponse> => {
    const res = await fetch(`${delayViewerUrl}?token=${token}`, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });

    const rawText = await res.text();
    let result: DelayViewerResponse = {};

    if (rawText) {
      try {
        result = JSON.parse(rawText) as DelayViewerResponse;
      } catch {
        throw new Error("Resposta inválida do servidor.");
      }
    }

    if (!res.ok) {
      throw new Error(result.error || "Erro ao carregar dados.");
    }

    return result;
  };

  useEffect(() => {
    if (!token) {
      setError("Token não fornecido.");
      setLoading(false);
      return;
    }

    void fetchClientes();

    const interval = setInterval(() => {
      void fetchClientesSilent();
    }, 4000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchClientesSilent();
      }
    };
    const handleFocus = () => {
      void fetchClientesSilent();
    };

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
      const result = await requestViewerData();
      applyViewerData(result);
    } catch {
      // mantém os dados anteriores em polling silencioso
    }
  };

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const result = await requestViewerData();
      applyViewerData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar com o servidor.");
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
    const counts: Record<string, number> = { todos: baseList.length, operando: 0, concluido: 0, devolvido: 0, saque_pendente: 0 };
    baseList.forEach(c => { counts[getClienteStatus(c)]++; });
    return counts;
  }, [clientes, linkTipo]);

  const filtered = useMemo(() => {
    let list = clientes.filter((c) => {
      if (linkTipo !== "visualizador_vodka" && c.nome.toLowerCase().includes("vodka")) return false;
      if (getClienteStatus(c) === "aguardando") return false;
      return true;
    });

    if (filtroStatus !== "todos") {
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
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
        <div className="bg-card/95 px-4 py-3">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <img src={rwLogo} alt="RW" className="h-8 w-8 rounded-full" />
              <div>
                <h1 className="text-sm font-bold">Delay Esportivo</h1>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" /> Visualização · {sorted.length} clientes
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">
              <Lock className="h-3 w-3 mr-1" /> Somente leitura
            </Badge>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[150px]">
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
                <SelectTrigger className="w-[140px] h-8 text-xs">
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

          <div className="flex items-center gap-2 flex-wrap">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {viewerNick && (
              <Badge variant="secondary" className="text-[10px]">{viewerNick}</Badge>
            )}
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {([
              { key: "todos", label: "Todos" },
              { key: "operando", label: "Operando" },
              { key: "concluido", label: "Concluído" },
              { key: "devolvido", label: "Devolvido" },
            ] as const).map(f => (
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

          <div className="grid grid-cols-2 gap-2">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Lucro Total</p>
                <p className={`text-sm font-bold font-mono mt-2 ${lucroTotal >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {fmt(lucroTotal)}
                </p>
              </CardContent>
            </Card>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Card className="cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all">
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                      Lucro Diário <CalendarIcon className="h-3 w-3" />
                    </p>
                    <p className="text-[9px] text-muted-foreground/70 mb-0.5">
                      {format(lucroDate, "dd/MM/yyyy")}
                    </p>
                    <p className={`text-sm font-bold font-mono ${lucroDiario >= 0 ? "text-green-500" : "text-destructive"}`}>
                      {fmt(lucroDiario)}
                    </p>
                  </CardContent>
                </Card>
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7"
                    onClick={() => { setLucroDate(new Date()); setCalendarOpen(false); }}
                  >
                    Voltar para Hoje
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {filtroStatus !== "concluido" && filtroStatus !== "devolvido" && (
            <div className="grid grid-cols-2 gap-2">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="text-sm font-bold">{sorted.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Depósitos</p>
                  <p className="text-sm font-bold font-mono text-primary">{fmt(sorted.reduce((a, c) => a + c.depositos, 0))}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-4">

        <div className="space-y-2">
          {sorted.length === 0 ? (
            <Card>
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
                              <span className="text-[10px] text-muted-foreground uppercase">{formatFornecedorLabel(c.fornecedor)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

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
                      <div className={`rounded p-1.5 ${c.lucro < 0 ? "bg-destructive/10" : "bg-green-500/10"}`}>
                        <p className="text-[9px] text-muted-foreground">{c.lucro < 0 ? "Red" : "Lucro"}</p>
                        <p className={`text-[11px] font-bold font-mono ${c.lucro < 0 ? "text-destructive" : "text-green-500"}`}>{fmt(c.lucro)}</p>
                      </div>
                    </div>

                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default DelayViewer;
