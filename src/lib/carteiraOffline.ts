// Carteira do cliente sem internet. Cada vez que ela abre com internet, o aparelho guarda uma cópia: os dados (no
// localStorage) e, no Cache do navegador, a página, os arquivos do site que ela usa, os documentos do cliente e o leitor
// de PDF. Sem internet, a página vem do service worker (public/sw-avisos.js) e os documentos saem dessa cópia.
import { PDFJS, PDFJS_WORKER, PDFLIB, BRASAO, carregarPDFJS } from "@/lib/crColorido";

// mesmo nome no public/sw-avisos.js
export const CACHE_CARTEIRA = "carteira-offline-v1";
// a página guardada (index.html do site), entregue pelo service worker para qualquer /carteira/... sem internet
export const CHAVE_PAGINA = "/__carteira_pagina";

const chaveDados = (id: string) => `carteira_offline_${id}`;

export function lerCopia<T>(id: string): { salvoEm: number; data: T } | null {
  try {
    const c = JSON.parse(localStorage.getItem(chaveDados(id)) || "null");
    return c?.data ? c : null;
  } catch { return null; }
}

export function registrarServiceWorker() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw-avisos.js", { scope: "/" }).catch(() => {});
}

// Guarda a cópia. Documento e arquivo do site já guardados não são baixados de novo (o caminho muda quando o arquivo
// muda); os documentos que saíram da carteira são apagados da cópia
export async function guardarCopia(id: string, data: unknown, urlsDocs: string[]) {
  try { localStorage.setItem(chaveDados(id), JSON.stringify({ salvoEm: Date.now(), data })); } catch { /* sem espaço */ }
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(CACHE_CARTEIRA);
    const pagina = await fetch(`${location.origin}/index.html`, { cache: "no-store" });
    if (pagina.ok) await cache.put(CHAVE_PAGINA, pagina);

    const doSite = performance.getEntriesByType("resource").map(e => e.name)
      .filter(u => u.startsWith(location.origin) && /\/assets\/|\.(png|svg|ico)$/.test(new URL(u).pathname));
    const extras = [new URL(BRASAO, location.origin).href, `${location.origin}/logo-passarinho.png`, PDFJS, PDFJS_WORKER, PDFLIB];
    for (const url of [...new Set([...doSite, ...extras, ...urlsDocs])]) {
      if (await cache.match(url)) continue;
      try {
        const r = await fetch(url, { mode: "cors" });
        if (r.ok) await cache.put(url, r);
      } catch { /* fica para a próxima vez */ }
    }

    const marca = "/storage/v1/object/public/carteira-docs/";
    const atuais = new Set(urlsDocs);
    for (const req of await cache.keys()) {
      if (req.url.includes(marca) && req.url.includes(`/${id}/`) && !atuais.has(req.url)) await cache.delete(req);
    }
  } catch { /* armazenamento indisponível: só não fica a cópia */ }
}

// Endereços dos documentos guardados, para abrir sem internet (blob: da cópia; o que não estiver guardado fica de fora)
export async function urlsDaCopia(urls: string[]): Promise<Record<string, string>> {
  const mapa: Record<string, string> = {};
  if (!("caches" in window)) return mapa;
  const cache = await caches.open(CACHE_CARTEIRA).catch(() => null);
  if (!cache) return mapa;
  for (const url of urls) {
    const r = await cache.match(url).catch(() => undefined);
    if (r) mapa[url] = URL.createObjectURL(await r.blob());
  }
  return mapa;
}

// PDF sem internet: o leitor do Google não abre, então as páginas são desenhadas aqui (pdf.js da cópia)
export async function paginasDoPdf(url: string): Promise<string[]> {
  const lib = await carregarPDFJS();
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const pdf = await lib.getDocument({ data: bytes }).promise;
  const paginas: string[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const pagina = await pdf.getPage(i);
      const vp = pagina.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = vp.width; canvas.height = vp.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvasContext: ctx, viewport: vp }).promise;
      paginas.push(canvas.toDataURL("image/jpeg", 0.9));
    }
  } finally { await pdf.destroy(); }
  return paginas;
}
