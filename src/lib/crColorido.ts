// Gera a versão colorida do CR do SisGCorp (frente e verso) a partir do PDF original.
// Só pinta: a borda decorativa vira verde, a marca d'água vira o brasão colorido e cada cartão ganha a moldura azul/amarela/verde.

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const AZUL = "#002776", AMARELO = "#FFD400", VERDE = "#009C3B";

type Matriz = number[];
interface Ret { x0: number; y0: number; x1: number; y1: number }
interface Cartao extends Ret { tiras: Ret[] }
interface Px { x: number; y: number; w: number; h: number }

let pdfjsPromise: Promise<any> | null = null;
function carregarPDFJS(): Promise<any> {
  const w = window as any;
  if (w.pdfjsLib) {
    w.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return Promise.resolve(w.pdfjsLib);
  }
  pdfjsPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFJS;
    s.crossOrigin = "anonymous";
    s.onload = () => {
      if (!w.pdfjsLib) { reject(new Error("pdf.js não carregou")); return; }
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(w.pdfjsLib);
    };
    s.onerror = () => { pdfjsPromise = null; reject(new Error("pdf.js não carregou")); };
    document.head.appendChild(s);
  });
  return pdfjsPromise;
}

function mulM(m: Matriz, n: Matriz): Matriz {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function retDaMatriz(m: Matriz): Ret {
  const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]];
  const ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]];
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Posição (em pontos do PDF) de cada imagem desenhada na página
async function imagensDaPagina(lib: any, page: any): Promise<Ret[]> {
  const { fnArray, argsArray } = await page.getOperatorList();
  const O = lib.OPS;
  let ctm: Matriz = [1, 0, 0, 1, 0, 0];
  const pilha: Matriz[] = [], out: Ret[] = [];
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i], a = argsArray[i];
    if (fn === O.save) pilha.push(ctm);
    else if (fn === O.restore) ctm = pilha.pop() ?? ctm;
    else if (fn === O.transform) ctm = mulM(ctm, a);
    else if (fn === O.paintFormXObjectBegin) { pilha.push(ctm); if (a[0]) ctm = mulM(ctm, a[0]); }
    else if (fn === O.paintFormXObjectEnd) ctm = pilha.pop() ?? ctm;
    else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject || fn === O.paintImageMaskXObject) out.push(retDaMatriz(ctm));
    else if (fn === O.paintImageXObjectRepeat) {
      const [, sx, sy, pos] = a;
      for (let k = 0; k < pos.length; k += 2) out.push(retDaMatriz(mulM(ctm, [sx, 0, 0, sy, pos[k], pos[k + 1]])));
    }
  }
  return out;
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

function caminhoArredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function emoldurar(src: HTMLCanvasElement, r: Px): HTMLCanvasElement {
  const u = r.h / 300;
  const pad = Math.round(24 * u);
  const W = Math.round(r.w + pad * 2), H = Math.round(r.h + pad * 2);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  const raio = 14 * u;
  caminhoArredondado(x, 0, 0, W, H, raio);
  x.fillStyle = "#fff"; x.fill();
  x.drawImage(src, r.x, r.y, r.w, r.h, pad, pad, r.w, r.h);
  const linhas: [string, number, number][] = [[AZUL, 3.2, 0], [AMARELO, 3.2, 4.8], [VERDE, 2.6, 9.6]];
  for (const [cor, esp, ins] of linhas) {
    const off = (ins + esp / 2) * u;
    caminhoArredondado(x, off, off, W - off * 2, H - off * 2, Math.max(raio - off, 2 * u));
    x.lineWidth = esp * u; x.strokeStyle = cor; x.stroke();
  }
  return c;
}

