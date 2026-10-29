// Avisos de vencimento no celular (notificação push): ativar e desativar neste aparelho. O envio é diário, às 9h de
// Manaus, pelo GitHub (.github/workflows/avisos-vencimento.yml), enquanto houver documento vencido; quem ativou fica
// na tabela push_inscricoes (salva pelas funções salvar_push_carteira / salvar_push_admin).
// Chave pública do par VAPID (a secreta fica só no GitHub, no segredo VAPID_PRIVATE_KEY).
export const VAPID_PUBLICA = "BF1ME-nzhytUwCwzTP4kuzugmd0CNfZJ46rWHBYICzg3EH8Id_8DhzXyyo3MLbQtmOEWfr-BeLqq72ixUxyX4Bo";

export const pushSuportado = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// iPhone só recebe notificação da carteira instalada na Tela de Início (regra da Apple)
export const ehIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const abertoComoApp = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;

function chaveEmBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export async function inscricaoAtual(): Promise<PushSubscription | null> {
  if (!pushSuportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

// Pede a permissão e inscreve o aparelho; devolve endpoint e chaves para salvar no banco
export async function ativarPush(): Promise<{ endpoint: string; p256dh: string; auth: string }> {
  if (!pushSuportado()) throw new Error("sem suporte");
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") throw new Error(permissao === "denied" ? "bloqueado" : "sem permissao");
  const reg = await navigator.serviceWorker.register("/sw-avisos.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(VAPID_PUBLICA) });
  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error("inscricao incompleta");
  return { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth };
}

// Cancela a inscrição neste aparelho; devolve o endpoint para tirar do banco
export async function desativarPush(): Promise<string | null> {
  const sub = await inscricaoAtual();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  return endpoint;
}
