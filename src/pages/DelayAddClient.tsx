import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CASAS_APOSTAS, getCasaLogo } from "@/lib/casas-apostas";
import { UserPlus, Plus, Users, Copy, Search, Check, ChevronsUpDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import rwLogo from "@/assets/rw-logo.png";

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
  const { token: routeToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const token = routeToken ?? searchParams.get("token");
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
  const [statusFilter, setStatusFilter] = useState("todos");

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
    return sortedClientes.filter(c => getClienteStatus(c) === statusFilter);
  }, [sortedClientes, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: clientes.length, ativo: 0, concluido: 0, devolvido: 0, saque_pendente: 0, aguardando: 0 };
    clientes.forEach(c => { counts[getClienteStatus(c)]++; });
    return counts;
  }, [clientes]);

  const apiUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/delay-add-client`;

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
        fornecedor: linkNick ? linkNick.toUpperCase() : "",
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

  const getBancoLabel = (banco: string | null) => {
    if (banco === "c6") return "C6 Bank";
    if (banco === "santander") return "Santander";
    return banco || "—";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="text-center space-y-2 pb-3">
            <img src={rwLogo} alt="RW Investimentos" className="h-64 w-auto mx-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]" />
            <CardTitle className="text-xl">Delay Esportivo{linkNick ? ` - ${linkNick}` : " - Clientes"}</CardTitle>
            <p className="text-sm text-muted-foreground">Gerencie seus clientes abaixo</p>
          </CardHeader>
        </Card>

        {/* Client List */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Seus Clientes ({clientes.length})</span>
          </div>
          <Button size="sm" onClick={startNew} variant={showForm ? "secondary" : "default"}>
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        </div>

        {/* Status Filter */}
        {clientes.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {([
              { key: "todos", label: "Todos" },
              { key: "ativo", label: "Ativo" },
              { key: "saque_pendente", label: "Saque Pendente" },
              { key: "aguardando", label: "Aguardando" },
              { key: "concluido", label: "Concluído" },
              { key: "devolvido", label: "Devolvido" },
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
          </div>
        )}

        {loadingClientes ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : clientes.length === 0 && !showForm ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum cliente adicionado ainda. Clique em "Novo" para começar.
          </p>
        ) : filteredClientes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum cliente com este status.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <div className="mt-3 pt-2 border-t border-border/30 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                    <span>Banco: <span className="text-foreground font-medium">{getBancoLabel(c.banco_deposito)}</span></span>
                    {c.depositos > 0 && (
                      <span>Depósito: <span className="text-foreground font-medium">R$ {c.depositos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                    )}
                    {c.custos > 0 && (
                      <span>Lucro: <span className="text-primary font-medium">R$ {c.custos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                    )}
                    {c.deposito_pendente > 0 && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-orange-500/20 text-orange-400 animate-pulse">
                        Aguardando aprovação: R$ {c.deposito_pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={(open) => { if (!open) { resetForm(); setShowForm(false); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Login *</Label>
                  <Input value={login} onChange={e => setLogin(e.target.value)} placeholder="Login da conta" required />
                </div>
                <div className="space-y-2">
                  <Label>Senha *</Label>
                  <Input value={senha} onChange={e => setSenha(e.target.value)} placeholder="Senha da conta" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
