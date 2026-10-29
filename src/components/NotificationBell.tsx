import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/hooks/useAppContext";
import { format, parseISO } from "date-fns";
import { ROTULO_TIPO_CARTEIRA, situacaoDoc, ultimaData, textoPrazo, ordemAvisos } from "@/lib/avisosCarteira";
import { pushSuportado, inscricaoAtual, ativarPush, desativarPush, ehIOS, abertoComoApp } from "@/lib/avisosPush";

interface Notification {
  id: string;
  titulo: string;
  mensagem: string;
  created_at: string;
  lida: boolean;
}

// Documentos da Carteira CAC (o link externo do cliente) vencidos ou perto de vencer, calculados na hora a partir das
// datas (regra e prazos em lib/avisosCarteira, os mesmos do sininho do link externo). Somem sozinhos quando o documento
// é renovado. "Visto" fica guardado neste navegador (documento + validade + situação: o aviso "vence em breve" já visto
// avisa de novo quando o documento vence).
interface AvisoDoc { chave: string; cliente: string; tipo: string; validade: string; dias: number; vencido: boolean; }
const VISTOS_KEY = "carteira_vencidos_vistos";
const lerVistos = (): string[] => {
  try { return JSON.parse(localStorage.getItem(VISTOS_KEY) || "[]"); } catch { return []; }
};

const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [avisos, setAvisos] = useState<AvisoDoc[]>([]);
  const [vistos, setVistos] = useState<string[]>(lerVistos);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // Usuário já conhecido pelo app: sem getUser() (ida ao servidor que segurava as outras buscas da página)
  const { user, isAdmin } = useAppContext();

  // Admin: avisos de vencimento no celular (notificação push todo dia às 9h, 13h e 18h com a lista dos documentos vencidos;
  // lib/avisosPush). "sem": navegador sem suporte (no iPhone, só o site adicionado à Tela de Início recebe)
  const [pushAdmin, setPushAdmin] = useState<"carregando" | "ativo" | "inativo" | "bloqueado" | "sem" | "erro">("carregando");
  useEffect(() => {
    if (!isAdmin) return;
    if (!pushSuportado()) { setPushAdmin("sem"); return; }
    if (Notification.permission === "denied") { setPushAdmin("bloqueado"); return; }
    inscricaoAtual().then(sub => setPushAdmin(sub ? "ativo" : "inativo")).catch(() => setPushAdmin("inativo"));
  }, [isAdmin]);
  const ativarAvisosCelular = async () => {
    setPushAdmin("carregando");
    try {
      const sub = await ativarPush();
      const { error } = await (supabase as any).rpc("salvar_push_admin", { p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth });
      if (error) throw error;
      setPushAdmin("ativo");
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "";
      setPushAdmin(motivo === "bloqueado" ? "bloqueado" : motivo === "sem permissao" ? "inativo" : "erro");
    }
  };
  const desativarAvisosCelular = async () => {
    const endpoint = await desativarPush();
    if (endpoint) await (supabase as any).rpc("remover_push", { p_endpoint: endpoint });
    setPushAdmin("inativo");
  };

  // Só lê as datas (o que o usuário pode ver na Carteira Digital); nada é gravado no banco
  const fetchAvisos = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("carteira_docs" as any)
      .select("id, tipo, data_validade, carteira_clientes(nome)")
      .neq("data_validade", "");
    const lista: AvisoDoc[] = [];
    for (const d of (data ?? []) as any[]) {
      const sit = situacaoDoc(d.tipo, d.data_validade || "");
      if (!sit) continue;
      lista.push({
        // vencido mantém a chave de antes (documento + validade); o "vence em breve" ganha "|a"
        chave: `${d.id}|${d.data_validade}` + (sit.vencido ? "" : "|a"),
        cliente: d.carteira_clientes?.nome || "Cliente",
        tipo: ROTULO_TIPO_CARTEIRA[d.tipo] ?? String(d.tipo).toUpperCase(),
        validade: ultimaData(d.data_validade),
        ...sit,
      });
    }
    lista.sort(ordemAvisos);
    setAvisos(lista);
  };

  const guardarVistos = (chaves: string[]) => {
    // só guarda os que ainda estão na lista (renovado ou apagado sai)
    const novos = [...new Set(chaves)].filter(k => avisos.some(v => v.chave === k));
    setVistos(novos);
    try { localStorage.setItem(VISTOS_KEY, JSON.stringify(novos)); } catch { /* sem storage */ }
  };
  const abrirAviso = (v: AvisoDoc) => {
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
    fetchAvisos();

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

    guardarVistos([...vistos, ...avisos.map(v => v.chave)]);
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

  const unreadCount = notifications.filter((n) => !n.lida).length + avisos.filter(v => !vistos.includes(v.chave)).length;

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (o) fetchAvisos(); }}>
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
          {[
            { lista: avisos.filter(a => a.vencido), titulo: "Carteira CAC — documentos vencidos", cor: "text-destructive", fundo: "bg-destructive/10", ponto: "bg-destructive" },
            { lista: avisos.filter(a => !a.vencido), titulo: "Carteira CAC — vencem em breve", cor: "text-amber-500", fundo: "bg-amber-500/10", ponto: "bg-amber-500" },
          ].filter(sec => sec.lista.length > 0).map(sec => (
            <div key={sec.titulo} className="border-b">
              <p className={`px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider ${sec.cor}`}>{sec.titulo}</p>
              {sec.lista.map((v) => {
                const visto = vistos.includes(v.chave);
                return (
                  <button
                    key={v.chave}
                    className={`w-full text-left px-4 py-2.5 hover:bg-accent/50 transition-colors ${!visto ? sec.fundo : ""}`}
                    onClick={() => abrirAviso(v)}
                  >
                    <div className="flex items-start gap-2">
                      {!visto && <span className={`mt-1.5 h-2 w-2 rounded-full ${sec.ponto} shrink-0`} />}
                      <div className={!visto ? "" : "ml-[16px]"}>
                        <p className="text-sm font-semibold">{v.tipo} {v.vencido ? "vencido" : "vence em breve"} — {v.cliente}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {textoPrazo(v.validade, v.dias, v.vencido)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
          {notifications.length === 0 ? (
            avisos.length === 0 && (
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
        {isAdmin && pushAdmin !== "carregando" && (
          <div className="border-t px-4 py-2.5 text-xs shrink-0">
            {pushAdmin === "ativo" ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-emerald-500 font-medium">🔔 Avisos no celular ativados (às 9h, 13h e 18h)</span>
                <button className="text-muted-foreground underline shrink-0" onClick={desativarAvisosCelular}>desativar</button>
              </div>
            ) : pushAdmin === "sem" ? (
              <span className="text-muted-foreground">
                {ehIOS() && !abertoComoApp()
                  ? "Avisos no iPhone: adicione o site à Tela de Início (Compartilhar → Adicionar à Tela de Início) e ative por lá."
                  : "Este navegador não recebe notificações."}
              </span>
            ) : pushAdmin === "bloqueado" ? (
              <span className="text-muted-foreground">🔕 Notificações bloqueadas para este site nas configurações do celular ou do navegador.</span>
            ) : (
              <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={ativarAvisosCelular}>
                🔔 {pushAdmin === "erro" ? "Não deu certo — tentar de novo" : "Receber avisos de vencimento no celular"}
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