function juntarLadoALado(frente: HTMLCanvasElement, verso: HTMLCanvasElement): HTMLCanvasElement {
  const gap = Math.round(frente.height * 0.08);
  const c = document.createElement("canvas");
  c.width = frente.width + verso.width + gap * 3;
  c.height = Math.max(frente.height, verso.height) + gap * 2;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(frente, gap, gap);
  x.drawImage(verso, gap * 2 + frente.width, gap);
  return c;
}

async function colorirCR(lib: any, bytes: Uint8Array, brasao: HTMLImageElement, escala = 4) {
  const pdf = await lib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const imgs = await imagensDaPagina(lib, page);
  const tiras = imgs.filter(r => {
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    return Math.max(w, h) / Math.max(Math.min(w, h), 0.01) > 12;
  });
  const cartoes = agruparCartoes(tiras).sort((a, b) => b.y1 - a.y1);
  if (cartoes.length < 2) return null;
  const [cFrente, cVerso] = cartoes;
  const dentro = (r: Ret, c: Ret) => r.x0 >= c.x0 - 1 && r.x1 <= c.x1 + 1 && r.y0 >= c.y0 - 1 && r.y1 <= c.y1 + 1;
  const area = (r: Ret) => (r.x1 - r.x0) * (r.y1 - r.y0);
  const marca = imgs
    .filter(r => { const p = (r.x1 - r.x0) / (r.y1 - r.y0); return p > 0.7 && p < 1.4 && dentro(r, cFrente); })
    .sort((a, b) => area(b) - area(a))[0];

  const vp = page.getViewport({ scale: escala });
  const pg = document.createElement("canvas");
  pg.width = Math.ceil(vp.width); pg.height = Math.ceil(vp.height);
  const ctx = pg.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, pg.width, pg.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const px = (r: Ret): Px => {
    const [a, b, c, d] = vp.convertToViewportRectangle([r.x0, r.y0, r.x1, r.y1]);
    return { x: Math.min(a, c), y: Math.min(b, d), w: Math.abs(c - a), h: Math.abs(d - b) };
  };

  // "screen" troca o preto da borda decorativa por verde e mantém o branco
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = VERDE;
  ctx.beginPath();
  for (const t of tiras) { const p = px(t); ctx.rect(p.x - 1, p.y - 1, p.w + 2, p.h + 2); }
  ctx.fill();
  ctx.restore();

  // "multiply" pinta por baixo do texto, que continua preto
  const fr = px(cFrente);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  if (marca) {
    const p = px(marca);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(brasao, p.x, p.y, p.w, p.h);
  }
  const lado = fr.h * 0.18;
  ctx.globalAlpha = 1;
  ctx.drawImage(brasao, fr.x + fr.h * 0.08, fr.y + fr.h * 0.055, lado, lado * brasao.naturalHeight / brasao.naturalWidth);
  ctx.restore();

  const frente = emoldurar(pg, fr), verso = emoldurar(pg, px(cVerso));
  pg.width = pg.height = 0;
  await pdf.destroy();
  return { frente, verso };
}

const paraBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((ok, erro) => c.toBlob(b => (b ? ok(b) : erro(new Error("falha ao gerar imagem"))), "image/png"));

export interface CRColorido { frente: string; verso: string; ladoALado: Blob }

// null = o PDF não tem o layout do CR do SisGCorp (frente e verso com borda decorativa)
export async function gerarCRColorido(pdfUrl: string, brasaoUrl: string): Promise<CRColorido | null> {
  const brasao = new Image();
  brasao.src = brasaoUrl;
  const [lib, buf] = await Promise.all([
    carregarPDFJS(),
    fetch(pdfUrl).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); }),
    brasao.decode(),
  ]);
  const r = await colorirCR(lib, new Uint8Array(buf), brasao);
  if (!r) return null;
  const [frente, verso, ladoALado] = await Promise.all([paraBlob(r.frente), paraBlob(r.verso), paraBlob(juntarLadoALado(r.frente, r.verso))]);
  return { frente: URL.createObjectURL(frente), verso: URL.createObjectURL(verso), ladoALado };
}
