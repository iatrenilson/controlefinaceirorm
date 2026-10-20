// Colore o PDF do CR / CRAF do SisGCorp na mesma página e layout do original.
// Só muda cores: borda decorativa, marca d'água (brasão colorido), brasão no canto (CR) e moldura de cada cartão.
// O texto continua sendo o do PDF original.

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const PDFLIB = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
const BRASAO = `${import.meta.env.BASE_URL}brasao-colorido.png`;

type RGB = [number, number, number];
const AZUL: RGB = [0, 39, 118], AMARELO: RGB = [255, 212, 0], VERDE: RGB = [0, 156, 59], AZUL_BORDA: RGB = [36, 90, 170];

export type ModeloDoc = "cr" | "craf";
const ESTILO: Record<ModeloDoc, { borda: RGB; moldura: [RGB, RGB, RGB]; brasaoNoCanto: boolean }> = {
  cr: { borda: VERDE, moldura: [AZUL, AMARELO, VERDE], brasaoNoCanto: true },
  craf: { borda: AZUL_BORDA, moldura: [AMARELO, VERDE, AZUL], brasaoNoCanto: false },
};

type Matriz = number[];
interface Ret { x0: number; y0: number; x1: number; y1: number }
interface Cartao extends Ret { tiras: Ret[] }

const scripts: Record<string, Promise<any>> = {};
function carregarScript(src: string, global: string): Promise<any> {
  const w = window as any;
  if (w[global]) return Promise.resolve(w[global]);
  scripts[src] ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => (w[global] ? resolve(w[global]) : reject(new Error(`${global} não carregou`)));
    s.onerror = () => { delete scripts[src]; reject(new Error(`${global} não carregou`)); };
    document.head.appendChild(s);
  });
  return scripts[src];
}
const carregarPDFJS = () => carregarScript(PDFJS, "pdfjsLib").then(lib => { lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return lib; });
const carregarPDFLib = () => carregarScript(PDFLIB, "PDFLib");

function mulM(m: Matriz, n: Matriz): Matriz {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
const aplicar = (m: Matriz, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function retDaMatriz(m: Matriz): Ret {
  const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]];
  const ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]];
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Posição (em pontos do PDF) das imagens e das linhas horizontais longas (linha de corte) da página
async function analisarPagina(lib: any, page: any): Promise<{ imagens: Ret[]; linhasY: number[] }> {
  const { fnArray, argsArray } = await page.getOperatorList();
  const O = lib.OPS;
  let ctm: Matriz = [1, 0, 0, 1, 0, 0];
  const pilha: Matriz[] = [], imagens: Ret[] = [], linhasY: number[] = [];
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i], a = argsArray[i];
    if (fn === O.save) pilha.push(ctm);
    else if (fn === O.restore) ctm = pilha.pop() ?? ctm;
    else if (fn === O.transform) ctm = mulM(ctm, a);
    else if (fn === O.paintFormXObjectBegin) { pilha.push(ctm); if (a[0]) ctm = mulM(ctm, a[0]); }
    else if (fn === O.paintFormXObjectEnd) ctm = pilha.pop() ?? ctm;
    else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject || fn === O.paintImageMaskXObject) imagens.push(retDaMatriz(ctm));
    else if (fn === O.paintImageXObjectRepeat) {
      const [, sx, sy, pos] = a;
      for (let k = 0; k < pos.length; k += 2) imagens.push(retDaMatriz(mulM(ctm, [sx, 0, 0, sy, pos[k], pos[k + 1]])));
    } else if (fn === O.constructPath) {
      const [ops, coords] = a;
      let k = 0, px = 0, py = 0;
      for (const op of ops) {
        if (op === O.moveTo) { px = coords[k]; py = coords[k + 1]; k += 2; }
        else if (op === O.lineTo) {
          const [x0, y0] = aplicar(ctm, px, py), [x1, y1] = aplicar(ctm, coords[k], coords[k + 1]);
          if (Math.abs(y1 - y0) < 0.5 && Math.abs(x1 - x0) > 250) linhasY.push(y0);
          px = coords[k]; py = coords[k + 1]; k += 2;
        }
        else if (op === O.curveTo) k += 6;
        else if (op === O.curveTo2 || op === O.curveTo3 || op === O.rectangle) k += 4;
      }
    }
  }
  return { imagens, linhasY };
}

