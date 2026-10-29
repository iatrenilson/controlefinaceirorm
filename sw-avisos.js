// Avisos de vencimento da Carteira CAC no celular (notificação push), enviados todo dia pelo GitHub
// (.github/workflows/avisos-vencimento.yml). Este service worker só mostra a notificação e abre a página ao tocar:
// não guarda nem intercepta páginas (sem "fetch"), então o site continua sempre na versão nova.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corpo: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Passarinho Assessoria", {
    body: d.corpo || "",
    icon: "/carteira-icon5.png",
    badge: "/carteira-icon5.png",
    tag: d.tag || "vencimento",
    renotify: true,
    data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abertas) if (c.url === url && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  })());
});
