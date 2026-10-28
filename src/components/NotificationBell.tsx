import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/hooks/useAppContext";
import { format, parseISO } from "date-fns";

interface Notification {
  id: string;
  titulo: string;
  mensagem: string;
  created_at: string;
  lida: boolean;
}

// Documentos da Carteira CAC (o link externo do cliente) com a validade vencida. O aviso é calculado na hora a partir
// das datas, com a regra da página do cliente (última data dd/mm/aaaa do campo; vencido a partir do dia seguinte), e
// some sozinho quando o documento é renovado. "Visto" fica guardado neste navegador (chave: documento + validade).
interface DocVencido { chave: string; cliente: string; tipo: string; validade: string; dias: number; }
const ROTULO_TIPO: Record<string, string> = { cr: "CR", craf: "CRAF da Arma", gt: "GT", cert: "Certificado" };
const VISTOS_KEY = "carteira_vencidos_vistos";
const lerVistos = (): string[] => {
  try { return JSON.parse(localStorage.getItem(VISTOS_KEY) || "[]"); } catch { return []; }
};
const ultimaData = (validade: string) => (validade.match(/\d{2}\/\d{2}\/\d{4}/g) ?? []).pop() ?? "";
// dias até a validade (negativo = vencido); null sem data
function diasParaVencer(validade: string): number | null {
  const ultima = ultimaData(validade);
  if (!ultima) return null;
  const [d, m, a] = ultima.split("/").map(Number);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(a, m - 1, d).getTime() - hoje.getTime()) / 86400000);
}

const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [vencidos, setVencidos] = useState<DocVencido[]>([]);
  const [vistos, setVistos] = useState<string[]>(lerVistos);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // Usuário já conhecido pelo app: sem getUser() (ida ao servidor que segurava as outras buscas da página)
  const { user } = useAppContext();

  // Só lê as datas (o que o usuário pode ver na Carteira Digital); nada é gravado no banco
  const fetchVencidos = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("carteira_docs" as any)
      .select("id, tipo, data_validade, carteira_clientes(nome)")
      .neq("data_validade", "");
    const lista: DocVencido[] = [];
    for (const d of (data ?? []) as any[]) {
      const dias = diasParaVencer(d.data_validade || "");
      if (dias === null || dias >= 0) continue;
      lista.push({
        chave: `${d.id}|${d.data_validade}`,
        cliente: d.carteira_clientes?.nome || "Cliente",
        tipo: ROTULO_TIPO[d.tipo] ?? String(d.tipo).toUpperCase(),
        validade: ultimaData(d.data_validade),
        dias,
      });
    }
    lista.sort((a, b) => b.dias - a.dias); // o que venceu mais recentemente primeiro
    setVencidos(lista);
  };

  const guardarVistos = (chaves: string[]) => {
    // só guarda os que ainda estão vencidos (renovado ou apagado sai da lista)
    const novos = [...new Set(chaves)].filter(k => vencidos.some(v => v.chave === k));
    setVistos(novos);
    try { localStorage.setItem(VISTOS_KEY, JSON.stringify(novos)); } catch { /* sem storage */ }
  };
  const abrirVencido = (v: DocVencido) => {
    guardarVistos([...vistos, v.chave]);
    setOpen(false);
    navigate("/carteira-digital");
  };

  const fetchNotifications = async () => {
    if (!user) return;

    const [{ data: allNotifs }, { data: readStatus }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("user_notifications")
        .select("notification_id, lida")
        .eq("user_id", user.id),
    ]);

    const readMap = new Map((readStatus || []).map((r: any) => [r.notification_id, r.lida]));

    setNotifications(
      (allNotifs || []).map((n: any) => ({
        ...n,
        lida: readMap.get(n.id) || false,
      }))
    );
  };

  useEffect(() => {
    fetchNotifications();
    fetchVencidos();

    const channel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const markAsRead = async (notifId: string) => {
    if (!user) return;

    await supabase
      .from("user_notifications")
      .upsert({ user_id: user.id, notification_id: notifId, lida: true }, { onConflict: "user_id,notification_id" });

    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, lida: true } : n))
    );
  };

  const markAllAsRead = async () => {
    if (!user) return;

    guardarVistos([...vistos, ...vencidos.map(v => v.chave)]);
    const unread = notifications.filter((n) => !n.lida);
    if (unread.length === 0) return;

    const inserts = unread.map((n) => ({
      user_id: user.id,
      notification_id: n.id,
      lida: true,
    }));

    await supabase
      .from("user_notifications")
      .upsert(inserts, { onConflict: "user_id,notification_id" });

    setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  const unreadCount = notifications.filter((n) => !n.lida).length + vencidos.filter(v => !vistos.includes(v.chave)).length;

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (o) fetchVencidos(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0 flex flex-col max-h-[70vh]">
        <div className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Notificações</h4>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1.5" onClick={markAllAsRead}>
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar tudo como lido
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-auto">
          {vencidos.length > 0 && (
            <div className="border-b">
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-destructive">
                Carteira CAC — documentos vencidos
              </p>
              {vencidos.map((v) => {
                const visto = vistos.includes(v.chave);
                const dias = Math.abs(v.dias);
                return (
                  <button
                    key={v.chave}
                    className={`w-full text-left px-4 py-2.5 hover:bg-accent/50 transition-colors ${!visto ? "bg-destructive/10" : ""}`}
                    onClick={() => abrirVencido(v)}
                  >
                    <div className="flex items-start gap-2">
                      {!visto && <span className="mt-1.5 h-2 w-2 rounded-full bg-destructive shrink-0" />}
                      <div className={!visto ? "" : "ml-[16px]"}>
                        <p className="text-sm font-semibold">{v.tipo} vencido — {v.cliente}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Venceu em {v.validade} (há {dias} {dias === 1 ? "dia" : "dias"})
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {notifications.length === 0 ? (
            vencidos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma notificação.</p>
              </div>
            )
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${!n.lida ? "bg-accent/20" : ""}`}
                  onClick={() => markAsRead(n.id)}
                >
                  <div className="flex items-start gap-2">
                    {!n.lida && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                    <div className={!n.lida ? "" : "ml-[16px]"}>
                      <p className="text-sm font-semibold">{n.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.mensagem}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {format(parseISO(n.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