// Junta as tiras da borda decorativa que se encostam: cada grupo é um cartão
function agruparCartoes(tiras: Ret[]): Cartao[] {
  const grupos: Cartao[] = tiras.map(t => ({ ...t, tiras: [t] }));
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (let i = 0; i < grupos.length && !mudou; i++) for (let j = i + 1; j < grupos.length && !mudou; j++) {
      const a = grupos[i], b = grupos[j], tol = 4;
      if (a.x0 <= b.x1 + tol && b.x0 <= a.x1 + tol && a.y0 <= b.y1 + tol && b.y0 <= a.y1 + tol) {
        grupos[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), tiras: [...a.tiras, ...b.tiras] };
        grupos.splice(j, 1);
        mudou = true;
      }
    }
  }
  return grupos.filter(g => g.tiras.length >= 3);
}

function pixelsDoBrasao(brasao: HTMLImageElement, w: number, h: number): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(brasao, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

// Troca as cores direto nas imagens do PDF: tiras da borda (preto -> cor) e marca d'água (cinza -> brasão colorido)
function recolorirImagens(L: any, doc: any, page: any, brasao: HTMLImageElement, corBorda: RGB): boolean {
  const N = (s: string) => L.PDFName.of(s);
  const xobjs = page.node.Resources()?.lookup(N("XObject"), L.PDFDict);
  if (!xobjs) return false;
  const imagens: { ref: any; dict: any; w: number; h: number; dados: Uint8Array }[] = [];
  for (const [, ref] of xobjs.entries()) {
    const st = doc.context.lookup(ref);
    if (!(st instanceof L.PDFRawStream)) continue;
    const d = st.dict;
    if (d.get(N("Subtype")) !== N("Image") || d.get(N("ColorSpace")) !== N("DeviceRGB") || d.get(N("BitsPerComponent"))?.asNumber() !== 8) continue;
    if (d.get(N("Filter")) !== N("FlateDecode") || d.has(N("DecodeParms"))) continue;
    const w = d.get(N("Width")).asNumber(), h = d.get(N("Height")).asNumber();
    const dados: Uint8Array = L.decodePDFRawStream(st).decode();
    if (dados.length === w * h * 3) imagens.push({ ref, dict: d, w, h, dados });
  }
  const tiras = imagens.filter(i => Math.max(i.w, i.h) / Math.min(i.w, i.h) > 12);
  const marca = imagens
    .filter(i => i.w / i.h > 0.7 && i.w / i.h < 1.4)
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (!tiras.length) return false;

  const trocar = (img: typeof imagens[number], novos: Uint8Array) => {
    const smask = img.dict.get(N("SMask"));
    doc.context.assign(img.ref, doc.context.flateStream(novos, {
      Type: "XObject", Subtype: "Image", Width: img.w, Height: img.h, ColorSpace: "DeviceRGB", BitsPerComponent: 8,
      ...(smask ? { SMask: smask } : {}),
    }));
  };
  for (const t of tiras) {
    const out = new Uint8Array(t.dados.length);
    for (let i = 0; i < out.length; i++) out[i] = 255 - ((255 - t.dados[i]) * (255 - corBorda[i % 3])) / 255;
    trocar(t, out);
  }
  if (marca) {
    const cor = pixelsDoBrasao(brasao, marca.w, marca.h);
    const out = new Uint8Array(marca.dados.length);
    for (let p = 0, q = 0; p < out.length; p += 3, q += 4) {
      const a = cor[q + 3] / 255;
      for (let k = 0; k < 3; k++) {
        const c = a * cor[q + k] + (1 - a) * 255;
        out[p + k] = marca.dados[p + k] * (0.5 + (0.5 * c) / 255);
      }
    }
    trocar(marca, out);
  }
  return true;
}

function molduraArredondada(L: any, r: Ret, pad: number, cores: [RGB, RGB, RGB]): any[] {
  const u = pad / 24, raio = 14 * u, k = 0.5523;
  const ops: any[] = [L.pushGraphicsState()];
  const linhas: [RGB, number, number][] = [[cores[0], 3.2, 0], [cores[1], 3.2, 4.8], [cores[2], 2.6, 9.6]];
  for (const [cor, esp, ins] of linhas) {
    const off = (ins + esp / 2) * u;
    const x0 = r.x0 - pad + off, y0 = r.y0 - pad + off, x1 = r.x1 + pad - off, y1 = r.y1 + pad - off;
    const q = Math.max(raio - off, 2 * u), c = q * (1 - k);
    ops.push(
      L.setLineWidth(esp * u),
      L.setStrokingRgbColor(cor[0] / 255, cor[1] / 255, cor[2] / 255),
      L.moveTo(x0 + q, y0), L.lineTo(x1 - q, y0), L.appendBezierCurve(x1 - c, y0, x1, y0 + c, x1, y0 + q),
      L.lineTo(x1, y1 - q), L.appendBezierCurve(x1, y1 - c, x1 - c, y1, x1 - q, y1),
      L.lineTo(x0 + q, y1), L.appendBezierCurve(x0 + c, y1, x0, y1 - c, x0, y1 - q),
      L.lineTo(x0, y0 + q), L.appendBezierCurve(x0, y0 + c, x0 + c, y0, x0 + q, y0),
      L.closePath(), L.stroke(),
    );
  }
  ops.push(L.popGraphicsState());
  return ops;
}

// Página inteira, na mesma escala para o original e o colorido
async function previa(pdfjs: any, bytes: Uint8Array): Promise<string> {
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  try {
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 2.5 });
    const c = document.createElement("canvas");
    c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise<Blob>((ok, erro) => c.toBlob(b => (b ? ok(b) : erro(new Error("falha ao gerar prévia"))), "image/png"));
    c.width = c.height = 0;
    return URL.createObjectURL(blob);
  } finally {
    await pdf.destroy();
  }
}

