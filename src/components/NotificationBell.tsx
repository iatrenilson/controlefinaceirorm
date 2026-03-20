import { useState, useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";

interface Notification {
  id: string;
  titulo: string;
  mensagem: string;
  created_at: string;
  lida: boolean;
}

const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: allNotifs } = await supabase
      .from("notifications")
      .select("*")
      .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: readStatus } = await supabase
      .from("user_notifications")
      .select("notification_id, lida")
      .eq("user_id", user.id);

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

    const channel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const markAsRead = async (notifId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("user_notifications")
      .upsert({ user_id: user.id, notification_id: notifId, lida: true }, { onConflict: "user_id,notification_id" });

    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, lida: true } : n))
    );
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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

  const unreadCount = notifications.filter((n) => !n.lida).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma notificação.</p>
            </div>
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
