import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CASAS_APOSTAS, getCasaLogo } from "@/lib/casas-apostas";
import { UserPlus, Plus, Users, Copy, Search, Check, ChevronsUpDown, Filter, Pencil, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
const rwLogo = "/rw-logo.png";

interface ClienteExterno {
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
  created_at: string;
  informacoes_adicionais?: string | null;
}

const DelayAddClient = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { toast } = useToast();

  const [nome, setNome] = useState("");
  const [casa, setCasa] = useState("Bet365");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [tipo, setTipo] = useState("50/50");
  const [bancoDeposito, setBancoDeposito] = useState("santander");
  const [valorDeposito, setValorDeposito] = useState("1.000,00");
  const [informacoesAdicionais, setInformacoesAdicionais] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<ClienteExterno[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [linkNick, setLinkNick] = useState<string | null>(null);
  const [casaOpen, setCasaOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ativo");

  // Edit dialog
  const [editDialog, setEditDialog] = useState<ClienteExterno | null>(null);
  const [editFields, setEditFields] = useState({ nome: "", login: "", senha: "", informacoes_adicionais: "", banco_deposito: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [lucroMesDate, setLucroMesDate] = useState<Date>(new Date());
  const [lucroMesCalendarOpen, setLucroMesCalendarOpen] = useState(false);

  const getClienteStatus = (c: ClienteExterno) => {
    if (c.saques > 0 && c.saques === c.depositos && c.lucro === 0) return "devolvido";
    if (c.saques > 0) return "concluido";
    if (c.status === "saque_pendente") return "saque_pendente";
    if (c.deposito_pendente > 0 && c.depositos === 0) return "aguardando";
    return "ativo";
  };

  const sortedClientes = useMemo(() => {
    const statusOrder: Record<string, number> = {
      saque_pendente: 0,
      ativo: 1,
      aguardando: 2,
      concluido: 3,
      devolvido: 4,
    };
    return [...clientes].sort((a, b) => {
      const statusA = getClienteStatus(a);
      const statusB = getClienteStatus(b);
      // Within "ativo", prioritize operando
      const orderA = statusOrder[statusA] ?? 5;
      const orderB = statusOrder[statusB] ?? 5;
      if (orderA !== orderB) return orderA - orderB;
      // Within ativo, put "operando" first
      if (statusA === "ativo" && statusB === "ativo") {
        const opA = a.operacao === "operando" ? 0 : 1;
        const opB = b.operacao === "operando" ? 0 : 1;
        return opA - opB;
      }
      return 0;
    });
  }, [clientes]);

  const filteredClientes = useMemo(() => {
    if (statusFilter === "todos") return sortedClientes;
    if (statusFilter === "red") return sortedClientes.filter(c => c.lucro < 0);
    return sortedClientes.filter(c => getClienteStatus(c) === statusFilter);
  }, [sortedClientes, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: clientes.length, ativo: 0, concluido: 0, devolvido: 0, saque_pendente: 0, aguardando: 0, red: 0 };
    clientes.forEach(c => {
      counts[getClienteStatus(c)]++;
      if (c.lucro < 0) counts.red++;
    });
    return counts;
  }, [clientes]);

  const apiUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/delay-add-client`;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const lucroMesTotal = useMemo(() => {
    const year = lucroMesDate.getFullYear();
    const month = lucroMesDate.getMonth();
    return clientes.filter(c => {
      const d = new Date(c.created_at);
      return d.getFullYear() === year && d.getMonth() === month;
    }).reduce((a, c) => a + (c.custos ?? 0), 0);
  }, [clientes, lucroMesDate]);
  const depositosAtivos = useMemo(() =>
    filteredClientes.filter(c => c.depositos > 0 && c.saques === 0 && c.status !== "saque_pendente" && (c.deposito_pendente ?? 0) <= 0)
      .reduce((a, c) => a + c.depositos, 0),
    [filteredClientes]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência" });
  };

  const fetchClientes = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoadingClientes(true);
    try {
      const res = await fetch(`${apiUrl}?token=${token}`);
      const data = await res.json();
      if (res.ok) {
        setClientes(data.clientes || []);
        setLinkNick(data.nick || null);
        if (data.nick) setFornecedor(data.nick.toUpperCase());
      }
    } catch {
      // silent
    } finally {
      if (!silent) setLoadingClientes(false);
    }
  };

  useEffect(() => {
    fetchClientes();

    // Poll every 4s so deletions/updates by admin appear automatically
    const intervalId = window.setInterval(() => {
      fetchClientes(true);
    }, 4000);

    const handleFocus = () => fetchClientes(true);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchClientes(true);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive font-medium">Link inválido. Solicite um novo link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const resetForm = () => {
    setNome("");
    setCasa("Bet365");
    setLogin("");
    setSenha("");
    setFornecedor(linkNick ? linkNick.toUpperCase() : "");
    setTipo("50/50");
    setBancoDeposito("santander");
    setValorDeposito("1.000,00");
    setInformacoesAdicionais("");
  };


  const startNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missingFields: string[] = [];
    if (!nome.trim()) missingFields.push("Nome");
    if (!informacoesAdicionais.trim()) missingFields.push("Pix");
    if (!login.trim()) missingFields.push("Login");
    if (!senha.trim()) missingFields.push("Senha");
    if (!valorDeposito.trim()) missingFields.push("Valor Depósito");

    if (missingFields.length > 0) {
      toast({ title: "Campos obrigatórios", description: `Preencha: ${missingFields.join(", ")}`, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        token,
        nome: nome.trim(),
        casa,
        login: login.trim(),
        senha: senha.trim(),
        fornecedor: linkNick ? `Fornecedor ${linkNick.toUpperCase()}` : "",
        tipo,
        banco_deposito: bancoDeposito,
        valor_deposito: parseFloat(valorDeposito.replace(/\./g, "").replace(",", ".")) || 0,
        informacoes_adicionais: informacoesAdicionais.trim() || null,
      };

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");

      toast({
        title: "Sucesso",
        description: "Cliente adicionado!",
      });
      resetForm();
      setShowForm(false);
      fetchClientes();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao processar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (c: ClienteExterno) => {
    setEditDialog(c);
    setEditFields({
      nome: c.nome || "",
      login: c.login || "",
      senha: c.senha || "",
      informacoes_adicionais: c.informacoes_adicionais || "",
      banco_deposito: c.banco_deposito || "",
    });
  };

  const handleEditSave = async () => {
    if (!editDialog) return;
    setEditLoading(true);
    try {
      const { error } = await supabase
        .from("delay_clientes")
        .update({
          nome: editFields.nome.trim() || editDialog.nome,
          login: editFields.login.trim() || null,
          senha: editFields.senha.trim() || null,
          informacoes_adicionais: editFields.informacoes_adicionais.trim() || null,
          banco_deposito: editFields.banco_deposito.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editDialog.id);
      if (error) throw error;
      toast({ title: "Cliente atualizado!" });
      setEditDialog(null);
      fetchClientes(true);
    } catch (e: unknown) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  };

  const getBancoLabel = (banco: string | null) => {
    if (banco === "c6") return "Carteira Pessoal";
    if (banco === "santander") return "Santander";
    return banco || "—";
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Fixed compact header — equal to viewer style */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-background/95 backdrop-blur border-b space-y-3 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <img src={rwLogo} alt="RW" className="h-8 w-8 rounded-full object-contain" />
          <div>
            <h1 className="text-sm font-bold">Delay Esportivo{linkNick ? ` - ${linkNick}` : ""}</h1>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> {clientes.length} clientes
            </p>
          </div>
        </div>

        {/* Status Filter + Novo button */}
        <div className="max-w-6xl mx-auto flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {([
            { key: "ativo", label: "Ativo" },
            { key: "saque_pendente", label: "Saque Pendente" },
            { key: "aguardando", label: "Aguardando" },
            { key: "concluido", label: "Concluído" },
            { key: "devolvido", label: "Devolvido" },
            { key: "red", label: "Red" },
          ] as const).filter(f => statusCounts[f.key] > 0).map(f => (
            <Button
              key={f.key}
              size="sm"
              variant={statusFilter === f.key ? "default" : "outline"}
              className="h-7 text-xs px-2.5"
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label} ({statusCounts[f.key]})
            </Button>
          ))}
          <Button size="sm" onClick={startNew} variant={showForm ? "secondary" : "default"} className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo
          </Button>
        </div>

        {/* Stats bar */}
        <div className="max-w-6xl mx-auto grid grid-cols-3 gap-3">
          <Popover open={lucroMesCalendarOpen} onOpenChange={setLucroMesCalendarOpen}>
            <PopoverTrigger asChild>
              <div className="rounded-lg border bg-background/60 px-4 py-3 text-center cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-center gap-1">Lucro Total <CalendarIcon className="h-3 w-3" /></p>
                <p className={`text-base font-bold font-mono ${lucroMesTotal >= 0 ? "text-emerald-500" : "text-destructive"}`}>{fmt(lucroMesTotal)}</p>
                <p className="text-[9px] text-muted-foreground capitalize mt-0.5">{format(lucroMesDate, "MMMM yyyy", { locale: ptBR })}</p>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 z-50" align="center">
              <div className="flex items-center justify-between gap-4 mb-2">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLucroMesDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium capitalize">{format(lucroMesDate, "MMMM yyyy", { locale: ptBR })}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLucroMesDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => { setLucroMesDate(new Date()); setLucroMesCalendarOpen(false); }}>
                Mês Atual
              </Button>
            </PopoverContent>
          </Popover>
          <div className="rounded-lg border bg-background/60 px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total</p>
            <p className="text-base font-bold">{filteredClientes.length}</p>
          </div>
          <div className="rounded-lg border bg-background/60 px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Depósitos</p>
            <p className="text-base font-bold font-mono text-primary">{fmt(depositosAtivos)}</p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="max-w-6xl mx-auto px-4 pt-56 space-y-4">
        {loadingClientes ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : clientes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum cliente adicionado ainda. Clique em "Novo" para começar.
          </p>
        ) : filteredClientes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum cliente com este status.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredClientes.map((c) => (
              <Card key={c.id} className="overflow-hidden border-border/50">
                <CardContent className="p-4 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-bold text-sm truncate">{c.nome}</span>
                      <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary hover:bg-primary/30 shrink-0">
                        {c.tipo || "50/50"}
                      </Badge>
                      {c.saques > 0 && c.saques === c.depositos && c.lucro === 0 ? (
                        <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 shrink-0">Devolvido</Badge>
                      ) : c.saques > 0 && !(c.saques === c.depositos && c.lucro === 0) ? (
                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 shrink-0">Concluído</Badge>
                      ) : c.status === "saque_pendente" ? (
                        <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 shrink-0 animate-pulse">Saque Pendente</Badge>
                      ) : (
                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 shrink-0">
                          {c.status === "ativo" ? "Ativo" : c.status}
                        </Badge>
                      )}
                      {!(c.deposito_pendente > 0 && c.depositos === 0) && !(c.saques > 0) && c.status !== "saque_pendente" && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 shrink-0 capitalize">
                          {c.operacao}
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0" onClick={() => openEdit(c)} title="Editar">
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    {getCasaLogo(c.casa) && (
                      <img src={getCasaLogo(c.casa)} alt={c.casa} className="w-6 h-6 rounded-sm shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0 text-muted-foreground space-y-0.5 text-xs">
                      <p className="text-muted-foreground text-xs mb-0.5">{c.casa}</p>
                      {c.login && (
                        <div className="flex items-center gap-1">
                          <span className="uppercase tracking-wider shrink-0 text-[11px]">Login:</span>
                          <span className="font-mono text-foreground truncate flex-1 font-semibold text-xs">{c.login}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-40 hover:opacity-100" onClick={() => copyToClipboard(c.login!)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {c.senha && (
                        <div className="flex items-center gap-1">
                          <span className="uppercase tracking-wider shrink-0 text-[11px]">Senha:</span>
                          <span className="font-mono text-foreground truncate flex-1 font-semibold text-xs">{c.senha}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-40 hover:opacity-100" onClick={() => copyToClipboard(c.senha!)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {c.informacoes_adicionais && c.informacoes_adicionais.trim() !== "" && (
                        <div className="flex items-center gap-1">
                          <span className="uppercase tracking-wider shrink-0 text-[11px]">Pix:</span>
                          <span className="font-mono text-foreground truncate flex-1 font-semibold text-xs">{c.informacoes_adicionais}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-40 hover:opacity-100" onClick={() => copyToClipboard(c.informacoes_adicionais!)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <p className="text-muted-foreground uppercase tracking-wider text-[11px]">
                        {c.fornecedor && c.fornecedor.trim() !== "" ? c.fornecedor : "Sem fornecedor"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/30 text-[11px] text-muted-foreground">
                    <span>Banco: <span className="text-foreground font-medium">{getBancoLabel(c.banco_deposito)}</span></span>
                    {c.deposito_pendente > 0 && c.depositos === 0 && (
                      <Badge className="ml-2 text-[10px] px-1.5 py-0 bg-orange-500/20 text-orange-400 animate-pulse">
                        Aguardando: R$ {c.deposito_pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center mt-2">
                    <div className="bg-primary/10 rounded p-1.5">
                      <p className="text-[9px] text-muted-foreground">Depósitos</p>
                      <p className="text-[11px] font-bold font-mono text-primary">{fmt(c.depositos)}</p>
                    </div>
                    <div className="bg-muted/40 rounded p-1.5">
                      <p className="text-[9px] text-muted-foreground">Saques</p>
                      <p className="text-[11px] font-bold font-mono">{fmt(c.saques)}</p>
                    </div>
                    <div className="bg-green-500/10 rounded p-1.5">
                      <p className="text-[9px] text-muted-foreground">Lucro</p>
                      <p className="text-[11px] font-bold font-mono text-green-500">{fmt(c.custos)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) setEditDialog(null); }}>
          <DialogContent className="w-[95vw] sm:max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Cliente</DialogTitle>
            </DialogHeader>
            {editDialog && (
              <div className="space-y-3 py-1">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input className="h-9" value={editFields.nome} onChange={e => setEditFields(p => ({ ...p, nome: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-1">
                  <Label>Pix</Label>
                  <Input className="h-9" value={editFields.informacoes_adicionais} onChange={e => setEditFields(p => ({ ...p, informacoes_adicionais: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Login</Label>
                  <Input className="h-9 font-mono" value={editFields.login} onChange={e => setEditFields(p => ({ ...p, login: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Senha</Label>
                  <Input className="h-9 font-mono" value={editFields.senha} onChange={e => setEditFields(p => ({ ...p, senha: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Banco</Label>
                  <Input className="h-9" value={editFields.banco_deposito} onChange={e => setEditFields(p => ({ ...p, banco_deposito: e.target.value }))} placeholder="Ex: Santander" />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setEditDialog(null)}>Cancelar</Button>
              <Button size="sm" disabled={editLoading} onClick={handleEditSave}>
                {editLoading ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={(open) => { if (!open) { resetForm(); setShowForm(false); } }}>
          <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value.toUpperCase())} placeholder="Nome do cliente" required className="uppercase" />
              </div>

              <div className="space-y-2">
                <Label>Pix *</Label>
                <Input value={informacoesAdicionais} onChange={e => setInformacoesAdicionais(e.target.value)} placeholder="Pix" required />
              </div>

              <div className="space-y-2">
                <Label>Casa de Aposta</Label>
                <Popover open={casaOpen} onOpenChange={setCasaOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={casaOpen} className="w-full justify-between font-normal">
                      <div className="flex items-center gap-2 truncate">
                        {getCasaLogo(casa) && <img src={getCasaLogo(casa)} alt={casa} className="h-4 w-4 shrink-0" />}
                        {casa}
                      </div>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[60]">
                    <Command>
                      <CommandInput placeholder="Pesquisar casa..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma casa encontrada.</CommandEmpty>
                        <CommandGroup>
                          {CASAS_APOSTAS.map(c => (
                            <CommandItem key={c.nome} value={c.nome} onSelect={(val) => { setCasa(CASAS_APOSTAS.find(ca => ca.nome.toLowerCase() === val.toLowerCase())?.nome || val); setCasaOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", casa === c.nome ? "opacity-100" : "opacity-0")} />
                              <div className="flex items-center gap-2">
                                {c.logo && <img src={c.logo} alt={c.nome} className="h-4 w-4" />}
                                {c.nome}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Login *</Label>
                  <Input value={login} onChange={e => setLogin(e.target.value)} placeholder="Login da conta" required />
                </div>
                <div className="space-y-2">
                  <Label>Senha *</Label>
                  <Input value={senha} onChange={e => setSenha(e.target.value)} placeholder="Senha da conta" required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor Depósito (R$) *</Label>
                  <Input
                    inputMode="numeric"
                    value={valorDeposito}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, "");
                      if (!digits) { setValorDeposito(""); return; }
                      const num = parseInt(digits, 10);
                      const formatted = (num / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      setValorDeposito(formatted);
                    }}
                    placeholder="0,00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Banco Depósito</Label>
                  <Input value="Santander" readOnly disabled className="opacity-70 cursor-not-allowed" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input value={linkNick ? `Fornecedor ${linkNick.toUpperCase()}` : "Fornecedor"} readOnly disabled className="uppercase opacity-70 cursor-not-allowed" />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Input value="50/50" readOnly disabled className="opacity-70 cursor-not-allowed" />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={loading}>
                  <UserPlus className="h-4 w-4 mr-2" />{loading ? "Enviando..." : "Adicionar Cliente"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default DelayAddClient;