export interface DocColorido { previa: string; previaOriginal: string; pdf: Blob }

// null = o PDF não tem o layout do SisGCorp (frente e verso com borda decorativa)
async function gerar(pdfUrl: string, modelo: ModeloDoc): Promise<DocColorido | null> {
  const estilo = ESTILO[modelo];
  const brasao = new Image();
  brasao.src = BRASAO;
  const [pdfjs, L, original, brasaoBytes] = await Promise.all([
    carregarPDFJS(),
    carregarPDFLib(),
    fetch(pdfUrl).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); }).then(b => new Uint8Array(b)),
    fetch(BRASAO).then(r => r.arrayBuffer()),
    brasao.decode(),
  ]);

  const doc0 = await pdfjs.getDocument({ data: original.slice() }).promise;
  const { imagens, linhasY } = await analisarPagina(pdfjs, await doc0.getPage(1));
  await doc0.destroy();
  const tiras = imagens.filter(r => {
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    return Math.max(w, h) / Math.max(Math.min(w, h), 0.01) > 12;
  });
  const cartoes = agruparCartoes(tiras).sort((a, b) => b.y1 - a.y1);
  if (cartoes.length < 2) return null;
  const [frente, verso] = cartoes;

  const doc = await L.PDFDocument.load(original, { ignoreEncryption: true });
  const page = doc.getPage(0);
  if (!recolorirImagens(L, doc, page, brasao, estilo.borda)) return null;

  const h = frente.y1 - frente.y0;
  if (estilo.brasaoNoCanto) {
    const png = await doc.embedPng(brasaoBytes);
    const lado = h * 0.18, alto = lado * png.height / png.width;
    page.drawImage(png, { x: frente.x0 + h * 0.08, y: frente.y1 - h * 0.055 - alto, width: lado, height: alto });
  }

  // a moldura não pode encostar na linha de corte entre os cartões
  const corte = linhasY.find(y => y < frente.y0 && y > verso.y1);
  const folga = corte !== undefined
    ? Math.min(frente.y0 - corte, corte - verso.y1) - 2
    : (frente.y0 - verso.y1) / 2 - 1.5;
  const pad = Math.max(6, Math.min(15, folga));
  page.pushOperators(...molduraArredondada(L, frente, pad, estilo.moldura), ...molduraArredondada(L, verso, pad, estilo.moldura));

  const colorido: Uint8Array = await doc.save();
  const [previaColorida, previaOriginal] = await Promise.all([previa(pdfjs, colorido.slice()), previa(pdfjs, original.slice())]);
  return { previa: previaColorida, previaOriginal, pdf: new Blob([colorido], { type: "application/pdf" }) };
}

const cache = new Map<string, Promise<DocColorido | null>>();
export function docColorido(pdfUrl: string, modelo: ModeloDoc): Promise<DocColorido | null> {
  const chave = `${modelo}|${pdfUrl}`;
  let p = cache.get(chave);
  if (!p) {
    p = gerar(pdfUrl, modelo);
    p.catch(() => cache.delete(chave));
    cache.set(chave, p);
  }
  return p;
}
