import { useState, useEffect, useMemo } from "react";
import { Bell, BellOff, CheckCheck, Loader2, Moon, Sun, Settings, Shield, Lock, Target, Activity, Users, Mail, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

const tabs = [
  { id: "geral", label: "GERAL" },
  { id: "notificacoes", label: "NOTIFICAÃÃES" },
  { id: "seguranca", label: "SEGURANÃA" },
  { id: "privacidade", label: "PRIVACIDADE" },
];

interface Notification {
  id: string;
  titulo: string;
  mensagem: string;
  created_at: string;
  lida: boolean;
}

interface NotifPrefs {
  enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  meta_50: boolean;
  meta_75: boolean;
  meta_100: boolean;
  meta_superada: boolean;
  alta_atividade: boolean;
  novos_clientes: boolean;
  relatorio_email: boolean;
  relatorio_frequencia: string;
  meta_mensal: number;
}

const defaultPrefs: NotifPrefs = {
  enabled: true,
  email_enabled: true,
  push_enabled: true,
  meta_50: true,
  meta_75: true,
  meta_100: true,
  meta_superada: true,
  alta_atividade: true,
  novos_clientes: true,
  relatorio_email: true,
  relatorio_frequencia: "semanal",
  meta_mensal: 10000,
};

const ToggleRow = ({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between rounded-lg border p-4">
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

const Configuracoes = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("geral");

  // Theme
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return true;
    }
    return true;
  });

  const toggleTheme = (value: boolean) => {
    setDark(value);
    document.documentElement.classList.toggle("dark", value);
    localStorage.setItem("theme", value ? "dark" : "light");
  };

  // Notification preferences
  const [prefs, setPrefs] = useState<NotifPrefs>(defaultPrefs);
  const [loadingPref, setLoadingPref] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  // Fetch current month revenue for progress bar
  const [currentRevenue, setCurrentRevenue] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchPref = async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          enabled: data.enabled ?? true,
          email_enabled: data.email_enabled ?? true,
          push_enabled: data.push_enabled ?? true,
          meta_50: data.meta_50 ?? true,
          meta_75: data.meta_75 ?? true,
          meta_100: data.meta_100 ?? true,
          meta_superada: data.meta_superada ?? true,
          alta_atividade: data.alta_atividade ?? true,
          novos_clientes: data.novos_clientes ?? true,
          relatorio_email: data.relatorio_email ?? true,
          relatorio_frequencia: data.relatorio_frequencia ?? "semanal",
          meta_mensal: Number(data.meta_mensal) || 10000,
        });
      }
      setLoadingPref(false);
    };

    const fetchRevenue = async () => {
      const now = new Date();
      const firstDay = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
      const lastDay = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");

      const { data } = await supabase
        .from("financeiro")
        .select("valor")
        .eq("user_id", user.id)
        .eq("tipo", "receita")
        .gte("data_vencimento", firstDay)
        .lte("data_vencimento", lastDay);

      const total = (data || []).reduce((a: number, r: any) => a + Number(r.valor), 0);
      setCurrentRevenue(total);
    };

    fetchPref();
    fetchRevenue();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      const { data: allNotifs } = await supabase
        .from("notifications")
        .select("*")
        .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      const { data: readStatus } = await supabase
        .from("user_notifications")
        .select("notification_id, lida")
        .eq("user_id", user.id);

      const readMap = new Map((readStatus || []).map((r: any) => [r.notification_id, r.lida]));
      setNotifications(
        (allNotifs || []).map((n: any) => ({ ...n, lida: readMap.get(n.id) || false }))
      );
      setLoadingNotifs(false);
    };
    fetchNotifs();
  }, [user]);

  const savePref = async (updates: Partial<NotifPrefs>) => {
    if (!user) return;
    const newPrefs = { ...prefs, ...updates };
    setPrefs(newPrefs);

    const { error } = await supabase
      .from("notification_preferences")
      .upsert({
        user_id: user.id,
        ...newPrefs,
      }, { onConflict: "user_id" });

    if (error) {
      toast.error("Erro ao salvar preferÃªncia");
      setPrefs(prefs); // revert
    }
  };

  const markAsRead = async (notifId: string) => {
    if (!user) return;
    await supabase
      .from("user_notifications")
      .upsert({ user_id: user.id, notification_id: notifId, lida: true }, { onConflict: "user_id,notification_id" });
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, lida: true } : n)));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unread = notifications.filter((n) => !n.lida);
    if (unread.length === 0) return;
    await supabase
      .from("user_notifications")
      .upsert(
        unread.map((n) => ({ user_id: user.id, notification_id: n.id, lida: true })),
        { onConflict: "user_id,notification_id" }
      );
    setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
    toast.success("Todas marcadas como lidas");
  };

  const unreadCount = notifications.filter((n) => !n.lida).length;

  const metaProgress = useMemo(() => {
    if (prefs.meta_mensal <= 0) return 0;
    return Math.min((currentRevenue / prefs.meta_mensal) * 100, 100);
  }, [currentRevenue, prefs.meta_mensal]);

  return (
    <main className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Badge variant="outline" className="mb-3 text-xs border-primary text-primary">
          CONFIGURAÃÃES
        </Badge>
        <h1 className="text-2xl font-bold">ConfiguraÃ§Ãµes</h1>
        <p className="text-sm text-muted-foreground mt-1">Personalize suas preferÃªncias</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* GERAL */}
      {activeTab === "geral" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Settings className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">AparÃªncia</h2>
              </div>
              <p className="text-xs text-muted-foreground">Ajuste o tema visual do aplicativo</p>
            </div>
            <Separator />
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/15 p-2.5">
                  {dark ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
                </div>
                <div>
                  <Label className="text-sm font-semibold">Modo Escuro</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dark ? "O tema escuro estÃ¡ ativo" : "O tema claro estÃ¡ ativo"}
                  </p>
                </div>
              </div>
              <Switch checked={dark} onCheckedChange={toggleTheme} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* NOTIFICAÃÃES */}
      {activeTab === "notificacoes" && (
        <div className="space-y-6">
          {loadingPref ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* GERAIS */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Gerais</p>
                <ToggleRow
                  label="NotificaÃ§Ãµes de Email"
                  description="Receba atualizaÃ§Ãµes por email"
                  checked={prefs.email_enabled}
                  onCheckedChange={(v) => savePref({ email_enabled: v })}
                />
                <ToggleRow
                  label="NotificaÃ§Ãµes Push"
                  description="NotificaÃ§Ãµes em tempo real no navegador"
                  checked={prefs.push_enabled}
                  onCheckedChange={(v) => savePref({ push_enabled: v })}
                />
              </div>

              {/* METAS MENSAIS */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Metas Mensais</p>

                {/* Progress */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">Progresso Atual</p>
                    </div>
                    <p className="text-sm font-mono text-muted-foreground">
                      R$ {currentRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R$ {prefs.meta_mensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Progress value={metaProgress} className="h-2.5" />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{Math.round(metaProgress)}% da meta</span>
                    <span>Meta Mensal</span>
                  </div>
                </div>

                <ToggleRow
                  label="50% da Meta Atingida"
                  description="NotificaÃ§Ã£o quando atingir 50% da meta mensal"
                  checked={prefs.meta_50}
                  onCheckedChange={(v) => savePref({ meta_50: v })}
                />
                <ToggleRow
                  label="75% da Meta Atingida"
                  description="NotificaÃ§Ã£o quando atingir 75% da meta mensal"
                  checked={prefs.meta_75}
                  onCheckedChange={(v) => savePref({ meta_75: v })}
                />
                <ToggleRow
                  label="100% da Meta Atingida"
                  description="NotificaÃ§Ã£o quando atingir 100% da meta mensal"
                  checked={prefs.meta_100}
                  onCheckedChange={(v) => savePref({ meta_100: v })}
                />
                <ToggleRow
                  label="Meta Superada"
                  description="NotificaÃ§Ã£o quando superar a meta mensal"
                  checked={prefs.meta_superada}
                  onCheckedChange={(v) => savePref({ meta_superada: v })}
                />
              </div>

              {/* ATIVIDADE */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Atividade</p>
                <ToggleRow
                  label="Alta Atividade"
                  description="NotificaÃ§Ã£o quando detectar alta atividade de transaÃ§Ãµes"
                  checked={prefs.alta_atividade}
                  onCheckedChange={(v) => savePref({ alta_atividade: v })}
                />
                <ToggleRow
                  label="Novos Clientes"
                  description="Alerta quando um novo cliente Ã© cadastrado"
                  checked={prefs.novos_clientes}
                  onCheckedChange={(v) => savePref({ novos_clientes: v })}
                />
              </div>

              {/* RELATÃRIOS */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">RelatÃ³rios</p>
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">RelatÃ³rios por Email</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Resumo de desempenho enviado por email</p>
                    </div>
                    <Switch
                      checked={prefs.relatorio_email}
                      onCheckedChange={(v) => savePref({ relatorio_email: v })}
                    />
                  </div>
                  {prefs.relatorio_email && (
                    <>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => savePref({ relatorio_frequencia: "semanal" })}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                            prefs.relatorio_frequencia === "semanal"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          Semanal
                        </button>
                        <button
                          onClick={() => savePref({ relatorio_frequencia: "mensal" })}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                            prefs.relatorio_frequencia === "mensal"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          Mensal
                        </button>
                        <span className="text-xs text-muted-foreground ml-2">
                          Toda segunda-feira Ã s 8h
                        </span>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <Send className="h-3.5 w-3.5" />
                        Enviar {prefs.relatorio_frequencia} agora
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* HISTÃRICO */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">HistÃ³rico</p>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 gap-1.5" onClick={markAllAsRead}>
                      <CheckCheck className="h-3.5 w-3.5" />
                      Marcar tudo como lido
                    </Button>
                  )}
                </div>
                {loadingNotifs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground rounded-lg border">
                    <Bell className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">Nenhuma notificaÃ§Ã£o ainda.</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="divide-y rounded-lg border overflow-hidden">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          className={`w-full text-left px-5 py-4 hover:bg-accent/50 transition-colors ${!n.lida ? "bg-accent/20" : ""}`}
                          onClick={() => markAsRead(n.id)}
                        >
                          <div className="flex items-start gap-2.5">
                            {!n.lida && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                            <div className={!n.lida ? "" : "ml-[18px]"}>
                              <p className="text-sm font-semibold">{n.titulo}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.mensagem}</p>
                              <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                                {format(parseISO(n.created_at), "dd/MM/yyyy 'Ã s' HH:mm")}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* SEGURANÃA */}
      {activeTab === "seguranca" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">SeguranÃ§a</h2>
              </div>
              <p className="text-xs text-muted-foreground">Gerencie a seguranÃ§a da sua conta</p>
            </div>
            <Separator />
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/15 p-2.5">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Email</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{user?.email || "â"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PRIVACIDADE */}
      {activeTab === "privacidade" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Lock className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Privacidade</h2>
              </div>
              <p className="text-xs text-muted-foreground">Controle suas configuraÃ§Ãµes de privacidade</p>
            </div>
            <Separator />
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              Suas informaÃ§Ãµes sÃ£o protegidas e nÃ£o sÃ£o compartilhadas com terceiros.
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
};

export default Configuracoes;
