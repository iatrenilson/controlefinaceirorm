// Service worker do site (registrado pela Carteira do cliente e pelos avisos no celular):
// 1) avisos de vencimento da Carteira CAC (notificação push), enviados todo dia pelo GitHub (.github/workflows/avisos-vencimento.yml);
// 2) Carteira sem internet: com internet tudo vem da rede, como sempre (o site continua na versão nova); só quando a
//    rede falha ele entrega a cópia guardada pela própria Carteira (src/lib/carteiraOffline.ts)
const CACHE_CARTEIRA = "carteira-offline-v1";
const CHAVE_PAGINA = "/__carteira_pagina";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    if (!url.pathname.startsWith("/carteira/")) return;
    e.respondWith(fetch(req).catch(async () =>
      (await caches.match(CHAVE_PAGINA, { cacheName: CACHE_CARTEIRA })) || Response.error()));
    return;
  }
  if (!/\/assets\/|\.(png|svg|ico)$/.test(url.pathname)) return;
  e.respondWith(fetch(req).catch(async () =>
    (await caches.match(req, { cacheName: CACHE_CARTEIRA, ignoreSearch: true })) || Response.error()));
});

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
