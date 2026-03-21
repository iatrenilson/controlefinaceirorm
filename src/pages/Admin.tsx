import { useState, useEffect, useMemo } from "react";
import { format, isPast, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { Users, Landmark, BarChart3, Search, ShieldCheck, Banknote, AlertTriangle, Percent, UserCheck, Pencil, Trash2, Bell, Send, Mail, Monitor, Sparkles, Loader2, MailCheck, KeyRound } from "lucide-react";
import { EmailDashboard } from "@/components/dashboard/EmailDashboard";
import { Textarea } from "@/components/ui/textarea";

interface Profile {
  user_id: string;
  email: string | null;
  nome: string | null;
  created_at: string;
}

interface Emprestimo {
  id: string;
  nome: string;
  telefone: string;
  valor: number;
  juros: number;
  data_emprestimo: string;
  data_pagamento: string;
  user_id: string;
  user_email?: string;
}

const Admin = () => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingEmprestimos, setLoadingEmprestimos] = useState(true);
  const [buscaUser, setBuscaUser] = useState("");
  const [buscaEmprestimo, setBuscaEmprestimo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "em_dia" | "atrasado">("todos");
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [buscaCliente, setBuscaCliente] = useState("");
  const [filtroStatusCliente, setFiltroStatusCliente] = useState<"todos" | "em_dia" | "atrasado">("todos");
  const [filtroValorCliente, setFiltroValorCliente] = useState<"todos" | "ate_1000" | "1000_5000" | "acima_5000">("todos");
  const [filtroDataCliente, setFiltroDataCliente] = useState<"todos" | "ultimo_mes" | "ultimos_3" | "ultimos_6">("todos");

  // Edit/Delete state
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Password state
  const [editingPasswordUser, setEditingPasswordUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Notification state
  const [notifTitulo, setNotifTitulo] = useState("");
  const [notifMensagem, setNotifMensagem] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifConfirmOpen, setNotifConfirmOpen] = useState(false);
  const [notifHistory, setNotifHistory] = useState<any[]>([]);
  const [notifDestino, setNotifDestino] = useState<"todos" | string>("todos");
  const [notifMetodo, setNotifMetodo] = useState<"site" | "email" | "ambos">("site");
  const [clearingNotifs, setClearingNotifs] = useState(false);
  const [improvingText, setImprovingText] = useState(false);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  useEffect(() => {
    fetchProfiles();
    fetchEmprestimos();
    fetchNotifications();
    fetchUserRoles();
  }, []);

  // Track online users via Realtime Presence
  useEffect(() => {
    const channel = supabase.channel("online-users");

    const syncPresence = () => {
      const state = channel.presenceState();
      const ids = new Set<string>();
      Object.values(state).forEach((presences: any[]) => {
        presences.forEach((p) => {
          if (p.user_id) ids.add(p.user_id);
        });
      });
      setOnlineUsers(ids);
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUserRoles = async () => {
    const { data } = await supabase.from("user_roles").select("user_id, role");
    const rolesMap: Record<string, string[]> = {};
    (data || []).forEach((r: any) => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });
    setUserRoles(rolesMap);
  };

  const handleChangeRole = async (userId: string, newRole: "admin" | "moderator" | "user" | "restrito") => {
    // Remove all existing roles for this user
    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      toast({ title: "Erro ao alterar papel", description: getSafeErrorMessage(deleteError), variant: "destructive" });
      return;
    }

    // If new role is not "user", insert the role
    if (newRole !== "user") {
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole as any });

      if (insertError) {
        toast({ title: "Erro ao definir papel", description: getSafeErrorMessage(insertError), variant: "destructive" });
        return;
      }
    }

    const label = newRole === "admin" ? "Administrador" : newRole === "moderator" ? "Moderador" : newRole === "restrito" ? "Restrito" : "Usuário";
    toast({ title: `Papel alterado para ${label} com sucesso` });
    fetchUserRoles();
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar usuários", description: getSafeErrorMessage(error), variant: "destructive" });
    } else {
      setProfiles(data || []);
    }
    setLoadingProfiles(false);
  };

  const fetchEmprestimos = async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar empréstimos", description: getSafeErrorMessage(error), variant: "destructive" });
    } else {
      const profilesRes = await supabase.from("profiles").select("user_id, email");
      const emailMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.email]));

      setEmprestimos(
        (data || []).map((d: any) => ({
          id: d.id,
          nome: d.nome,
          telefone: d.telefone || "",
          valor: Number(d.valor),
          juros: Number(d.juros),
          data_emprestimo: d.data_emprestimo,
          data_pagamento: d.data_pagamento,
          user_id: d.user_id,
          user_email: emailMap.get(d.user_id) || "Desconhecido",
        }))
      );
    }
    setLoadingEmprestimos(false);
  };

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setEditNome(profile.nome || "");
    setEditEmail(profile.email || "");
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: editNome, email: editEmail })
      .eq("user_id", editingProfile.user_id);

    if (error) {
      toast({ title: "Erro ao atualizar", description: getSafeErrorMessage(error), variant: "destructive" });
    } else {
      toast({ title: "Usuário atualizado com sucesso" });
      setEditingProfile(null);
      fetchProfiles();
      fetchEmprestimos();
    }
    setSaving(false);
  };

  const handleSavePassword = async () => {
    if (!editingPasswordUser) return;
    if (newPassword.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas não coincidem", description: "Digite a mesma senha nos dois campos.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-user-password", {
        body: { user_id: editingPasswordUser.user_id, password: newPassword },
      });
      if (error || data?.error) {
        toast({ title: "Erro ao alterar senha", description: getSafeErrorMessage(error || data), variant: "destructive" });
        setSavingPassword(false);
        return;
      }
      toast({ title: "Senha alterada com sucesso!" });
      setEditingPasswordUser(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Erro ao alterar senha", description: getSafeErrorMessage(err), variant: "destructive" });
    }
    setSavingPassword(false);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await supabase.functions.invoke("delete-user", {
        body: { user_id: deletingUser.user_id },
      });

      if (res.error) {
        toast({ title: "Erro ao excluir", description: getSafeErrorMessage(res.error), variant: "destructive" });
      } else if (res.data?.error) {
        toast({ title: "Erro ao excluir", description: getSafeErrorMessage(res.data), variant: "destructive" });
      } else {
        toast({ title: "Usuário excluído com sucesso" });
        setDeletingUser(null);
        fetchProfiles();
        fetchEmprestimos();
      }
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: getSafeErrorMessage(err), variant: "destructive" });
    }
    setDeleting(false);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    setNotifHistory(data || []);
  };

  const handleSendNotification = async () => {
    if (!notifTitulo.trim() || !notifMensagem.trim()) return;
    setSendingNotif(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
      setSendingNotif(false);
      return;
    }

    const destinoLabel = notifDestino === "todos"
      ? "todos os usuários"
      : profiles.find(p => p.user_id === notifDestino)?.email || "usuário selecionado";

    let siteOk = true;
    let emailOk = true;

    // Send site notification
    if (notifMetodo === "site" || notifMetodo === "ambos") {
      const insertData: any = {
        titulo: notifTitulo.trim(),
        mensagem: notifMensagem.trim(),
        created_by: user.id,
        target_user_id: notifDestino === "todos" ? null : notifDestino,
      };

      const { error } = await supabase.from("notifications").insert(insertData);
      if (error) {
        toast({ title: "Erro ao enviar notificação no site", description: getSafeErrorMessage(error), variant: "destructive" });
        siteOk = false;
      }
    }

    // Send email notification
    if (notifMetodo === "email" || notifMetodo === "ambos") {
      try {
        const { data, error } = await supabase.functions.invoke("send-notification-email", {
          body: {
            titulo: notifTitulo.trim(),
            mensagem: notifMensagem.trim(),
            target_user_id: notifDestino === "todos" ? null : notifDestino,
          },
        });

        if (error || data?.error) {
          toast({
            title: "Erro ao enviar e-mail",
            description: getSafeErrorMessage(error || data),
            variant: "destructive",
          });
          emailOk = false;
        }
      } catch (err: any) {
        toast({ title: "Erro ao enviar e-mail", description: getSafeErrorMessage(err), variant: "destructive" });
        emailOk = false;
      }
    }

    // Success feedback
    if (siteOk && emailOk) {
      const metodoLabel = notifMetodo === "site" ? "no site" : notifMetodo === "email" ? "por e-mail" : "no site e por e-mail";
      toast({ title: `Notificação enviada ${metodoLabel} para ${destinoLabel}!` });
    }

    setNotifTitulo("");
    setNotifMensagem("");
    setNotifDestino("todos");
    setNotifMetodo("site");
    setNotifConfirmOpen(false);
    fetchNotifications();
    setSendingNotif(false);
  };

  const handleClearAllNotifications = async () => {
    setClearingNotifs(true);
    const { error } = await supabase.rpc("admin_clear_all_notifications");
    if (error) {
      toast({ title: "Erro ao limpar notificações", description: getSafeErrorMessage(error), variant: "destructive" });
    } else {
      toast({ title: "Todas as notificações foram removidas!" });
      fetchNotifications();
    }
    setClearingNotifs(false);
  };

  const stats = useMemo(() => {
    const totalEmprestado = emprestimos.reduce((a, e) => a + e.valor, 0);
    const totalJuros = emprestimos.reduce((a, e) => a + e.valor * (e.juros / 100), 0);
    const atrasados = emprestimos.filter((e) => isPast(parseISO(e.data_pagamento))).length;
    return { totalEmprestado, totalJuros, atrasados, totalClientes: emprestimos.length, totalUsuarios: profiles.length };
  }, [emprestimos, profiles]);

  const filteredEmprestimos = emprestimos.filter((e) => {
    const matchBusca = e.nome.toLowerCase().includes(buscaEmprestimo.toLowerCase()) ||
      (e.user_email || "").toLowerCase().includes(buscaEmprestimo.toLowerCase());
    const atrasado = isPast(parseISO(e.data_pagamento));
    const matchStatus = filtroStatus === "todos" || (filtroStatus === "atrasado" && atrasado) || (filtroStatus === "em_dia" && !atrasado);
    return matchBusca && matchStatus;
  });

  const filteredProfiles = profiles.filter((p) => {
    const search = buscaUser.toLowerCase();
    return (p.email || "").toLowerCase().includes(search) || (p.nome || "").toLowerCase().includes(search);
  });

  const clientDetails = useMemo(() => {
    const now = new Date();
    return emprestimos.filter((e) => {
      const matchBusca = e.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
        (e.user_email || "").toLowerCase().includes(buscaCliente.toLowerCase());

      const atrasado = isPast(parseISO(e.data_pagamento));
      const matchStatus = filtroStatusCliente === "todos" ||
        (filtroStatusCliente === "atrasado" && atrasado) ||
        (filtroStatusCliente === "em_dia" && !atrasado);

      const matchValor = filtroValorCliente === "todos" ||
        (filtroValorCliente === "ate_1000" && e.valor <= 1000) ||
        (filtroValorCliente === "1000_5000" && e.valor > 1000 && e.valor <= 5000) ||
        (filtroValorCliente === "acima_5000" && e.valor > 5000);

      const dataEmp = parseISO(e.data_emprestimo);
      const diffMonths = (now.getFullYear() - dataEmp.getFullYear()) * 12 + (now.getMonth() - dataEmp.getMonth());
      const matchData = filtroDataCliente === "todos" ||
        (filtroDataCliente === "ultimo_mes" && diffMonths <= 1) ||
        (filtroDataCliente === "ultimos_3" && diffMonths <= 3) ||
        (filtroDataCliente === "ultimos_6" && diffMonths <= 6);

      return matchBusca && matchStatus && matchValor && matchData;
    });
  }, [emprestimos, buscaCliente, filtroStatusCliente, filtroValorCliente, filtroDataCliente]);

  const groupedClients = useMemo(() => {
    const groups: Record<string, { email: string; userId: string; clients: typeof clientDetails }> = {};
    clientDetails.forEach((c) => {
      const key = c.user_id;
      if (!groups[key]) {
        groups[key] = { email: c.user_email || "Desconhecido", userId: key, clients: [] };
      }
      groups[key].clients.push(c);
    });
    return Object.values(groups).sort((a, b) => a.email.localeCompare(b.email));
  }, [clientDetails]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight">Painel Administrativo</h1>
              <p className="text-xs text-muted-foreground">Gestão completa do sistema</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-5 flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Usuários</p>
                <p className="text-xl font-bold font-mono">{stats.totalUsuarios}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-start gap-3">
              <div className="rounded-xl bg-accent/10 p-2.5"><Landmark className="h-5 w-5 text-accent" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Clientes</p>
                <p className="text-xl font-bold font-mono">{stats.totalClientes}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5"><Banknote className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Emprestado</p>
                <p className="text-xl font-bold font-mono">R$ {stats.totalEmprestado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-start gap-3">
              <div className="rounded-xl bg-warning/10 p-2.5"><Percent className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Juros</p>
                <p className="text-xl font-bold font-mono text-warning">R$ {stats.totalJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-start gap-3">
              <div className="rounded-xl bg-destructive/10 p-2.5"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Em Atraso</p>
                <p className="text-xl font-bold font-mono">{stats.atrasados}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users">
          <TabsList className="w-full sm:w-auto flex">
            <TabsTrigger value="users" className="gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm"><Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Usuários</TabsTrigger>
            <TabsTrigger value="clientes" className="gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm"><UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Clientes</TabsTrigger>
            <TabsTrigger value="emprestimos" className="gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm"><Landmark className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Empréstimos</TabsTrigger>
            <TabsTrigger value="notificacoes" className="gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm"><Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Notificações</TabsTrigger>
            <TabsTrigger value="emails" className="gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm"><MailCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> E-mails</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base font-semibold">Usuários Cadastrados</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nome ou e-mail..." value={buscaUser} onChange={(e) => setBuscaUser(e.target.value)} className="pl-8 h-9 w-full sm:w-[250px]" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {loadingProfiles ? (
                  <p className="text-center text-muted-foreground py-8">Carregando...</p>
                ) : filteredProfiles.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Papel</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProfiles.map((p) => {
                        const isOnline = onlineUsers.has(p.user_id);
                        const roles = userRoles[p.user_id] || [];
                        const isUserAdmin = roles.includes("admin");
                        const isUserMod = roles.includes("moderator");
                        const isUserRestricted = roles.includes("restrito");
                        return (
                          <TableRow key={p.user_id}>
                            <TableCell className="font-medium">{p.nome || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{p.email || "—"}</TableCell>
                            <TableCell>{format(parseISO(p.created_at), "dd/MM/yyyy")}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-block h-2 w-2 rounded-full ${isOnline ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-muted-foreground/30"}`} />
                                <span className="text-xs text-muted-foreground">{isOnline ? "Online" : "Offline"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {isUserAdmin ? (
                                  <Badge className="text-xs bg-primary/20 text-primary border-primary/30">Admin</Badge>
                                ) : isUserMod ? (
                                  <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">Moderador</Badge>
                                ) : isUserRestricted ? (
                                  <Badge className="text-xs bg-destructive/20 text-destructive border-destructive/30">Restrito</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">Usuário</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Select
                                  value={isUserAdmin ? "admin" : isUserMod ? "moderator" : isUserRestricted ? "restrito" : "user"}
                                  onValueChange={(v) => handleChangeRole(p.user_id, v as "admin" | "moderator" | "user" | "restrito")}
                                >
                                  <SelectTrigger className="h-7 w-[130px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">Usuário</SelectItem>
                                    <SelectItem value="moderator">Moderador</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                    <SelectItem value="restrito">Restrito</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditProfile(p)} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-warning hover:text-warning" onClick={() => { setEditingPasswordUser(p); setNewPassword(""); setConfirmPassword(""); }} title="Alterar senha">
                                  <KeyRound className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingUser(p)} title="Excluir">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clientes">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base font-semibold">Clientes Cadastrados</CardTitle>
                   <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar..." value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} className="pl-8 h-9 w-full sm:w-[180px]" />
                    </div>
                    <Select value={filtroStatusCliente} onValueChange={(v) => setFiltroStatusCliente(v as any)}>
                      <SelectTrigger className="h-9 w-full sm:w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="em_dia">Em dia</SelectItem>
                        <SelectItem value="atrasado">Atrasado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filtroValorCliente} onValueChange={(v) => setFiltroValorCliente(v as any)}>
                      <SelectTrigger className="h-9 w-full sm:w-[140px]"><SelectValue placeholder="Valor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos valores</SelectItem>
                        <SelectItem value="ate_1000">Até R$ 1.000</SelectItem>
                        <SelectItem value="1000_5000">R$ 1k - 5k</SelectItem>
                        <SelectItem value="acima_5000">Acima de R$ 5k</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filtroDataCliente} onValueChange={(v) => setFiltroDataCliente(v as any)}>
                      <SelectTrigger className="h-9 w-full sm:w-[140px]"><SelectValue placeholder="Período" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todo período</SelectItem>
                        <SelectItem value="ultimo_mes">Último mês</SelectItem>
                        <SelectItem value="ultimos_3">Últimos 3 meses</SelectItem>
                        <SelectItem value="ultimos_6">Últimos 6 meses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {loadingEmprestimos ? (
                  <p className="text-center text-muted-foreground py-8">Carregando...</p>
                ) : clientDetails.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum cliente encontrado.</p>
                ) : (
                  <>
                    {groupedClients.map((group) => (
                      <div key={group.userId} className="space-y-3">
                        <div className="flex items-center gap-2 pt-3 first:pt-0">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${onlineUsers.has(group.userId) ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-muted-foreground/30"}`} />
                          <h3 className="text-sm font-semibold text-foreground">{group.email}</h3>
                          <Badge variant="outline" className="text-xs">{group.clients.length} cliente(s)</Badge>
                        </div>
                        {/* Mobile cards */}
                        <div className="space-y-2 md:hidden">
                          {group.clients.map((c) => {
                            const atrasado = isPast(parseISO(c.data_pagamento));
                            const valorTotal = c.valor + c.valor * (c.juros / 100);
                            return (
                              <div key={c.id} className="border rounded-lg p-3 space-y-2 ml-4">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm">{c.nome}</span>
                                  <Badge variant={atrasado ? "destructive" : "default"} className="text-xs">
                                    {atrasado ? "Atrasado" : "Em dia"}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                                  <span>Tel: {c.telefone || "—"}</span>
                                  <span>Valor: <span className="font-mono text-foreground">R$ {c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                                  <span>Juros: <span className="font-mono text-foreground">{c.juros}%</span></span>
                                  <span>Total: <span className="font-mono font-semibold text-foreground">R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                                  <span>Emp: {format(parseISO(c.data_emprestimo), "dd/MM/yy")}</span>
                                  <span>Pag: {format(parseISO(c.data_pagamento), "dd/MM/yy")}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Desktop table */}
                        <div className="hidden md:block ml-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Telefone</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Juros</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Empréstimo</TableHead>
                                <TableHead>Pagamento</TableHead>
                                <TableHead>Situação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.clients.map((c) => {
                                const atrasado = isPast(parseISO(c.data_pagamento));
                                const valorTotal = c.valor + c.valor * (c.juros / 100);
                                return (
                                  <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.nome}</TableCell>
                                    <TableCell className="text-muted-foreground">{c.telefone || "—"}</TableCell>
                                    <TableCell className="font-mono">R$ {c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="font-mono">{c.juros}%</TableCell>
                                    <TableCell className="font-mono font-semibold">R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell>{format(parseISO(c.data_emprestimo), "dd/MM/yyyy")}</TableCell>
                                    <TableCell>{format(parseISO(c.data_pagamento), "dd/MM/yyyy")}</TableCell>
                                    <TableCell>
                                      <Badge variant={atrasado ? "destructive" : "default"} className="text-xs">
                                        {atrasado ? "Atrasado" : "Em dia"}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emprestimos">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base font-semibold">Todos os Empréstimos</CardTitle>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar..." value={buscaEmprestimo} onChange={(e) => setBuscaEmprestimo(e.target.value)} className="pl-8 h-9 w-full sm:w-[200px]" />
                    </div>
                    <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
                      <SelectTrigger className="h-9 w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
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
                {loadingEmprestimos ? (
                  <p className="text-center text-muted-foreground py-8">Carregando...</p>
                ) : filteredEmprestimos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum empréstimo encontrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data Pagamento</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmprestimos.map((e) => {
                        const atrasado = isPast(parseISO(e.data_pagamento));
                        const valorTotal = e.valor + e.valor * (e.juros / 100);
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs text-muted-foreground">{e.user_email}</TableCell>
                            <TableCell className="font-medium">{e.nome}</TableCell>
                            <TableCell className="font-mono font-semibold">R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>{format(parseISO(e.data_pagamento), "dd/MM/yyyy")}</TableCell>
                            <TableCell>
                              <Badge variant={atrasado ? "destructive" : "default"} className={`text-xs ${!atrasado ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}>
                                {atrasado ? "Atrasado" : "Em dia"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notificacoes">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Send notification */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Send className="h-4 w-4 text-muted-foreground" /> Enviar Notificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="notif-titulo">Título</Label>
                    <Input id="notif-titulo" placeholder="Título da notificação..." value={notifTitulo} onChange={(e) => setNotifTitulo(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notif-msg">Mensagem</Label>
                      <span className={`text-xs ${notifMensagem.length > 500 ? "text-destructive" : notifMensagem.length > 300 ? "text-warning" : "text-muted-foreground"}`}>
                        {notifMensagem.length}/500
                      </span>
                    </div>
                    <Textarea id="notif-msg" placeholder="Escreva a mensagem para todos os usuários..." rows={4} value={notifMensagem} onChange={(e) => setNotifMensagem(e.target.value)} maxLength={500} />
                    {notifMensagem.trim().length > 10 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        disabled={improvingText}
                        onClick={async () => {
                          setImprovingText(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("improve-text", {
                              body: { text: notifMensagem },
                            });
                            if (error || data?.error) {
                              toast({ title: "Erro ao melhorar texto", description: getSafeErrorMessage(error || data), variant: "destructive" });
                            } else if (data?.improved) {
                              setNotifMensagem(data.improved);
                              toast({ title: "Texto melhorado com IA!" });
                            }
                          } catch (err: any) {
                            toast({ title: "Erro", description: getSafeErrorMessage(err), variant: "destructive" });
                          }
                          setImprovingText(false);
                        }}
                      >
                        {improvingText ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {improvingText ? "Melhorando..." : "Melhorar com IA"}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Destinatário</Label>
                    <Select value={notifDestino} onValueChange={setNotifDestino}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar destinatário" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os usuários</SelectItem>
                        {profiles.map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>
                            {p.email || p.nome || p.user_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Método de Entrega</Label>
                    <Select value={notifMetodo} onValueChange={(v) => setNotifMetodo(v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="site">
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4" /> Notificação no site
                          </div>
                        </SelectItem>
                        <SelectItem value="email">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" /> E-mail
                          </div>
                        </SelectItem>
                        <SelectItem value="ambos">
                          <div className="flex items-center gap-2">
                            <Send className="h-4 w-4" /> Ambos (site + e-mail)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <AlertDialog open={notifConfirmOpen} onOpenChange={setNotifConfirmOpen}>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full gap-2" disabled={!notifTitulo.trim() || !notifMensagem.trim()}>
                        {notifMetodo === "email" ? <Mail className="h-4 w-4" /> : notifMetodo === "ambos" ? <Send className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                        {notifDestino === "todos" ? "Enviar para todos os usuários" : "Enviar para usuário selecionado"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar envio?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A notificação "<strong>{notifTitulo}</strong>" será enviada {notifMetodo === "site" ? "no site" : notifMetodo === "email" ? "por e-mail" : "no site e por e-mail"} para {notifDestino === "todos" ? `todos os ${profiles.length} usuários cadastrados` : (profiles.find(p => p.user_id === notifDestino)?.email || "o usuário selecionado")}. Deseja continuar?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={sendingNotif}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSendNotification} disabled={sendingNotif}>
                          {sendingNotif ? "Enviando..." : "Confirmar Envio"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>

              {/* Notification history */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" /> Histórico de Notificações
                    </CardTitle>
                    {notifHistory.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="gap-1.5 text-xs">
                            <Trash2 className="h-3.5 w-3.5" /> Limpar tudo
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Limpar todas as notificações?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso removerá permanentemente todas as {notifHistory.length} notificações do sistema. Esta ação é irreversível.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={clearingNotifs}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearAllNotifications} disabled={clearingNotifs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              {clearingNotifs ? "Limpando..." : "Limpar tudo"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {notifHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação enviada.</p>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-auto">
                      {notifHistory.map((n) => (
                        <div key={n.id} className="border rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{n.titulo}</span>
                            <span className="text-xs text-muted-foreground">{format(parseISO(n.created_at), "dd/MM/yyyy HH:mm")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{n.mensagem}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="emails">
            <EmailDashboard />
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Altere as informações do perfil do usuário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input id="edit-nome" value={editNome} onChange={(e) => setEditNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>Cancelar</Button>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{deletingUser?.email || deletingUser?.nome}</strong>? 
              Esta ação é irreversível e removerá todos os dados associados (perfil, empréstimos e roles).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Password Dialog */}
      <Dialog open={!!editingPasswordUser} onOpenChange={(open) => { if (!open) { setEditingPasswordUser(null); setNewPassword(""); setConfirmPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-warning" /> Alterar Senha
            </DialogTitle>
            <DialogDescription>
              Alterando senha de: <strong>{editingPasswordUser?.email || editingPasswordUser?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
              />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">As senhas não coincidem.</p>
            )}
            {newPassword && newPassword.length < 6 && (
              <p className="text-xs text-destructive">A senha deve ter pelo menos 6 caracteres.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingPasswordUser(null); setNewPassword(""); setConfirmPassword(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSavePassword}
              disabled={savingPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {savingPassword ? "Salvando..." : "Salvar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
