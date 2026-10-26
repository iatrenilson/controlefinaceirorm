import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usuarioAtual } from "@/lib/usuarioAtual";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { lerDocumento, lerComprovanteEndereco } from "@/lib/lerDocumento";
import { casaComBusca } from "@/lib/buscaCliente";
import { BuscaCliente } from "@/components/BuscaCliente";
import { FileText, Plus, Download, Paperclip, X, UserPlus, Users, Pencil, Trash2, ChevronDown, ChevronUp, Copy, Check, Eye, EyeOff, LayoutGrid, List, CalendarDays, Search, Trophy, Share2, Upload, FileCheck2, FileX2, ExternalLink, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, norm } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Documentos CR ─────────────────────────────────────────────────────────
const DOCS_CR = [
  { id: "ant_federal",       label: "Certidão negativa de antecedentes criminais da Justiça Federal",              tag: "" },
  { id: "ant_estadual",      label: "Certidão negativa de antecedentes criminais da Justiça Estadual",             tag: "" },
  { id: "ant_eleitoral",     label: "Certidão negativa de antecedentes criminais da Justiça Eleitoral",            tag: "" },
  { id: "ant_militar",       label: "Certidão negativa de antecedentes criminais da Justiça Militar",              tag: "" },
  { id: "comp_ocupacao",     label: "Comprovante de ocupação lícita ou aposentadoria",                             tag: "" },
  { id: "comp_residencia",   label: "Comprovante de residência fixa",                                              tag: "" },
  { id: "comp_2_end",        label: "Comprovante de segundo endereço para guarda do acervo",                       tag: "" },
  { id: "cap_tecnica",       label: "Comprovante de capacidade técnica para o manuseio de arma de fogo",          tag: "" },
  { id: "laudo_psico",       label: "Comprovante de aptidão psicológica para o manuseio de arma de fogo",         tag: "" },
  { id: "decl_inquerito",    label: "Declaração de não estar respondendo a inquérito policial ou a processo criminal", tag: "" },
  { id: "comp_filiacao",     label: "Comprovante de filiação a entidade de tiro desportivo",                       tag: "" },
  { id: "decl_habitualidade", label: "Comprovante de habitualidade de tiro desportivo",                            tag: "" },
] as const;
type DocCRTipo = typeof DOCS_CR[number]["id"];
// Quantos dos 12 documentos o cliente tem. Documento de tipo antigo que saiu da lista ("doc_ident", Documento de
// Identificação Pessoal) continua no banco mas não aparece nem conta: fazia o cliente com 11 mostrar 12/12
const TIPOS_DOCS_CR = new Set<string>(DOCS_CR.map(d => d.id));
const qtdDocsCR = (docs: { tipo: string }[]) => new Set(docs.map(d => d.tipo).filter(t => TIPOS_DOCS_CR.has(t))).size;
interface DocCRItem { id: string; tipo: DocCRTipo; fileName: string; storagePath: string; fileUrl: string; }
type DocCRRow = { id: string; cliente_id: string; tipo: string; file_name: string | null; storage_path: string | null; file_url: string | null };
const toDocCRItem = (r: DocCRRow): DocCRItem => ({
  id: r.id, tipo: r.tipo as DocCRTipo, fileName: r.file_name ?? "", storagePath: r.storage_path ?? "", fileUrl: r.file_url ?? "",
});

// ─── Cliente ───────────────────────────────────────────────────────────────
type ClienteStatus = "doc" | "docaut" | "deferido" | "analise" | "autor" | "craf" | "doccraf" | "completo";

const STATUS_LABELS: Record<ClienteStatus, string> = {
  doc:      "Doc. CR",
  docaut:   "Doc. Aut.",
  deferido: "CR defer.",
  analise:  "CR Analise",
  autor:    "Aut. Analise",
  craf:     "Craf. Analise",
  doccraf:  "Doc Craf",
  completo: "Concluído",
};
const STATUS_COLORS: Record<ClienteStatus, string> = {
  doc:      "text-white border-white/40 bg-white/10",
  docaut:   "text-blue-300 border-blue-400/50 bg-blue-500/10",
  deferido: "text-green-400 border-green-500/50 bg-green-500/10",
  analise:  "text-yellow-300/80 border-yellow-400/40 bg-yellow-400/10",
  autor:    "text-orange-400 border-orange-500/50 bg-orange-500/10",
  craf:     "text-cyan-400 border-cyan-500/50 bg-cyan-500/10",
  doccraf:  "text-teal-300 border-teal-400/50 bg-teal-500/10",
  completo: "text-purple-300 border-purple-400/50 bg-purple-500/10",
};
const STATUS_DOT: Record<ClienteStatus, string> = {
  doc:      "bg-white",
  docaut:   "bg-blue-300",
  deferido: "bg-green-400",
  analise:  "bg-yellow-300/80",
  autor:    "bg-orange-400",
  craf:     "bg-cyan-400",
  doccraf:  "bg-teal-300",
  completo: "bg-purple-300",
};

interface Cliente {
  id: string;
  nome: string;
  rg: string;
  orgaoEmissor: string;
  dataExpedicao: string;
  cpf: string;
  nomePai: string;
  nomeMae: string;
  estadoCivil: string;
  dataNascimento: string;
  localNascimento: string;
  ufNascimento: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
  email: string;
  telefone: string;
  profissao: string;
  tipo_ocupacao: string;
  senhaGov: string;
  dataEntradaProcesso: string;
  dataDeferimento: string;
  nomeClube: string;
  loginClube: string;
  senhaClube: string;
  status?: ClienteStatus;
  status2?: ClienteStatus;
  owner_id?: string;
}

type ClienteForm = Omit<Cliente, "id">;

const EMPTY_CLIENTE: ClienteForm = {
  nome: "", rg: "", orgaoEmissor: "SSP-AM", dataExpedicao: "",
  cpf: "", nomePai: "", nomeMae: "", estadoCivil: "Solteiro(a)",
  dataNascimento: "", localNascimento: "", ufNascimento: "AM", endereco: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "Manaus", estado: "AM",
  email: "", telefone: "", profissao: "", tipo_ocupacao: "",
  senhaGov: "", dataEntradaProcesso: "", dataDeferimento: "", nomeClube: "", loginClube: "", senhaClube: "", status: "doc", status2: "doc",
};

// ─── Declaração de Inquérito ───────────────────────────────────────────────
interface FormData {
  nome: string; estadoCivil: string; dataNascimento: string;
  nomePai: string; nomeMae: string; endereco: string; numero: string; complemento: string; bairro: string;
  cep: string; cidade: string; estado: string; rg: string;
  orgaoEmissor: string; dataExpedicao: string; cpf: string;
}
const EMPTY_FORM: FormData = {
  nome: "", estadoCivil: "Solteiro(a)", dataNascimento: "", nomePai: "", nomeMae: "",
  endereco: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "MANAUS", estado: "AM",
  rg: "", orgaoEmissor: "SSP-AM", dataExpedicao: "", cpf: "",
};

// ─── Declaração de Acervo ──────────────────────────────────────────────────
interface FormDataAcervo {
  nome: string; rg: string; orgaoEmissor: string; cpf: string;
  nomePai: string; nomeMae: string; cidade: string; estado: string;
}
const EMPTY_FORM_ACERVO: FormDataAcervo = {
  nome: "", rg: "", orgaoEmissor: "SSP-AM", cpf: "",
  nomePai: "", nomeMae: "", cidade: "Manaus", estado: "AM",
};

// ─── DSA — Declaração de Segurança do Acervo ──────────────────────────────
interface FormDataDSA {
  nome: string; naturalidade: string; dataNascimento: string;
  profissao: string; endereco: string; numero: string; complemento: string;
  bairro: string; cep: string; cidade: string; estado: string; cpf: string;
}
const EMPTY_FORM_DSA: FormDataDSA = {
  nome: "", naturalidade: "MANAUS/AM", dataNascimento: "", profissao: "",
  endereco: "", numero: "", complemento: "s/c", bairro: "", cep: "",
  cidade: "Manaus", estado: "AM", cpf: "",
};

// ─── Declaração de Residência ──────────────────────────────────────────────
interface FormDataResidencia {
  nomeDeclarante: string; rgDeclarante: string; orgaoDeclarante: string; cpfDeclarante: string;
  nomeDeclarado: string; rgDeclarado: string; orgaoDeclarado: string; cpfDeclarado: string;
  nomePai: string; nomeMae: string; endereco: string; numero: string; complemento: string; bairro: string; cep: string; cidade: string; estado: string;
}
const EMPTY_FORM_RES: FormDataResidencia = {
  nomeDeclarante: "", rgDeclarante: "", orgaoDeclarante: "SSP-AM", cpfDeclarante: "",
  nomeDeclarado: "", rgDeclarado: "", orgaoDeclarado: "SSP-AM", cpfDeclarado: "",
  nomePai: "", nomeMae: "", endereco: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "Manaus", estado: "AM",
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatDate(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

let _logoPassarinhoCache: string | null = null;
async function loadLogoPassarinho(): Promise<string | null> {
  if (_logoPassarinhoCache) return _logoPassarinhoCache;
  try {
    const base = (import.meta as any).env?.BASE_URL ?? "/";
    const resp = await fetch(base + "logo-passarinho.png");
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => { _logoPassarinhoCache = reader.result as string; resolve(_logoPassarinhoCache); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

let _watermarkCache: string | null = null;
async function loadWatermarkImg(): Promise<string | null> {
  if (_watermarkCache) return _watermarkCache;
  try {
    const base = (import.meta as any).env?.BASE_URL ?? "/";
    const resp = await fetch(base + "watermark-logo.png");
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => { _watermarkCache = reader.result as string; resolve(_watermarkCache); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}
function addWatermark(doc: any, imgData: string) {
  const W = 210, H = 297, size = 140;
  doc.setGState(doc.GState({ opacity: 0.07 }));
  doc.addImage(imgData, "PNG", (W - size) / 2, (H - size) / 2, size, size);
  doc.setGState(doc.GState({ opacity: 1 }));
}

function getSiteDate(): Date {
  try {
    const raw = localStorage.getItem("clock_override");
    if (raw) {
      const { date, time } = JSON.parse(raw);
      return new Date(`${date}T${time}:00`);
    }
  } catch {}
  return new Date();
}
function dataExtenso(): string {
  const raw = format(getSiteDate(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  return raw.replace(/\bde ([a-z])/, (_, l) => `de ${l.toUpperCase()}`);
}
function maskCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length > 9) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  if (d.length > 6) return d.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
  if (d.length > 3) return d.replace(/(\d{3})(\d{1,3})/, "$1.$2");
  return d;
}
function maskRg(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length <= 1) return d;
  return d.slice(0, d.length - 1) + "-" + d.slice(-1);
}
function maskCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length > 5) return d.replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2-$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d{1,3})/, "$1.$2");
  return d;
}
function maskTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  if (d.length > 6)   return d.replace(/(\d{2})(\d{4,5})(\d*)/, "($1) $2-$3");
  if (d.length > 2)   return d.replace(/(\d{2})(\d+)/, "($1) $2");
  if (d.length > 0)   return `(${d}`;
  return d;
}
function titleCase(s: string) { return s.replace(/(^|\s)(\S)/g, (_, sp, c) => sp + c.toUpperCase()); }
async function buscarCep(cepMasked: string): Promise<{ logradouro: string; bairro: string; localidade: string; uf: string } | null> {
  const d = cepMasked.replace(/\D/g, "");
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    return j.erro ? null : j;
  } catch { return null; }
}

// ─── Foto vira PDF ───────────────────────────────────────────────────────────
// Comprovante enviado como foto é anexado já em PDF: uma página A4 com a imagem inteira centralizada
// (lado maior até 2000 px, JPEG 85%: legível e leve). createImageBitmap já aplica a rotação da foto do celular.
async function fotoParaPDF(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  try {
    const escala = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: c.width > c.height ? "landscape" : "portrait", compress: true });
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), margem = 8;
    const k = Math.min((pw - 2 * margem) / c.width, (ph - 2 * margem) / c.height);
    const w = c.width * k, h = c.height * k;
    doc.addImage(c.toDataURL("image/jpeg", 0.85), "JPEG", (pw - w) / 2, (ph - h) / 2, w, h);
    return new File([doc.output("blob")], file.name.replace(/\.[^.]+$/, "") + ".pdf", { type: "application/pdf" });
  } finally {
    bmp.close();
  }
}

// ─── Redimensiona imagem ─────────────────────────────────────────────────────
async function fitImageToPage(
  dataUrl: string,
  maxW = 700, maxH = 950, quality = 0.70
): Promise<string> {
  if (!dataUrl.startsWith("data:image")) return dataUrl;

  const drawBitmap = (src: HTMLImageElement | ImageBitmap, w: number, h: number): string => {
    const scale = Math.min(maxW / w, maxH / h, 1);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src as CanvasImageSource, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  };

  // 1ª tentativa: createImageBitmap (suporta TIFF, HEIC, WebP, etc. e é mais robusto)
  try {
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    const result = drawBitmap(bmp, bmp.width, bmp.height);
    bmp.close();
    return result;
  } catch { /* falhou — tenta via <img> */ }

  // 2ª tentativa: HTMLImageElement
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(drawBitmap(img, img.naturalWidth, img.naturalHeight));
    // Se ambas falharam: retorna placeholder branco (NUNCA a original que pode ser gigante)
    img.onerror = () => {
      const c = document.createElement("canvas");
      c.width = maxW; c.height = maxH;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, maxW, maxH);
      resolve(c.toDataURL("image/jpeg", 0.5));
    };
    img.src = dataUrl;
  });
}

// ─── Mescla frente e verso do RG em uma única imagem (mesma folha) ────────
async function mergeImagesVertical(url1: string, url2: string): Promise<string> {
  const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
  const [img1, img2] = await Promise.all([loadImg(url1), loadImg(url2)]);

  const PAGE_W = 760;
  const SLOT_H = 480;
  const GAP = 18;

  const scaleImg = (img: HTMLImageElement) =>
    Math.min(PAGE_W / img.naturalWidth, SLOT_H / img.naturalHeight, 1);

  const s1 = scaleImg(img1), s2 = scaleImg(img2);
  const w1 = Math.round(img1.naturalWidth * s1), h1 = Math.round(img1.naturalHeight * s1);
  const w2 = Math.round(img2.naturalWidth * s2), h2 = Math.round(img2.naturalHeight * s2);

  const c = document.createElement("canvas");
  c.width = PAGE_W;
  c.height = h1 + GAP + h2;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(img1, Math.round((PAGE_W - w1) / 2), 0, w1, h1);
  ctx.drawImage(img2, Math.round((PAGE_W - w2) / 2), h1 + GAP, w2, h2);

  return c.toDataURL("image/jpeg", 0.82);
}


// ─── PDF generators ───────────────────────────────────────────────────────
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

// Escreve parágrafo justificado com trechos bold/italic/normal intercalados
function writeInlinePara(
  doc: any,
  segments: Array<{ text: string; bold?: boolean; italic?: boolean }>,
  x: number, startY: number, maxW: number, lineH: number
): number {
  type Word = { text: string; style: string; w: number; noSpaceBefore: boolean };
  const allWords: Word[] = [];

  for (const seg of segments) {
    const style = seg.bold ? "bold" : seg.italic ? "italic" : "normal";
    doc.setFont("helvetica", style);
    const tokens = seg.text.split(/\s+/).filter(t => t.length > 0);
    for (const token of tokens) {
      allWords.push({
        text: token, style,
        w: doc.getTextWidth(token),
        noSpaceBefore: /^[,.:;!?)»\]\-–—]/.test(token),
      });
    }
  }

  doc.setFont("helvetica", "normal");
  const spW = doc.getTextWidth(" ");

  // Greedy line wrapping
  type Line = { words: Word[]; totalW: number };
  const lines: Line[] = [];
  let cur: Line = { words: [], totalW: 0 };
  for (const word of allWords) {
    const addSp = cur.words.length > 0 && !word.noSpaceBefore;
    const needed = cur.totalW + (addSp ? spW : 0) + word.w;
    if (cur.words.length > 0 && needed > maxW) {
      lines.push(cur);
      cur = { words: [word], totalW: word.w };
    } else {
      cur.totalW = needed;
      cur.words.push(word);
    }
  }
  if (cur.words.length > 0) lines.push(cur);

  // Render cada linha justificada (última linha: alinhada à esquerda)
  let cy = startY;
  for (let li = 0; li < lines.length; li++) {
    const { words, totalW } = lines[li];
    const isLast = li === lines.length - 1;
    let gapCount = 0;
    for (let wi = 1; wi < words.length; wi++) { if (!words[wi].noSpaceBefore) gapCount++; }
    const extra = isLast || gapCount === 0 ? 0 : maxW - totalW;
    const gapW = spW + (gapCount > 0 ? extra / gapCount : 0);
    let cx = x;
    for (let wi = 0; wi < words.length; wi++) {
      const w = words[wi];
      doc.setFont("helvetica", w.style);
      doc.text(w.text, cx, cy);
      if (wi < words.length - 1) cx += w.w + (words[wi + 1].noSpaceBefore ? 0 : gapW);
    }
    cy += lineH;
  }
  return cy;
}

async function salvarPDF(doc: any, filename: string): Promise<boolean> {
  const blob = doc.output("blob");
  if (typeof (window as any).showSaveFilePicker === "function") {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      sonnerToast.success("PDF salvo com sucesso!", {
        description: "Verifique a pasta que você selecionou.",
        duration: 4000,
      });
      return true;
    } catch (e: any) {
      if (e?.name === "AbortError") return false; // usuário cancelou
    }
  }
  doc.save(filename);
  sonnerToast.success("PDF baixado!", {
    description: "Verifique a pasta de Downloads.",
    duration: 4000,
  });
  return true;
}

// ─── Layout padrão Passarinho (logo + linhas douradas + marca d'água + rodapé) ──
async function aplicarLayoutPassarinho(doc: any, semLogo = false) {
  const W = 210, H = 297, ML = 15, MR = 15, CW = W - ML - MR;
  const cGold: [number,number,number]      = [198, 155, 55];
  const cDarkGreen: [number,number,number] = [27,  82,  22];

  // Modo folha limpa: sem nenhum elemento gráfico, só margens
  if (semLogo) {
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(...cDarkGreen);
    doc.setLineWidth(0.4);
    return { startY: ML + 5, W, H, ML, MR, CW, footerY: H - 10 };
  }

  const logo = await loadLogoPassarinho();

  // Pré-processa a logo em tamanhos otimizados (evita embedar PNG 1535×1024 bruto)
  let logoHeaderData: string | null = null;   // PNG 270×180 — preserva transparência
  let logoWatermarkData: string | null = null; // JPEG 500×333 a 15% qualidade — ~5KB
  if (logo) {
    const img = new Image();
    img.src = logo;
    await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); });
    const nw = img.naturalWidth || 1535, nh = img.naturalHeight || 1024;
    const ratio = nh / nw;

    // Cabeçalho: 900px JPEG 92% com fundo branco
    const cvH = document.createElement("canvas");
    cvH.width = 900; cvH.height = Math.round(900 * ratio);
    const ctxH = cvH.getContext("2d")!;
    ctxH.imageSmoothingEnabled = true; ctxH.imageSmoothingQuality = "high";
    ctxH.fillStyle = "#ffffff";
    ctxH.fillRect(0, 0, cvH.width, cvH.height);
    ctxH.drawImage(img, 0, 0, cvH.width, cvH.height);
    logoHeaderData = cvH.toDataURL("image/jpeg", 0.92);

    // Marca d'água: 900px largura, fundo branco, 7% opacidade, JPEG 65%
    const cvW = document.createElement("canvas");
    cvW.width = 900; cvW.height = Math.round(900 * ratio);
    const ctxW = cvW.getContext("2d")!;
    ctxW.imageSmoothingEnabled = true; ctxW.imageSmoothingQuality = "high";
    ctxW.fillStyle = "#ffffff";
    ctxW.fillRect(0, 0, cvW.width, cvW.height);
    ctxW.globalAlpha = 0.055;
    ctxW.drawImage(img, 0, 0, cvW.width, cvW.height);
    logoWatermarkData = cvW.toDataURL("image/jpeg", 0.65);
  }

  // Marca d'água (200mm de largura na página, centrada) — omitida em modo semLogo
  if (logoWatermarkData) {
    const wmW = 200, wmH = wmW * (1024 / 1535);
    doc.addImage(logoWatermarkData, "JPEG", W / 2 - wmW / 2, H / 2 - wmH / 2, wmW, wmH);
  }

  // Cabeçalho: logo centralizada + linhas laterais
  const logoW = 45, logoH = logoW * (1024 / 1535);
  const logoX = W / 2 - logoW / 2, logoY = 4;
  const lineGap = 5;
  const leftEnd = logoX - lineGap, rightStart = logoX + logoW + lineGap;

  const lineY1 = logoY + logoH * 0.38;
  doc.setDrawColor(...cDarkGreen); doc.setLineWidth(1.6);
  doc.line(ML, lineY1, leftEnd, lineY1);
  doc.line(rightStart, lineY1, W - MR, lineY1);

  const lineY2 = lineY1 + 3;
  doc.setDrawColor(...cGold); doc.setLineWidth(0.7);
  doc.line(ML, lineY2, leftEnd, lineY2);
  doc.line(rightStart, lineY2, W - MR, lineY2);

  if (logoHeaderData) doc.addImage(logoHeaderData, "JPEG", logoX, logoY, logoW, logoH);

  const lineYBottom = logoY + logoH + 4;
  doc.setDrawColor(...cDarkGreen); doc.setLineWidth(0.6);
  doc.line(ML, lineYBottom, W - MR, lineYBottom);

  // Rodapé verde + linha dourada
  const barH = 16, barY = H - barH - 2;
  doc.setFillColor(...cDarkGreen);
  doc.rect(0, barY, W, barH + 2, "F");
  doc.setDrawColor(...cGold); doc.setLineWidth(1.5);
  doc.line(0, barY, W, barY);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
  doc.text("PASSARINHO ASSESSORIA BÉLICA", W / 2, barY + 7, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text("Assessoria Bélica Especializada | CR, CRAF, Guias de Tráfego, Compras, Transferências e Regularizações — Manaus/AM", W / 2, barY + 13, { align: "center" });

  doc.setTextColor(0, 0, 0);
  // Reset estado de linha para o conteúdo (verde escuro fino = igual DSA original)
  doc.setDrawColor(...cDarkGreen);
  doc.setLineWidth(0.4);
  return { startY: lineYBottom + 8, W, H, ML, MR, CW, footerY: barY };
}

async function gerarPDF(data: FormData, semLogo = false) {
  const primeiroNome = capitalize(data.nome.trim().split(/\s+/)[0] || "Declaração");
  const dia = format(getSiteDate(), "dd");
  const mes = format(getSiteDate(), "MMMM", { locale: ptBR }).toLowerCase();
  const ano = format(getSiteDate(), "yyyy");
  const numStr = data.numero ? `, ${data.numero}` : "";
  const cepStr = data.cep ? `, Cep - ${data.cep}` : "";
  const bairroStr = data.bairro ? ` - ${data.bairro}` : "";
  const enderecoCompleto = `${data.endereco}${numStr}${cepStr}${bairroStr}, ${data.cidade}, ${data.estado}`;

  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

  const { startY, W, ML, MR, CW } = await aplicarLayoutPassarinho(doc, semLogo);
  let y = startY;

  // ── Título ──────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("DECLARAÇÃO DE INEXISTÊNCIA DE INQUÉRITOS POLICIAIS OU", W / 2, y, { align: "center" });
  y += 6;
  doc.text("PROCESSOS CRIMINAIS", W / 2, y, { align: "center" });
  y += 14;

  // ── Parágrafo 1 — nome do cliente em negrito ─────────────────────────────────
  doc.setFontSize(12);
  const segsInq: Array<{ text: string; bold?: boolean }> = [
    { text: "Eu, " },
    { text: data.nome.toUpperCase(), bold: true },
    { text: `, portador (a) do RG nº ${data.rg} e do CPF n°${data.cpf}, residente ${enderecoCompleto}.` },
  ];
  y = writeInlinePara(doc, segsInq, ML, y, CW, 6);
  y += 6;

  // ── Parágrafo 2 ──────────────────────────────────────────────────────────────
  const p2 = ` Declaro sob as penas da lei, que não respondo processo criminal e/ou inquérito policial, e estou ciente de que, em caso de falsidade ideológica, ficarei sujeito às sanções prescritas no Código Penal e às demais cominações legais aplicáveis.`;
  const p2Lines = doc.splitTextToSize(p2, CW);
  doc.text(p2Lines, ML, y, { align: "justify", maxWidth: CW });
  y += p2Lines.length * 6 + 10;

  // ── Art. 299 ─────────────────────────────────────────────────────────────────
  doc.text('"Art. 299', ML, y);
  y += 6;
  doc.text("_", ML, y);
  y += 6;
  const artBody = ` Omitir, em documento público ou particular, declaração que nele deveria constar, ou nele inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sobre o fato juridicamente relevante.\nPena: reclusão de 1 (um) a 5 (cinco) anos e multa, se o documento é público e reclusão de 1 (um) a 3 (três) anos, se o documento é particular."`;
  const artLines = doc.splitTextToSize(artBody, CW);
  doc.text(artLines, ML, y, { align: "justify", maxWidth: CW });
  y += artLines.length * 6 + 20;

  // ── Data ─────────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${data.cidade.toUpperCase()}, ${data.estado.toUpperCase()}-${dia} de ${mes} de ${ano}`, W - MR, y, { align: "right" });
  y += 30;

  // ── Assinatura digital ────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const sigLabel = "Assinatura digital (.gov.br ou ICP-Brasil) requerente: ";
  doc.text(sigLabel, ML, y);
  const sigLabelW = doc.getTextWidth(sigLabel);
  doc.line(ML + sigLabelW, y - 0.5, W - MR, y - 0.5);

  return await salvarPDF(doc, `10 Declaração de não estar respondendo a inquérito policial ou a processo criminal - ${primeiroNome}.pdf`);
}

async function gerarPDFAcervo(data: FormDataAcervo, semLogo = false) {
  const primeiroNome = capitalize(data.nome.trim().split(/\s+/)[0] || "Declaração");
  const dia = format(getSiteDate(), "dd");
  const mes = format(getSiteDate(), "MMMM", { locale: ptBR }).toLowerCase();
  const ano = format(getSiteDate(), "yyyy");
  const paiAcervo = data.nomePai?.trim() ? data.nomePai.toUpperCase() : "";
  const maeAcervo = data.nomeMae?.trim() ? data.nomeMae.toUpperCase() : "";
  const filhoDeAcervo = paiAcervo && maeAcervo ? `${paiAcervo} e ${maeAcervo}` : paiAcervo || maeAcervo;

  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

  const { startY, W, ML, MR, CW } = await aplicarLayoutPassarinho(doc, semLogo);
  let y = startY;

  // Título: bold, underline, uppercase, centered, 12pt
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const titleAc = "COMPROVANTE DE SEGUNDO ENDEREÇO DE GUARDA DO ACERVO";
  const titleAcLines = doc.splitTextToSize(titleAc, CW);
  titleAcLines.forEach((line: string, i: number) => {
    doc.text(line, W / 2, y + i * 6, { align: "center" });
  });
  y += titleAcLines.length * 6 + 14;

  // Corpo com nomes em negrito
  doc.setFontSize(12);
  const segsAc: Array<{ text: string; bold?: boolean }> = [
    { text: "Eu, " },
    { text: data.nome.toUpperCase(), bold: true },
    { text: `, portador da cédula de identidade RG nº ${data.rg} / ${data.orgaoEmissor.toUpperCase()}, CPF nº ${data.cpf}` },
  ];
  if (paiAcervo && maeAcervo) {
    segsAc.push({ text: ", filho de " });
    segsAc.push({ text: paiAcervo, bold: true });
    segsAc.push({ text: " e " });
    segsAc.push({ text: maeAcervo, bold: true });
  } else if (filhoDeAcervo) {
    segsAc.push({ text: ", filho de " });
    segsAc.push({ text: filhoDeAcervo, bold: true });
  }
  segsAc.push({ text: ", DECLARO que não possuo segundo endereço de guarda de acervo." });
  y = writeInlinePara(doc, segsAc, ML, y, CW, 6.5);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.text("Por ser verdade, firmo o presente.", W / 2, y, { align: "center" });
  y += 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${data.cidade.toUpperCase()}, ${data.estado.toUpperCase()}-${dia} de ${mes} de ${ano}`, W - MR, y, { align: "right" });
  y += 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const sigLabelAc = "Assinatura digital (.gov.br ou ICP-Brasil) requerente: ";
  doc.text(sigLabelAc, ML, y);
  const sigLabelAcW = doc.getTextWidth(sigLabelAc);
  doc.line(ML + sigLabelAcW, y - 0.5, W - MR, y - 0.5);

  return await salvarPDF(doc, `8 Comprovante de Segundo Endereço de Guarda do Acervo - ${primeiroNome}.pdf`);
}

// ─── DSA — Declaração de Segurança do Acervo ──────────────────────────────
async function gerarPDFDSA(data: FormDataDSA, tipo: "registro" | "aquisicao" = "registro", semLogo = false) {
  const primeiroNome = capitalize(data.nome.trim().split(/\s+/)[0] || "DSA");

  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

  const { startY, W, ML, MR, CW } = await aplicarLayoutPassarinho(doc, semLogo);
  let y = startY;

  // ── TÍTULO ──────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("ANEXO A", W / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(12);
  doc.text("DECLARAÇÃO DE SEGURANÇA DO ACERVO (DSA)", W / 2, y, { align: "center" });
  y += 10;

  // ── CORPO ────────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const comp = data.complemento.trim() ? ` ${data.complemento.toUpperCase()},` : "";
  const enderecoStr = `${data.endereco.toUpperCase()}, ${data.numero.toUpperCase()} -${comp} ${data.bairro.toUpperCase()}, ${data.cidade.toUpperCase()}/${data.estado.toUpperCase()} - CEP: ${data.cep}`;

  const finalidade = tipo === "aquisicao"
    ? "Autorização para Aquisição de Arma de Fogo"
    : "Concessão de registro";

  const segs: Array<{ text: string; bold?: boolean }> = [
    { text: "EU, " },
    { text: data.nome.toUpperCase(), bold: true },
    { text: `, brasileiro(a), natural de ${data.naturalidade.toUpperCase()}, nascido em ${formatDate(data.dataNascimento)}${data.profissao.trim() ? `, profissão ${data.profissao.toUpperCase()}` : ``}, residindo em ${enderecoStr}, e CPF nº ${data.cpf}. DECLARO, para fim de ${finalidade}, que o local de guarda do meu acervo de Atirador possui cofre ou lugar seguro, com tranca, para armazenamento das armas de fogo desmuniciadas de que sou proprietário, e de que adotarei as medidas necessárias para impedir que menor de dezoito anos de idade ou pessoa civilmente incapaz se apodere de arma de fogo sob minha posse ou de minha propriedade, observado o disposto no art. 13 da Lei nº 10.826, de 2003.` },
  ];

  y = writeInlinePara(doc, segs, ML, y, CW, 5.5);
  y += 10;

  const dia = format(getSiteDate(), "dd");
  const mes = format(getSiteDate(), "MMMM", { locale: ptBR }).toLowerCase();
  const ano = format(getSiteDate(), "yyyy");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${data.cidade.toUpperCase()}, ${data.estado.toUpperCase()}-${dia} de ${mes} de ${ano}`, W - MR, y, { align: "right" });
  y += 30;

  // ── ASSINATURA DIGITAL ──────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const sigLabel = "Assinatura digital (.gov.br ou ICP-Brasil) requerente: ";
  doc.text(sigLabel, ML, y);
  const sigLabelW = doc.getTextWidth(sigLabel);
  doc.line(ML + sigLabelW, y - 0.5, W - MR, y - 0.5);

  const sufixo = tipo === "aquisicao"
    ? "10 Declaração de Segurança do Acervo - Aquisição"
    : "10 Declaração de Segurança do Acervo - Concessão";
  return await salvarPDF(doc, `${sufixo} - ${primeiroNome}.pdf`);
}

// ─── Carrega script CDN dinamicamente ────────────────────────────────────
async function loadScript(src: string): Promise<void> {
  if (document.querySelector(`script[src="${src}"]`)) return;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(); s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ─── Renderiza 1ª página de PDF para JPEG usando PDF.js ──────────────────
// maxW/maxH funcionam igual ao fitImageToPage: a página é escalonada para caber
// dentro do limite de pixels, mantendo proporção. Assim PDF e imagem produzem
// arquivos de tamanho equivalente.
async function renderPdfPageToJpeg(pdfDataUrl: string, maxW = 680, maxH = 960, quality = 0.76): Promise<string> {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  const lib = (window as any).pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await lib.getDocument(pdfDataUrl).promise;
  const page = await pdf.getPage(1);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(maxW / vp1.width, maxH / vp1.height, 2.5);
  const vp = page.getViewport({ scale });
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(vp.width)); c.height = Math.max(1, Math.round(vp.height));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return c.toDataURL("image/jpeg", quality);
}

// Renderiza TODAS as páginas de um PDF para JPEG (compressão iLovePDF-style)
async function renderPdfToJpegs(pdfDataUrl: string, maxW = 750, maxH = 1060, quality = 0.82): Promise<string[]> {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  const lib = (window as any).pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await lib.getDocument(pdfDataUrl).promise;
  const results: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = Math.min(maxW / vp1.width, maxH / vp1.height, 2.5);
    const vp = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(vp.width)); c.height = Math.max(1, Math.round(vp.height));
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    results.push(c.toDataURL("image/jpeg", quality));
  }
  return results;
}

async function gerarPDFResidencia(data: FormDataResidencia, rgDataUrl: string | null, rgDataUrl2: string | null, compDataUrl: string | null, semLogo = false) {
  const primeiroNome = capitalize(data.nomeDeclarado.trim().split(/\s+/)[0] || "Declaração");
  const dataEscrita = dataExtenso();
  const normAddrR = (s: string) =>
    s.replace(/(\d)\s*[-]+\s*([A-Za-zÀ-ÿ])/g, "$1 - $2").replace(/\s{2,}/g, " ").trim();
  const numResStr = data.numero ? `, Nº ${data.numero}` : "";
  const compResNorm = normAddrR((data.complemento ?? "").replace(/[-\s]+$/, "").trim());
  const compResStr = compResNorm ? `, ${compResNorm.toUpperCase()}` : "";
  const bairroResStr = data.bairro ? ` - ${normAddrR(data.bairro).toUpperCase()},` : ",";
  const endFormatado = `${data.endereco.toUpperCase()}${numResStr}${compResStr}${bairroResStr} Cep: ${data.cep} – ${data.cidade.toUpperCase()}-${data.estado.toUpperCase()}`
    .replace(/(\d)-(\s*[A-Za-zÀ-ÿ])/g, (_, d, after) => `${d} - ${after.trimStart()}`);

  // ── Pré-converte anexos para JPEG com configurações otimizadas ───────────
  const attachmentList: Array<{ dataUrl: string; label: string }> = [];

  // Pág 2 – Comprovante de Residência
  if (compDataUrl?.startsWith("data:image")) {
    attachmentList.push({ dataUrl: await fitImageToPage(compDataUrl, 800, 1130, 0.83), label: "Anexo: Comprovante de Residência" });
  } else if (compDataUrl?.startsWith("data:application/pdf")) {
    attachmentList.push({ dataUrl: await renderPdfPageToJpeg(compDataUrl, 840, 1190, 0.86), label: "Anexo: Comprovante de Residência" });
  }

  // Pág 3 – RG/CNH
  if (rgDataUrl && rgDataUrl2) {
    attachmentList.push({ dataUrl: await mergeImagesVertical(rgDataUrl, rgDataUrl2), label: "Anexo: Documento de Identidade (RG)" });
  } else if (rgDataUrl?.startsWith("data:image")) {
    attachmentList.push({ dataUrl: await fitImageToPage(rgDataUrl, 820, 1090, 0.82), label: "Anexo: Documento de Identidade (RG)" });
  } else if (rgDataUrl?.startsWith("data:application/pdf")) {
    attachmentList.push({ dataUrl: await renderPdfPageToJpeg(rgDataUrl, 1400, 1900, 0.91), label: "Anexo: Documento de Identidade (RG)" });
  }

  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

  const { startY, W, ML, MR, CW } = await aplicarLayoutPassarinho(doc, semLogo);
  let y = startY;

  // Título: bold, underline, 14pt, centered
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const titleRes = "DECLARAÇÃO DE RESIDÊNCIA";
  doc.text(titleRes, W / 2, y, { align: "center" });
  y += 7 + 14;

  // Corpo principal — trechos em negrito conforme original
  doc.setFontSize(12);
  const segsRes: Array<{ text: string; bold?: boolean }> = [
    { text: data.nomeDeclarante.toUpperCase(), bold: true },
    { text: ", RG nº " },
    { text: `${data.rgDeclarante}/${data.orgaoDeclarante.toUpperCase()}`, bold: true },
    { text: ", CPF nº " },
    { text: data.cpfDeclarante, bold: true },
    { text: ", " },
    { text: "DECLARO", bold: true },
    { text: " para fins de comprovação de residência, sob as penas da lei (art. 2°da lei 7.115/83) que o Sr.(a) " },
    { text: data.nomeDeclarado.toUpperCase(), bold: true },
    { text: ", portador da cédula de identidade (RG) nº " },
    { text: `${data.rgDeclarado} - ${data.orgaoDeclarado.toUpperCase()}`, bold: true },
    { text: ", CPF nº " },
    { text: data.cpfDeclarado, bold: true },
    { text: ", filho(a) de " },
    { text: data.nomePai.toUpperCase(), bold: true },
    { text: " e " },
    { text: data.nomeMae.toUpperCase(), bold: true },
    { text: ", é residente e domiciliada na " },
    { text: endFormatado, bold: true },
  ];
  y = writeInlinePara(doc, segsRes, ML, y, CW, 6.7);
  y += 3;

  // "Declaro ainda..." — "in verbis" em itálico (line-height 1.5 ≈ 6.35mm)
  y = writeInlinePara(doc, [
    { text: "Declaro ainda, está ciente de que a declaração falsa pode implicar na sanção penal prevista no art. 299 do código penal, " },
    { text: "in verbis", italic: true },
    { text: ":" },
  ], ML, y, CW, 6.4);
  y += 8;

  // Art. 299 (italic, text-indent 2cm apenas na 1ª linha, justificado manualmente)
  doc.setFont("helvetica", "italic");
  const artRes = "Art. 299 – Omitir, em documento público ou particular, declaração que nela deveria constar, ou nele inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sobre o fato juridicamente relevante.";

  type ArtLine299 = { text: string; x: number; maxW: number };
  const artLines299: ArtLine299[] = [];
  const words299 = artRes.split(" ");
  let curLine299 = "";
  let isFirst299 = true;
  for (const word of words299) {
    const lineMaxW = isFirst299 ? CW - 20 : CW;
    const test = curLine299 ? curLine299 + " " + word : word;
    if (curLine299 && doc.getTextWidth(test) > lineMaxW) {
      artLines299.push({ text: curLine299, x: isFirst299 ? ML + 20 : ML, maxW: lineMaxW });
      isFirst299 = false;
      curLine299 = word;
    } else {
      curLine299 = test;
    }
  }
  if (curLine299) artLines299.push({ text: curLine299, x: isFirst299 ? ML + 20 : ML, maxW: isFirst299 ? CW - 20 : CW });

  for (let i = 0; i < artLines299.length; i++) {
    const { text, x, maxW } = artLines299[i];
    const isLast = i === artLines299.length - 1;
    if (isLast) {
      doc.text(text, x, y);
    } else {
      const ws = text.split(" ");
      const totalW = ws.reduce((s: number, w: string) => s + doc.getTextWidth(w), 0);
      const gaps = ws.length - 1;
      const gapW = gaps > 0 ? (maxW - totalW) / gaps : 0;
      let cx = x;
      for (let wi = 0; wi < ws.length; wi++) {
        doc.text(ws[wi], cx, y);
        if (wi < ws.length - 1) cx += doc.getTextWidth(ws[wi]) + gapW;
      }
    }
    y += 6.4;
  }
  y += 2;

  // Pena (italic, sem indent, justificado manualmente)
  const penaRes = "Pena: reclusão de 1 (um) a 5 (cinco) anos e multa, se o documento é público e reclusão de 1 (um) a 3 (três) anos, se o documento é particular.";
  const penaLines299 = doc.splitTextToSize(penaRes, CW);
  for (let i = 0; i < penaLines299.length; i++) {
    const text = penaLines299[i];
    const isLast = i === penaLines299.length - 1;
    if (isLast) {
      doc.text(text, ML, y);
    } else {
      const ws = text.split(" ");
      const totalW = ws.reduce((s: number, w: string) => s + doc.getTextWidth(w), 0);
      const gaps = ws.length - 1;
      const gapW = gaps > 0 ? (CW - totalW) / gaps : 0;
      let cx = ML;
      for (let wi = 0; wi < ws.length; wi++) {
        doc.text(ws[wi], cx, y);
        if (wi < ws.length - 1) cx += doc.getTextWidth(ws[wi]) + gapW;
      }
    }
    y += 6.4;
  }
  doc.setFont("helvetica", "normal");

  // Data + assinatura digital (padrão Passarinho)
  y += 20;
  const diaRes = format(getSiteDate(), "dd");
  const mesRes = format(getSiteDate(), "MMMM", { locale: ptBR }).toLowerCase();
  const anoRes = format(getSiteDate(), "yyyy");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${data.cidade.toUpperCase()}, ${data.estado.toUpperCase()}-${diaRes} de ${mesRes} de ${anoRes}`, W - MR, y, { align: "right" });
  y += 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const sigLabelRes = "Assinatura digital (.gov.br ou ICP-Brasil) requerente: ";
  doc.text(sigLabelRes, ML, y);
  const sigLabelResW = doc.getTextWidth(sigLabelRes);
  doc.line(ML + sigLabelResW, y - 0.5, W - MR, y - 0.5);

  // Páginas 2+ — imagens pré-comprimidas (RG e comprovante)
  for (const att of attachmentList) {
    doc.addPage();
    // Título do anexo no topo — esquerda, sem negrito
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(att.label, ML, 15);
    // Imagem centralizada no espaço restante (abaixo do título)
    const imgEl = document.createElement("img");
    imgEl.src = att.dataUrl;
    await new Promise<void>(r => { imgEl.onload = () => r(); });
    const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
    const maxImgW = 170, maxImgH = 268;
    let dw = maxImgW, dh = maxImgW / ratio;
    if (dh > maxImgH) { dh = maxImgH; dw = maxImgH * ratio; }
    const dx = (W - dw) / 2, dy = 22;
    doc.addImage(att.dataUrl, "JPEG", dx, dy, dw, dh);
  }

  return await salvarPDF(doc, `6 Comprovante de Residência Fixa - ${primeiroNome}.pdf`);
}

// ─── Docs Emissão de CRAF (Nota Fiscal + Autorização de Compra + CNH) ─────
async function gerarPDFCraf(nome: string, anexosRaw: Array<{ label: string; dataUrl: string }>) {
  if (anexosRaw.length === 0) return;
  const primeiroNome = capitalize(nome.trim().split(/\s+/)[0] || "Craf");
  const filename = `Docs Emissão de CRAF - ${primeiroNome}.pdf`;

  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js");
  const { PDFDocument, rgb, StandardFonts } = (window as any).PDFLib;

  const merged = await PDFDocument.create();
  const font = await merged.embedFont(StandardFonts.HelveticaBold);
  const A4W = 595.28, A4H = 841.89;

  for (const a of anexosRaw) {
    if (a.dataUrl.startsWith("data:application/pdf")) {
      const isNotaFiscal = a.label.toLowerCase().includes("nota");
      if (isNotaFiscal) {
        // Nota Fiscal: copia verbatim — mantém texto selecionável e copiável
        const b64 = a.dataUrl.split(",")[1];
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const copied = await merged.copyPages(src, src.getPageIndices());
        copied.forEach((pg: any, idx: number) => {
          merged.addPage(pg);
          if (idx === 0) {
            const { width: pw, height: ph } = pg.getSize();
            pg.drawRectangle({ x: 0, y: ph - 16, width: pw, height: 16, color: rgb(1, 1, 1) });
            pg.drawText(`Anexo: ${a.label}`, { x: 8, y: ph - 12, size: 9, font, color: rgb(0, 0, 0) });
          }
        });
      } else {
        // Outros PDFs (Autorização de Compra, etc.): renderiza como JPEG alta qualidade
        const pages = await renderPdfToJpegs(a.dataUrl, 1400, 2000, 0.92);
        for (let i = 0; i < pages.length; i++) {
          const b64 = pages[i].split(",")[1];
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const img = await merged.embedJpg(bytes);
          const pg = merged.addPage([A4W, A4H]);
          if (i === 0) pg.drawText(`Anexo: ${a.label}`, { x: 8, y: A4H - 12, size: 9, font, color: rgb(0, 0, 0) });
          const dims = img.scaleToFit(A4W - 20, A4H - 26);
          pg.drawImage(img, { x: (A4W - dims.width) / 2, y: A4H - dims.height - 18, width: dims.width, height: dims.height });
        }
      }
    } else if (a.dataUrl.startsWith("data:image")) {
      // Imagem: alta resolução para CNH e demais anexos
      const jpegDataUrl = await fitImageToPage(a.dataUrl, 1300, 1840, 0.90);
      const b64 = jpegDataUrl.split(",")[1];
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const img = await merged.embedJpg(bytes);
      const pg = merged.addPage([A4W, A4H]);
      pg.drawText(`Anexo: ${a.label}`, { x: 8, y: A4H - 12, size: 9, font, color: rgb(0, 0, 0) });
      const dims = img.scaleToFit(A4W - 20, A4H - 26);
      pg.drawImage(img, { x: (A4W - dims.width) / 2, y: A4H - dims.height - 18, width: dims.width, height: dims.height });
    }
  }

  const pdfBytes = await merged.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  if (typeof (window as any).showSaveFilePicker === "function") {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob); await writable.close(); return true;
    } catch (e: any) {
      if (e?.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url; el.download = filename;
  document.body.appendChild(el); el.click();
  document.body.removeChild(el);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

// ─── Botão copiar ─────────────────────────────────────────────────────────
// ─── Contrato de prestação de serviços de assessoria bélica ──────────────────
interface FormContrato {
  nome: string; nacionalidade: string; estadoCivil: string; profissao: string;
  cpf: string; rg: string; endereco: string; cep: string; cidadeUf: string;
  telefone: string; email: string;
  servicos: string[]; categoriaCR: string; identificacaoArma: string;
  valorTotal: string; formaPagamento: string; inclusos: string[];
  foro: string; local: string; data: string;
}

// Dados do contratado (a assessoria) ficam no banco (app_config), nunca no código:
// o repositório e o site são públicos
interface DadosContratado {
  nome: string; nacionalidade: string; estadoCivil: string; cpf: string; rg: string;
  endereco: string; cep: string; cidadeUf: string; telefone: string; email: string;
}
const CONTRATADO_VAZIO: DadosContratado = {
  nome: "", nacionalidade: "", estadoCivil: "", cpf: "", rg: "",
  endereco: "", cep: "", cidadeUf: "", telefone: "", email: "",
};
const SQL_APP_CONFIG = `
CREATE TABLE IF NOT EXISTS public.app_config (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_config' AND policyname='app_config_select') THEN
    CREATE POLICY "app_config_select" ON public.app_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_config' AND policyname='app_config_admin') THEN
    CREATE POLICY "app_config_admin" ON public.app_config FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
`.trim();

// Serviços oferecidos (ordem e texto do PDF); o CR recebe a categoria escolhida. "prefixo" abre o nome do arquivo
// ("CR Contrato de Assessoria - Fulano", como o usuário nomeia os contratos)
const SERVICOS_CONTRATO: Array<{ key: string; label: string; prefixo: string; texto: (f: FormContrato) => string }> = [
  { key: "cr",             label: "Concessão de CR",                  prefixo: "CR",
    texto: f => `Concessão de Certificado de Registro (CR) de pessoa física, na categoria ${(f.categoriaCR || "Atirador Desportivo").trim()};` },
  { key: "aquisicao",      label: "Autorização de aquisição de arma", prefixo: "Autorização",    texto: () => "Autorização de aquisição de arma de fogo;" },
  { key: "registro",       label: "Registro de arma + CRAF",          prefixo: "CRAF",           texto: () => "Registro de arma de fogo e emissão do respectivo CRAF;" },
  { key: "guia",           label: "Guia de trânsito / tráfego",       prefixo: "Guia",           texto: () => "Emissão de guia de trânsito ou guia de tráfego, conforme o procedimento aplicável;" },
  { key: "cr_renovacao",   label: "Renovação de CR",                  prefixo: "Renovação CR",   texto: () => "Renovação de Certificado de Registro (CR);" },
  { key: "craf_renovacao", label: "Renovação do registro + CRAF",     prefixo: "Renovação CRAF", texto: () => "Renovação do registro de arma de fogo e do respectivo CRAF;" },
];

// O que o valor do contrato já cobre (o contratado providencia e paga); todos vêm marcados.
// "curto" é o nome usado na cláusula de desistência (6.3)
const INCLUSOS_CONTRATO: Array<{ key: string; label: string; texto: (qtdPedidos: number) => string; curto: (qtdPedidos: number) => string }> = [
  { key: "psico",   label: "Exame psicológico",           texto: () => "o exame de aptidão psicológica para o manuseio de arma de fogo;",
    curto: () => "o exame de aptidão psicológica" },
  { key: "tecnica", label: "Teste de capacidade técnica", texto: () => "o teste de capacidade técnica para o manuseio de arma de fogo;",
    curto: () => "o teste de capacidade técnica" },
  { key: "clube",   label: "Clube de tiro (1 ano)",       texto: () => "a filiação do(a) CONTRATANTE a clube de tiro, pelo período de 1 (um) ano;",
    curto: () => "a filiação ao clube de tiro" },
  { key: "gru",     label: "Taxa do serviço (GRU)",
    texto: n => n > 1
      ? "as taxas dos serviços cobradas pela Polícia Federal, pagas por meio de GRU (Guia de Recolhimento da União);"
      : "a taxa do serviço cobrada pela Polícia Federal, paga por meio de GRU (Guia de Recolhimento da União);",
    curto: n => (n > 1 ? "as taxas GRU" : "a taxa GRU") },
];

// Formas de pagamento com um clique: o texto vai para a cláusula 5.1 e ainda pode ser editado no campo
const FORMAS_PAGAMENTO = [
  { label: "PIX",    texto: "à vista, via PIX" },
  { label: "Cartão", texto: "no cartão de crédito" },
  { label: "Boleto", texto: "por boleto bancário" },
];

function novoFormContrato(): FormContrato {
  return {
    nome: "", nacionalidade: "Brasileiro(a)", estadoCivil: "", profissao: "", cpf: "", rg: "",
    endereco: "", cep: "", cidadeUf: "", telefone: "", email: "",
    servicos: [], categoriaCR: "Atirador Desportivo", identificacaoArma: "",
    valorTotal: "1.950,00", formaPagamento: "", inclusos: INCLUSOS_CONTRATO.map(i => i.key), // valor padrão: dá para apagar e digitar outro
    foro: "Manaus/AM", local: "Manaus/AM", data: format(getSiteDate(), "yyyy-MM-dd"),
  };
}

// "1.500,00" / "1500" / "1500,5" / "1.500" → número
function lerValor(v: string): number | null {
  let s = (v || "").replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
const fmtReais = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 1500 → "mil e quinhentos reais"; 1999,99 → "mil novecentos e noventa e nove reais e noventa e nove centavos"
function valorPorExtenso(valor: number): string {
  const U = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze",
    "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const D = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const C = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  const ate999 = (n: number): string => {
    if (n === 100) return "cem";
    const partes: string[] = [];
    if (n >= 100) partes.push(C[Math.floor(n / 100)]);
    const r = n % 100;
    if (r) partes.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " e " + U[r % 10] : ""));
    return partes.join(" e ");
  };
  const inteiro = (n: number): string => {
    if (n === 0) return "zero";
    const mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), resto = n % 1000;
    const grupos: string[] = [];
    if (mi) grupos.push(mi === 1 ? "um milhão" : ate999(mi) + " milhões");
    if (mil) grupos.push(mil === 1 ? "mil" : ate999(mil) + " mil");
    if (resto) grupos.push(ate999(resto));
    if (grupos.length === 1) return grupos[0];
    // "e" antes do último grupo quando ele é menor que cem ou centena exata: mil e quinhentos, dois mil e vinte
    const ultimo = resto || mil;
    const ultimoTxt = grupos.pop()!;
    return grupos.join(" ") + (ultimo < 100 || ultimo % 100 === 0 ? " e " : " ") + ultimoTxt;
  };
  const reais = Math.floor(valor + 1e-9), centavos = Math.round((valor - reais) * 100);
  const txtReais = reais === 0 ? "" : reais === 1 ? "um real"
    : inteiro(reais) + (reais % 1e6 === 0 ? " de reais" : " reais");
  const txtCent = centavos === 0 ? "" : inteiro(centavos) + (centavos === 1 ? " centavo" : " centavos");
  return [txtReais, txtCent].filter(Boolean).join(" e ") || "zero reais";
}

// Larguras reais da Helvetica (tabela AFM, caracteres 32–255, em milésimos do tamanho da fonte):
// são as que o leitor de PDF usa. O getTextWidth do jsPDF mede até ~4% a menos nas maiúsculas,
// e com isso palavras como "CONTRATANTE" ficavam grudadas na seguinte.
const AFM_HELV = "278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500";
const AFM_HELV_B = "278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556";
const AFM_EXTRA: Record<string, [number, number]> = { "–": [556, 556], "—": [1000, 1000], "’": [222, 278], "“": [333, 500], "”": [333, 500] };
let _afm: [number[], number[]] | null = null;
// Largura do texto em mm, no tamanho de fonte (pt) informado
function larguraHelv(s: string, bold: boolean, pt: number): number {
  _afm ??= [AFM_HELV.split(",").map(Number), AFM_HELV_B.split(",").map(Number)];
  const tab = _afm[bold ? 1 : 0];
  let w = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c <= 255 ? tab[c - 32] : (AFM_EXTRA[ch]?.[bold ? 1 : 0] ?? 556);
  }
  return (w * pt) / 1000 * (25.4 / 72);
}

// Qualificação no estilo de contrato: só entra o que estiver preenchido (sem linhas em branco)
function qualificacao(p: DadosContratado & { profissao?: string }, generico: boolean): string {
  const a = (masc: string) => (generico ? `${masc}(a)` : masc);
  const minusc = (s?: string) => (s || "").trim().toLowerCase();
  const local = [p.endereco, p.cep && `CEP ${p.cep}`, p.cidadeUf].map(s => (s || "").trim()).filter(Boolean).join(", ");
  return [
    minusc(p.nacionalidade), minusc(p.estadoCivil), minusc(p.profissao),
    p.cpf && `${a("inscrito")} no CPF sob o nº ${p.cpf}`,
    p.rg && `${a("portador")} do RG nº ${p.rg}`,
    local && `${a("residente e domiciliado")} em ${local}`,
    p.telefone && `telefone/WhatsApp ${p.telefone}`,
    p.email && `e-mail ${p.email}`,
  ].filter(Boolean).join(", ");
}

async function gerarPDFContrato(f: FormContrato, ct: DadosContratado, semLogo = false) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

  let layout = await aplicarLayoutPassarinho(doc, semLogo);
  const { W, ML, CW } = layout;
  let y = layout.startY;
  const FS = 10, LH = 5;
  // O rodapé deixa a fonte em 7,5: volta ao tamanho do texto, senão o parágrafo que continua na página nova sai miúdo
  const novaPagina = async () => { doc.addPage(); layout = await aplicarLayoutPassarinho(doc, semLogo); y = layout.startY; doc.setFontSize(FS); };
  const garantir = async (h: number) => { if (y + h > layout.footerY - 8) await novaPagina(); };

  type Seg = { text: string; bold?: boolean };
  type Palavra = { text: string; style: string; w: number; colado: boolean };
  // Quebra em linhas (mesma lógica do writeInlinePara), para poder trocar de página no meio do parágrafo
  const linhasDe = (segs: Seg[], maxW: number) => {
    const palavras: Palavra[] = [];
    const pt = doc.getFontSize();
    for (const s of segs) {
      const style = s.bold ? "bold" : "normal";
      for (const t of s.text.split(/\s+/).filter(Boolean))
        palavras.push({ text: t, style, w: larguraHelv(t, !!s.bold, pt), colado: /^[,.:;!?)\]]/.test(t) });
    }
    const esp = larguraHelv(" ", false, pt);
    const linhas: Array<{ ps: Palavra[]; w: number }> = [];
    let cur = { ps: [] as Palavra[], w: 0 };
    for (const p of palavras) {
      const need = cur.w + (cur.ps.length && !p.colado ? esp : 0) + p.w;
      if (cur.ps.length && need > maxW) { linhas.push(cur); cur = { ps: [p], w: p.w }; }
      else { cur.w = need; cur.ps.push(p); }
    }
    if (cur.ps.length) linhas.push(cur);
    return { linhas, esp };
  };
  const desenhar = (l: { ps: Palavra[]; w: number }, esp: number, x: number, maxW: number, justificar: boolean) => {
    let gaps = 0;
    for (let i = 1; i < l.ps.length; i++) if (!l.ps[i].colado) gaps++;
    // Linha muito curta (palavra longa, como um e-mail, foi para a linha de baixo): não estica
    const esticar = justificar && gaps > 0 && l.w >= maxW * 0.8;
    const gapW = esp + (esticar ? (maxW - l.w) / gaps : 0);
    let cx = x;
    l.ps.forEach((p, i) => {
      doc.setFont("helvetica", p.style);
      doc.text(p.text, cx, y);
      if (i < l.ps.length - 1) cx += p.w + (l.ps[i + 1].colado ? 0 : gapW);
    });
  };
  const par = async (segs: Seg[], x = ML, w = CW, depois = 2.2) => {
    doc.setFontSize(FS);
    const { linhas, esp } = linhasDe(segs, w);
    for (let i = 0; i < linhas.length; i++) {
      await garantir(LH);
      desenhar(linhas[i], esp, x, w, i < linhas.length - 1);
      y += LH;
    }
    y += depois;
  };
  const t = (text: string): Seg => ({ text });
  const n = (text: string): Seg => ({ text, bold: true });
  const clausula = async (titulo: string) => {
    await garantir(LH * 4);
    y += 2;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
    doc.text(titulo, ML, y);
    y += 6;
  };

  // ── Título ──
  doc.setFont("helvetica", "bold"); doc.setFontSize(13.5);
  doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", W / 2, y, { align: "center" }); y += 6.5;
  doc.text("DE ASSESSORIA BÉLICA", W / 2, y, { align: "center" }); y += 10;

  // ── Partes ──
  await par([n("CONTRATANTE: "), n(f.nome.trim().toUpperCase()), t(", " + qualificacao(f, true) + ".")]);
  await par([n("CONTRATADO: "), n(ct.nome.trim().toUpperCase()), t(", " + qualificacao(ct, false) + ", que atua sob o nome PASSARINHO ASSESSORIA BÉLICA.")]);
  await par([t("As partes acima identificadas têm entre si justo e contratado o presente contrato de prestação de serviços, que se regerá pelas cláusulas a seguir.")], ML, CW, 1);

  // ── Cláusula 1 – Objeto ──
  await clausula("CLÁUSULA 1 – DO OBJETO");
  await par([t("1.1. O presente contrato tem por objeto a prestação, pelo CONTRATADO, de serviços de "),
    n("assessoria documental, protocolo, acompanhamento e diligências administrativas lícitas perante a Polícia Federal"),
    t(", buscando o deferimento dos pedidos do(a) CONTRATANTE expressamente selecionados a seguir:")], ML, CW, 1);
  const escolhidos = SERVICOS_CONTRATO.filter(s => f.servicos.includes(s.key));
  for (let i = 0; i < escolhidos.length; i++) {
    let txt = escolhidos[i].texto(f);
    if (i === escolhidos.length - 1) txt = txt.replace(/;$/, ".");
    await par([n(`${String.fromCharCode(97 + i)}) `), t(txt)], ML + 6, CW - 6, 0.6);
  }
  y += 1.6;
  let item = 2;
  if (f.identificacaoArma.trim())
    await par([t(`1.${item++}. Arma objeto do(s) pedido(s): ${f.identificacaoArma.trim()}.`)]);
  await par([t(`1.${item++}. Os serviços compreendem: a orientação sobre os documentos e requisitos exigidos e a conferência da documentação (assessoria documental); o preenchimento e o protocolo dos requerimentos nos sistemas oficiais (protocolo); o acompanhamento do andamento dos pedidos (acompanhamento); e o atendimento às exigências formuladas pela Polícia Federal relativas aos pedidos contratados (diligências administrativas).`)]);
  await par([t(`1.${item++}. Não estão incluídos neste contrato os serviços não listados no item 1.1, os recursos administrativos, os novos pedidos após eventual indeferimento e quaisquer medidas judiciais, que dependerão de novo ajuste entre as partes, bem como os atos privativos de advogado.`)]);

  // ── Cláusula 2 – Obrigações do contratado ──
  await clausula("CLÁUSULA 2 – DAS OBRIGAÇÕES DO CONTRATADO");
  await par([t("2.1. Executar os serviços com zelo, diligência e dentro da legalidade, empregando os meios adequados para buscar o deferimento dos pedidos.")]);
  await par([t("2.2. Informar ao(à) CONTRATANTE, de forma clara, quais documentos, exames e comparecimentos são necessários para cada pedido.")]);
  await par([t("2.3. Protocolar os requerimentos após receber a documentação completa e os pagamentos devidos, fornecendo ao(à) CONTRATANTE o número do protocolo.")]);
  await par([t("2.4. Acompanhar os pedidos até a decisão da Polícia Federal, mantendo o(a) CONTRATANTE informado(a) sobre exigências, decisões e prazos.")]);
  await par([t("2.5. Guardar sigilo sobre os dados e documentos recebidos, utilizando-os somente para a execução deste contrato.")]);

  // ── Cláusula 3 – Obrigações do contratante ──
  await clausula("CLÁUSULA 3 – DAS OBRIGAÇÕES DO(A) CONTRATANTE");
  await par([t("3.1. Fornecer informações verdadeiras e documentos autênticos, válidos e completos, respondendo pela veracidade de tudo o que apresentar.")]);
  // Antecedentes: se o cliente omitir inquérito/processo e o pedido for indeferido, a culpa não é do contratado (em negrito)
  await par([t("3.2. O(A) CONTRATANTE declara, sob as penas da lei, que não está respondendo a inquérito policial nem a processo criminal. Se essa declaração não for verdadeira, ou se o(a) CONTRATANTE passar a responder a inquérito ou processo durante a análise, e isso causar o indeferimento de qualquer pedido, "),
    n("o CONTRATADO não terá culpa nem responsabilidade, e os valores pagos não serão devolvidos"), t(".")]);
  await par([t("3.3. Comparecer pessoalmente, nas datas e nos locais agendados, aos exames e testes exigidos e a qualquer outro ato que dependa da sua presença, inclusive perante a Polícia Federal.")]);
  await par([t("3.4. Atender às solicitações de documentos e informações do CONTRATADO no menor prazo possível, especialmente quando houver exigência com prazo fixado pela Polícia Federal.")]);
  await par([t("3.5. Efetuar os pagamentos na forma e nos prazos previstos neste contrato.")]);
  await par([t("3.6. Comunicar ao CONTRATADO qualquer alteração em seus dados cadastrais e qualquer notificação recebida diretamente da Polícia Federal.")]);

  // ── Cláusula 4 – Natureza do serviço ──
  await clausula("CLÁUSULA 4 – DA NATUREZA DO SERVIÇO");
  await par([t("4.1. A obrigação do CONTRATADO é de meio, e não de resultado. A análise e a decisão sobre os pedidos competem exclusivamente à Polícia Federal, razão pela qual o CONTRATADO não garante o deferimento nem o prazo de conclusão da análise.")]);
  await par([t("4.2. O CONTRATADO não responde por demora, exigências, indisponibilidade de sistemas, mudanças nas normas ou indeferimentos decorrentes da atuação da Polícia Federal ou de fatos alheios à sua atuação, respondendo, porém, por falhas próprias na prestação do serviço.")]);
  await par([t("4.3. O protocolo do pedido não autoriza, por si só, a aquisição, a posse, o porte ou o transporte de arma de fogo.")]);

  // ── Cláusula 5 – Valor ──
  await clausula("CLÁUSULA 5 – DO VALOR E DA FORMA DE PAGAMENTO");
  const total = lerValor(f.valorTotal) ?? 0;
  const forma = f.formaPagamento.trim();
  await par([t("5.1. Pelos serviços contratados, o(a) CONTRATANTE pagará ao CONTRATADO o valor total de "),
    n(`R$ ${fmtReais(total)} (${valorPorExtenso(total)})`),
    t(forma ? `, da seguinte forma: ${forma.replace(/\.$/, "")}.` : ".")]);
  const inclusos = INCLUSOS_CONTRATO.filter(i => f.inclusos.includes(i.key));
  let itemValor = 2;
  if (inclusos.length) {
    await par([t(`5.${itemValor++}. Estão incluídos no valor acima, e serão providenciados e pagos pelo CONTRATADO, sem custo adicional para o(a) CONTRATANTE:`)], ML, CW, 1);
    for (let i = 0; i < inclusos.length; i++) {
      let txt = inclusos[i].texto(escolhidos.length);
      if (i === inclusos.length - 1) txt = txt.replace(/;$/, ".");
      await par([n(`${String.fromCharCode(97 + i)}) `), t(txt)], ML + 6, CW - 6, 0.6);
    }
    y += 1.6;
    await par([t(`5.${itemValor++}. Outras despesas, não listadas no item 5.2, não estão incluídas no valor deste contrato.`)]);
  } else {
    await par([t(`5.${itemValor++}. Não estão incluídos no valor acima as taxas, os exames e as demais despesas necessárias aos pedidos, que correm por conta do(a) CONTRATANTE.`)]);
  }
  // Despesas que o contratado já pagou não voltam ao cliente (indeferimento ou rescisão)
  const despesasPagas = inclusos.length ? " e às despesas do item 5.2 já pagas pelo CONTRATADO" : "";
  await par([t(`5.${itemValor++}. O indeferimento do pedido pela Polícia Federal não gera devolução dos valores referentes aos serviços já prestados${despesasPagas}, ressalvados os casos de falha do CONTRATADO.`)]);

  // ── Cláusula 6 – Vigência e rescisão ──
  await clausula("CLÁUSULA 6 – DA VIGÊNCIA E DA RESCISÃO");
  await par([t("6.1. Este contrato vigora desde a sua assinatura até a decisão final da Polícia Federal sobre os pedidos contratados e a entrega dos respectivos documentos ao(à) CONTRATANTE.")]);
  await par([t("6.2. Qualquer das partes poderá rescindir o contrato mediante comunicação por escrito, inclusive por WhatsApp ou e-mail.")]);
  // Desistência do cliente: sem devolução, em negrito para ficar bem visível (o contratado já pagou os itens do 5.2)
  const curtos = inclusos.map(i => i.curto(escolhidos.length));
  const arcaCom = curtos.length
    ? ` e arca com ${curtos.length > 1 ? curtos.slice(0, -1).join(", ") + " e " + curtos[curtos.length - 1] : curtos[0]}` : "";
  await par([t("6.3. Em caso de desistência ou rescisão por iniciativa do(a) CONTRATANTE, "), n("os valores pagos não serão devolvidos"),
    t(`. O(A) CONTRATANTE declara estar ciente de que, com a contratação, o CONTRATADO inicia a prestação dos serviços${arcaCom}, razão pela qual esses valores não têm como ser restituídos.`)]);
  await par([t(`6.4. Se a rescisão partir do CONTRATADO, sem culpa do(a) CONTRATANTE, serão devolvidos os valores correspondentes aos serviços ainda não executados${inclusos.length ? ", descontadas as despesas do item 5.2 já pagas" : ""}, em até 10 (dez) dias úteis.`)]);
  await par([t("6.5. Na rescisão, o CONTRATADO entregará ao(à) CONTRATANTE os protocolos, os documentos e as informações sobre o andamento dos pedidos.")]);

  // ── Cláusula 7 – Dados pessoais ──
  await clausula("CLÁUSULA 7 – DA PROTEÇÃO DE DADOS");
  await par([t("7.1. Os dados pessoais e documentos do(a) CONTRATANTE serão tratados exclusivamente para a execução deste contrato e para o cumprimento de obrigações legais, nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados), sendo compartilhados apenas com a Polícia Federal e com terceiros indispensáveis à prestação do serviço.")]);

  // ── Cláusula 8 – Disposições gerais ──
  await clausula("CLÁUSULA 8 – DISPOSIÇÕES GERAIS");
  await par([t("8.1. O CONTRATADO não é servidor nem possui vínculo com a Polícia Federal, não promete qualquer facilidade ou prioridade perante agentes públicos, e nenhum valor deste contrato se destina a pagamento a servidor público.")]);
  await par([t("8.2. Este contrato não envolve a compra, a venda, a guarda ou o transporte de armas e munições pelo CONTRATADO.")]);
  await par([t("8.3. Quando necessário, o(a) CONTRATANTE outorgará procuração específica ao CONTRATADO, em documento separado.")]);
  await par([t("8.4. As comunicações entre as partes poderão ser feitas pelos telefones (WhatsApp) e e-mails indicados neste contrato.")]);

  // ── Cláusula 9 – Foro ──
  await clausula("CLÁUSULA 9 – DO FORO");
  await par([t(`9.1. Fica eleito o foro da comarca de ${(f.foro || "Manaus/AM").trim()} para dirimir quaisquer questões oriundas deste contrato, ressalvado o direito do(a) CONTRATANTE de demandar no foro de seu domicílio, quando aplicável.`)]);
  await par([t("E, por estarem de acordo, as partes assinam o presente contrato eletronicamente, por meio de assinatura digital (gov.br ou ICP-Brasil), que tem plena validade jurídica.")]);

  // ── Assinaturas e, embaixo delas, local e data (bloco junto na mesma página) ──
  // Padrão dos outros PDFs: rótulo com a linha ao lado (mesma cor do layout); nome e CPF embaixo da linha.
  // Cada linha tem ~3 cm livres acima para o carimbo da assinatura digital (gov.br) de cada parte
  await garantir(98);
  const assinaturas = [["contratante", f.nome, f.cpf], ["contratado", ct.nome, ct.cpf]];
  const rotulo = (papel: string) => `Assinatura digital (.gov.br ou ICP-Brasil) ${papel}: `;
  const x0 = ML + Math.max(...assinaturas.map(([papel]) => larguraHelv(rotulo(papel), false, FS)));
  const x1 = W - layout.MR, meio = (x0 + x1) / 2;
  for (const [papel, nome, cpf] of assinaturas) {
    y += 32;
    doc.setFont("helvetica", "normal"); doc.setFontSize(FS);
    doc.text(rotulo(papel), ML, y);
    doc.line(x0, y - 0.5, x1, y - 0.5);
    const nomeUp = nome.trim().toUpperCase();
    doc.setFont("helvetica", "bold"); doc.setFontSize(Math.min(9, (9 * (x1 - x0)) / larguraHelv(nomeUp, true, 9)));
    doc.text(nomeUp, meio, y + 4.5, { align: "center" });
    if (cpf) { doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.text(`CPF ${cpf}`, meio, y + 8.6, { align: "center" }); }
    y += 9;
  }
  const dataExt = f.data ? format(parseISO(f.data), "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : "";
  y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(FS);
  doc.text(`${(f.local || "Manaus/AM").trim()}, ${dataExt}.`, W - layout.MR, y, { align: "right" });

  // "CR Contrato de Assessoria - Fulano"; com mais de um serviço, "CR + Autorização Contrato de Assessoria - Fulano"
  const nomeArq = titleCase((f.nome || "Cliente").toLowerCase());
  const prefixo = escolhidos.map(s => s.prefixo).join(" + ");
  return await salvarPDF(doc, `${prefixo ? prefixo + " " : ""}Contrato de Assessoria - ${nomeArq}.pdf`);
}

// Caixa "Importar ..." do cadastro do cliente: aceita PDF ou foto pelo botão ou arrastando o arquivo para ela
function CaixaImportar({ titulo, descricao, lendo, progresso, onArquivo }: {
  titulo: string; descricao: string; lendo: boolean; progresso: string; onArquivo: (f: File) => void;
}) {
  const [arrastando, setArrastando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const soltar = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setArrastando(false);
    const f = e.dataTransfer.files?.[0];
    if (!f || lendo) return;
    if (f.type === "application/pdf" || f.type.startsWith("image/") || /\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(f.name)) onArquivo(f);
    else sonnerToast.error("Arquivo não aceito: arraste um PDF ou uma foto.");
  };
  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border border-dashed transition-colors ${arrastando ? "border-primary bg-primary/15" : "border-primary/40 bg-primary/5"}`}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; if (!arrastando) setArrastando(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false); }}
      onDrop={soltar}>
      <div>
        <p className="text-xs font-semibold text-primary">{arrastando ? "Solte o arquivo aqui" : titulo}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{descricao}</p>
      </div>
      <Button type="button" size="sm" variant="outline"
        className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10 shrink-0"
        onClick={() => ref.current?.click()}
        disabled={lendo}>
        <Paperclip className="h-3.5 w-3.5" />
        {lendo ? (progresso || "Lendo...") : "Selecionar arquivo"}
      </Button>
      <input ref={ref} type="file" accept="application/pdf,image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onArquivo(f); e.target.value = ""; }} />
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex-shrink-0 p-0.5 rounded text-muted-foreground hover:text-primary transition-colors"
      title="Copiar"
    >
      {copied
        ? <Check className="h-3 w-3 text-green-500" />
        : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ─── Seletor de cliente reutilizável (pesquisa igual à de Laudos) ─────────
function ClienteSelector({ clientes, label, onSelect }: {
  clientes: Cliente[];
  label: string;
  onSelect: (c: Cliente) => void;
}) {
  if (clientes.length === 0) return null;
  return <BuscaCliente clientes={clientes} label={label} onSelect={onSelect} />;
}

// ─── Helpers DB ────────────────────────────────────────────────────────────
function rowToCliente(row: Record<string, unknown>): Cliente {
  return {
    id: row.id as string,
    nome: (row.nome as string) ?? "",
    rg: (row.rg as string) ?? "",
    orgaoEmissor: (row.orgao_emissor as string) ?? "SSP-AM",
    dataExpedicao: (row.data_expedicao as string) ?? "",
    cpf: (row.cpf as string) ?? "",
    nomePai: ((row.nome_pai as string) ?? "").toUpperCase(),
    nomeMae: ((row.nome_mae as string) ?? "").toUpperCase(),
    estadoCivil: (row.estado_civil as string) ?? "Solteiro(a)",
    dataNascimento: (row.data_nascimento as string) ?? "",
    localNascimento: (row.local_nascimento as string) ?? "",
    ufNascimento: (row.uf_nascimento as string) ?? "AM",
    endereco: (row.endereco as string) ?? "",
    numero: (row.numero as string) ?? "",
    complemento: (row.complemento as string) ?? "",
    bairro: (row.bairro as string) ?? "",
    cep: (row.cep as string) ?? "",
    cidade: (row.cidade as string) ?? "Manaus",
    estado: (row.estado as string) ?? "AM",
    email: (row.email as string) ?? "",
    telefone: maskTelefone((row.telefone as string) ?? ""),
    profissao: (row.profissao as string) ?? "",
    tipo_ocupacao: (row.tipo_ocupacao as string) ?? "",
    senhaGov: (row.senha_gov as string) ?? "",
    dataEntradaProcesso: (row.data_entrada_processo as string) ?? "",
    dataDeferimento: (row.data_deferimento as string) ?? "",
    nomeClube: (row.nome_clube as string) ?? "",
    loginClube: (row.login_clube as string) ?? "",
    senhaClube: (row.senha_clube as string) ?? "",
  };
}

// ─── Componente principal ──────────────────────────────────────────────────
// Converte DD/MM/YYYY colado para YYYY-MM-DD esperado pelo input type="date"
function onPasteDate(e: React.ClipboardEvent<HTMLInputElement>, setter: (v: string) => void) {
  const txt = e.clipboardData.getData("text").trim();
  const m = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    e.preventDefault();
    setter(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  }
}

function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function DocPreviewModal({ url, nome, onClose }: { url: string; nome: string; onClose: () => void }) {
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(nome);
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="max-w-[96vw] w-[96vw] h-[94vh] p-0 gap-0 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 pr-12 border-b border-border/40 flex-shrink-0">
          <DialogTitle className="text-sm font-semibold truncate flex-1">{nome}</DialogTitle>
          <a href={url} download={nome} className="text-xs px-3 py-1.5 rounded-md border border-border/60 hover:bg-muted flex items-center gap-1.5 flex-shrink-0">
            <Download className="h-3.5 w-3.5" /> Baixar
          </a>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center bg-black/40">
          {isImage
            ? <img src={url} alt={nome} className="max-w-full max-h-full object-contain" />
            : <iframe src={url} title={nome} className="w-full h-full border-0 bg-white" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Declaracoes() {
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const [userId, setUserId] = useState<string | null>(null);
  const [restoreKey, setRestoreKey] = useState(0);

  useEffect(() => {
    usuarioAtual().then(user => setUserId(user?.id ?? null));
  }, []);

  // Migração: adiciona owner_id e atualiza RLS — roda só uma vez por browser
  useEffect(() => {
    if (localStorage.getItem("schema_migration_v4")) return;
    supabase.functions.invoke("run-migration", {
      body: {
        sql: `DO $$ BEGIN
  ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
  DROP POLICY IF EXISTS "Admins and moderators can select declaracao_clientes" ON public.declaracao_clientes;
  DROP POLICY IF EXISTS "Admins and moderators can insert declaracao_clientes" ON public.declaracao_clientes;
  DROP POLICY IF EXISTS "Admins and moderators can update declaracao_clientes" ON public.declaracao_clientes;
  DROP POLICY IF EXISTS "Admins and moderators can delete declaracao_clientes" ON public.declaracao_clientes;
  DROP POLICY IF EXISTS "Owners or admins insert" ON public.declaracao_clientes;
  DROP POLICY IF EXISTS "Owners or admins select" ON public.declaracao_clientes;
  DROP POLICY IF EXISTS "Owners or admins update" ON public.declaracao_clientes;
  DROP POLICY IF EXISTS "Owners or admins delete" ON public.declaracao_clientes;
  CREATE POLICY "dc_select" ON public.declaracao_clientes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'moderator') AND owner_id = auth.uid()));
  CREATE POLICY "dc_insert" ON public.declaracao_clientes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
  CREATE POLICY "dc_update" ON public.declaracao_clientes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'moderator') AND owner_id = auth.uid()));
  CREATE POLICY "dc_delete" ON public.declaracao_clientes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'moderator') AND owner_id = auth.uid()));
  PERFORM pg_notify('pgrst', 'reload schema');
  UPDATE public.declaracao_clientes
    SET owner_id = (SELECT id FROM auth.users WHERE email = 'iat.renilson.martins@gmail.com' LIMIT 1)
    WHERE owner_id IS NULL;
END $$;`
      }
    }).then(() => localStorage.setItem("schema_migration_v4", "1")).catch(() => {});
  }, []);

  // Migração v5: adiciona colunas de nascimento, telefone, profissão e campos clube
  useEffect(() => {
    if (localStorage.getItem("schema_migration_v5")) return;
    supabase.functions.invoke("run-migration", {
      body: {
        sql: `DO $$ BEGIN
  ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS local_nascimento TEXT NOT NULL DEFAULT '';
  ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS uf_nascimento    TEXT NOT NULL DEFAULT 'AM';
  ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS telefone         TEXT NOT NULL DEFAULT '';
  ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS profissao        TEXT NOT NULL DEFAULT '';
  ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS email            TEXT NOT NULL DEFAULT '';
  ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS nome_clube       TEXT NOT NULL DEFAULT '';
  ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS login_clube      TEXT NOT NULL DEFAULT '';
  ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS senha_clube      TEXT NOT NULL DEFAULT '';
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;`
      }
    }).then(() => localStorage.setItem("schema_migration_v5", "1")).catch(() => {});
  }, []);

  // Migração v7: adiciona tipo_ocupacao (v7 para forçar rerun caso v6 tenha falhado silenciosamente)
  useEffect(() => {
    if (localStorage.getItem("schema_migration_v7")) return;
    supabase.functions.invoke("run-migration", {
      body: { sql: `ALTER TABLE public.declaracao_clientes ADD COLUMN IF NOT EXISTS tipo_ocupacao TEXT NOT NULL DEFAULT '';` }
    }).then(({ error }) => {
      if (!error) localStorage.setItem("schema_migration_v7", "1");
    }).catch(() => {});
  }, []);

  // Correção única: restaura clientes do admin que foram incorretamente migrados para parabellum
  useEffect(() => {
    if (!isAdmin || !userId) return;
    const FLAG = "owner_restore_v2";
    if (localStorage.getItem(FLAG)) return;
    supabase.functions.invoke("run-migration", {
      body: {
        sql: `UPDATE public.declaracao_clientes
  SET owner_id = (SELECT id FROM auth.users WHERE email = 'iat.renilson.martins@gmail.com' LIMIT 1)
  WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'parabellum.assessoria7@gmail.com' LIMIT 1)
    AND nome NOT ILIKE '%PATRIK%FERNANDES%GOMES%';`
      }
    }).then(() => {
      localStorage.setItem(FLAG, "1");
      setRestoreKey(k => k + 1);
    }).catch(() => {});
  }, [isAdmin, userId]);

  // Auto-provisiona papel de moderador para glendaleite88@gmail.com
  useEffect(() => {
    if (!isAdmin) return;
    const MODERATOR_EMAIL = "glendaleite88@gmail.com";
    (async () => {
      try {
        // Busca o user_id pelo email na tabela profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("email", MODERATOR_EMAIL)
          .maybeSingle();
        if (!profile?.user_id) return; // Usuário ainda não fez login
        // Verifica se já tem o papel de moderador
        const { data: existing } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.user_id)
          .eq("role", "moderator")
          .maybeSingle();
        if (existing) return; // Já tem o papel
        // Insere o papel de moderador (admin tem permissão via RLS)
        await supabase.from("user_roles").insert({
          user_id: profile.user_id,
          role: "moderator",
        });
      } catch { /* silencioso */ }
    })();
  }, [isAdmin]);

  // Clientes cadastrados — inicia do cache para não piscar "Carregando" ao voltar
  const [clientes, setClientes] = useState<Cliente[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("decl_clientes_cache") ?? "[]"); } catch { return []; }
  });
  const [loadingClientes, setLoadingClientes] = useState(
    () => sessionStorage.getItem("decl_clientes_cache") === null
  );
  const [dialogClienteOpen, setDialogClienteOpen] = useState(false);
  const [mostrarClientes, setMostrarClientes] = useState(true);
  const [dadosVisiveis, setDadosVisiveis] = useState(true);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [filtroStatusBadge, setFiltroStatusBadge] = useState<ClienteStatus | null>(null);
  // Abre sempre em grade (pedido do usuário); o botão troca para lista só até sair da página
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const toggleViewMode = () => setViewMode(prev => (prev === "grid" ? "list" : "grid"));
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formCliente, setFormCliente] = useState<ClienteForm>(EMPTY_CLIENTE);
  const [savingCliente, setSavingCliente] = useState(false);
  const [mostrarClubeSection, setMostrarClubeSection] = useState(false);
  const [mostrarSenhaClubeForm, setMostrarSenhaClubeForm] = useState(false);
  const [parsendoCNH, setParsendoCNH] = useState(false);
  const [progressoDoc, setProgressoDoc] = useState("");
  const [lendoComprovante, setLendoComprovante] = useState(false);
  const [progressoComprovante, setProgressoComprovante] = useState("");
  // Documentos CR
  const [docsCliente, setDocsCliente] = useState<Map<string, DocCRItem[]>>(new Map());
  const [uploadingDocTipo, setUploadingDocTipo] = useState<string | null>(null);
  const [abaDashboard, setAbaDashboard] = useState(false);
  const [abaDocsForm, setAbaDocsForm] = useState(false);
  const docUploadRef = useRef<HTMLInputElement>(null);
  const [docUploadTipo, setDocUploadTipo] = useState<string>("");
  const [subTipoDialogOpen, setSubTipoDialogOpen] = useState(false);
  const [subTipoPendente, setSubTipoPendente] = useState<string>("");
  const docLoteRef = useRef<HTMLInputElement>(null);
  const [uploadingLote, setUploadingLote] = useState(false);
  const [loteSubTipoDialogOpen, setLoteSubTipoDialogOpen] = useState(false);
  const [loteSubTipoArquivo, setLoteSubTipoArquivo] = useState("");
  const [loteSubTipoDocId, setLoteSubTipoDocId] = useState("");
  const loteSubTipoResolveRef = useRef<((v: string) => void) | null>(null);
  const [inqTipoDialogOpen, setInqTipoDialogOpen] = useState(false);
  const inqTipoResolveRef = useRef<((v: string) => void) | null>(null);
  const [docPreview, setDocPreview] = useState<{ url: string; nome: string } | null>(null);

  const importarDocumento = useCallback(async (file: File) => {
    setParsendoCNH(true);
    setProgressoDoc("Abrindo documento...");
    try {
      const d = await lerDocumento(file, setProgressoDoc);
      const novos: Partial<ClienteForm> = {};
      if (d.nome) novos.nome = d.nome;
      if (d.cpf) novos.cpf = maskCpf(d.cpf);
      if (d.rg) novos.rg = d.rgEhCpf ? maskCpf(d.rg) : maskRg(d.rg);
      if (d.orgaoEmissor) novos.orgaoEmissor = d.orgaoEmissor;
      if (d.dataExpedicao) novos.dataExpedicao = d.dataExpedicao;
      if (d.dataNascimento) novos.dataNascimento = d.dataNascimento;
      if (d.localNascimento) novos.localNascimento = d.localNascimento;
      if (d.ufNascimento) novos.ufNascimento = d.ufNascimento;
      if (d.nomePai) novos.nomePai = d.nomePai;
      if (d.nomeMae) novos.nomeMae = d.nomeMae;
      if (d.estadoCivil) novos.estadoCivil = d.estadoCivil;
      const n = Object.keys(novos).length;
      if (n > 0) {
        // o "SSP-AM" padrão não pode parecer lido do documento
        setFormCliente(prev => ({
          ...prev, ...novos,
          ...(!d.orgaoEmissor && prev.orgaoEmissor === EMPTY_CLIENTE.orgaoEmissor ? { orgaoEmissor: "" } : {}),
        }));
        sonnerToast.success(`✓ ${n} campo(s) preenchido(s) a partir do documento. Confira antes de salvar.`
          + (d.orgaoEmissor ? "" : " Órgão emissor não encontrado no documento: preencha à mão."));
      } else {
        sonnerToast.warning("Não consegui ler os dados. Envie o PDF original da CNH/RG ou uma foto mais nítida.");
      }
    } catch (err) {
      sonnerToast.error("Erro ao ler o documento: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setParsendoCNH(false);
      setProgressoDoc("");
    }
  }, []);

  // Comprovante de residência: endereço lido da conta e completado pelo ViaCEP (rua por extenso, bairro com acento,
  // cidade e UF). O endereço tem que bater com o comprovante: rua e bairro do ViaCEP só entram quando são os mesmos
  // da conta (o CEP pode ser da rua principal ou do condomínio); senão vale o que está na conta.
  const importarComprovante = useCallback(async (file: File) => {
    setLendoComprovante(true);
    setProgressoComprovante("Abrindo comprovante...");
    try {
      const d = await lerComprovanteEndereco(file, setProgressoComprovante);
      if (!d.cep && !d.logradouro) {
        sonnerToast.warning("Não consegui ler o endereço. Envie o PDF da conta (do aplicativo ou site da empresa) ou uma foto mais nítida.");
        return;
      }
      const via = d.cep ? await buscarCep(d.cep) : null;
      const TIPOS = /^(RUA|AVENIDA|ALAMEDA|TRAVESSA|BECO|ESTRADA|RODOVIA|CONJUNTO|CONDOMINIO|LARGO|VILA|PRACA)$/;
      const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
      // palavras que identificam o nome (numeral romano e número contam: "BERMUDAS I" não é "BERMUDAS")
      const palavras = (s: string) => norm(s).filter(p => !TIPOS.test(p) && !/^(DE|DA|DO|DAS|DOS|E)$/.test(p) && (p.length >= 3 || /^([IVX]+|\d+)$/.test(p)));
      // "COL SANTO ANTONIO" = "Colônia Santo Antônio"; "TRAVESSA BERMUDAS I" ≠ "Rua Bermudas"
      const bate = (conta?: string, viacep?: string) => {
        if (!conta || !viacep) return false;
        const ta = norm(conta)[0], tb = norm(viacep)[0];
        if (TIPOS.test(ta ?? "") && TIPOS.test(tb ?? "") && ta !== tb) return false;
        const a = palavras(conta), b = palavras(viacep);
        return a.length > 0 && a.every(p => b.some(q => q.startsWith(p))) && b.every(q => a.some(p => q.startsWith(p)));
      };
      const rua = via?.logradouro && (!d.logradouro || bate(d.logradouro, via.logradouro)) ? via.logradouro : d.logradouro;
      const bairro = via?.bairro && (!d.bairro || bate(d.bairro, via.bairro)) ? via.bairro : d.bairro;
      const iniciais = (s: string) => titleCase(s.toLowerCase());
      const novos: Partial<ClienteForm> = {};
      if (d.cep) novos.cep = maskCep(d.cep);
      if (rua) novos.endereco = iniciais(rua);
      if (d.numero) novos.numero = d.numero;
      if (d.complemento) novos.complemento = d.complemento.toUpperCase();
      if (bairro) novos.bairro = iniciais(bairro);
      const cidade = via?.localidade || (d.cidade ? iniciais(d.cidade) : "");
      if (cidade) novos.cidade = cidade;
      const uf = via?.uf || d.uf;
      if (uf) novos.estado = uf.toUpperCase();
      setFormCliente(prev => ({ ...prev, ...novos }));
      sonnerToast.success(`✓ ${Object.keys(novos).length} campo(s) do endereço preenchido(s) pelo comprovante. Confira antes de salvar.`
        + (d.numero ? "" : " Número não encontrado no comprovante: preencha à mão."));
    } catch (err) {
      sonnerToast.error("Erro ao ler o comprovante: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLendoComprovante(false);
      setProgressoComprovante("");
    }
  }, []);

  // ─── Documentos CR ────────────────────────────────────────────────────────
  const fetchDocsCR = useCallback(async (clienteId: string) => {
    const { data } = await supabase.from("declaracao_docs_cr").select("*").eq("cliente_id", clienteId);
    if (data) setDocsCliente(prev => new Map(prev).set(clienteId, (data as DocCRRow[]).map(toDocCRItem)));
  }, []);

  const uploadDocCR = useCallback(async (clienteId: string, tipo: string, file: File, subTipo?: string) => {
    setUploadingDocTipo(tipo);
    try {
      // Comprovante de residência (e o do 2º endereço) enviado como foto: anexa já convertido em PDF
      if ((tipo === "comp_residencia" || tipo === "comp_2_end") && (file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name))) {
        try { file = await fotoParaPDF(file); }
        catch { sonnerToast.warning("Não consegui converter a foto em PDF; ela foi anexada como imagem."); }
      }
      const ext = file.name.split(".").pop() ?? "pdf";
      const docDef = DOCS_CR.find(d => d.id === tipo);
      const displayName = docDef
        ? `${docDef.label.replace(/[/\\?%*:|"<>]/g, "-")}${subTipo ? ` - ${subTipo}` : ""}.${ext}`
        : file.name;
      const path = `${clienteId}/${tipo}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("cac-docs").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("cac-docs").getPublicUrl(path);
      await supabase.from("declaracao_docs_cr").upsert(
        { cliente_id: clienteId, tipo, file_name: displayName, storage_path: path, file_url: publicUrl },
        { onConflict: "cliente_id,tipo" }
      );
      setDocsCliente(prev => {
        const cur = (prev.get(clienteId) ?? []).filter(d => d.tipo !== tipo);
        cur.push({ id: "", tipo: tipo as DocCRTipo, fileName: displayName, storagePath: path, fileUrl: publicUrl });
        return new Map(prev).set(clienteId, cur);
      });
      sonnerToast.success("Documento enviado!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err);
      sonnerToast.error(`Erro ao enviar: ${msg}`);
    }
    finally { setUploadingDocTipo(null); }
  }, []);

  const deleteDocCR = useCallback(async (clienteId: string, tipo: string, storagePath: string) => {
    await supabase.storage.from("cac-docs").remove([storagePath]);
    await supabase.from("declaracao_docs_cr").delete().eq("cliente_id", clienteId).eq("tipo", tipo);
    setDocsCliente(prev => {
      const cur = (prev.get(clienteId) ?? []).filter(d => d.tipo !== tipo);
      return new Map(prev).set(clienteId, cur);
    });
    sonnerToast.success("Documento removido.");
  }, []);

  // Detecta o tipo de doc CR pelo nome do arquivo
  function detectarTipoPorNome(fileName: string): DocCRTipo | null {
    const n = norm(fileName);
    if (n.includes("federal"))                                        return "ant_federal";
    if (n.includes("estadual"))                                       return "ant_estadual";
    if (n.includes("eleitoral"))                                      return "ant_eleitoral";
    if (n.includes("militar"))                                        return "ant_militar";
    if (n.includes("habitualidade") || n.includes("habitual"))        return "decl_habitualidade";
    if (n.includes("filiacao") || n.includes("filiaca") || n.includes("clube") || n.includes("entidade de tiro")) return "comp_filiacao";
    if (n.includes("inquerito") || n.includes("processo criminal") || n.includes("nao estar")) return "decl_inquerito";
    if (n.includes("psico") || n.includes("laudo psic") || n.includes("aptidao")) return "laudo_psico";
    if (n.includes("capacidade tecnica") || n.includes("cap tec") || n.includes("cap tecnica")) return "cap_tecnica";
    if (n.includes("segundo end") || n.includes("2 end") || n.includes("guarda do acervo") || n.includes("comp 2")) return "comp_2_end";
    if (n.includes("residencia") || n.includes("residenc"))           return "comp_residencia";
    if (n.includes("ocupacao") || n.includes("ocupac") || n.includes("aposentad") || n.includes("licit")) return "comp_ocupacao";
    return null;
  }

  function pedirSubTipoLote(fileName: string, docId: string): Promise<string> {
    setLoteSubTipoArquivo(fileName);
    setLoteSubTipoDocId(docId);
    setLoteSubTipoDialogOpen(true);
    return new Promise(resolve => { loteSubTipoResolveRef.current = resolve; });
  }

  // Cliente novo ainda não tem id: os documentos escolhidos ficam pendentes e são enviados logo depois de salvar
  const [docsPendentes, setDocsPendentes] = useState<Map<string, { file: File; subTipo?: string }>>(new Map());
  const enviarDocCR = async (tipo: string, file: File, subTipo?: string) => {
    if (editandoId) return uploadDocCR(editandoId, tipo, file, subTipo);
    setDocsPendentes(prev => new Map(prev).set(tipo, { file, subTipo }));
  };
  const enviarPendentes = async (clienteId: string) => {
    for (const [tipo, { file, subTipo }] of docsPendentes) await uploadDocCR(clienteId, tipo, file, subTipo);
    setDocsPendentes(new Map());
  };

  const uploadEmLote = async (files: FileList | File[]) => {
    setUploadingLote(true);
    const arr = Array.from(files);
    const naoReconhecidos: string[] = [];
    for (const file of arr) {
      const tipo = detectarTipoPorNome(file.name);
      if (!tipo) { naoReconhecidos.push(file.name); continue; }
      let subTipo: string | undefined;
      if (tipo === "comp_residencia" || tipo === "comp_2_end" || tipo === "comp_ocupacao") {
        subTipo = await pedirSubTipoLote(file.name, tipo);
      }
      await enviarDocCR(tipo, file, subTipo);
    }
    setUploadingLote(false);
    const ok = arr.length - naoReconhecidos.length;
    const feito = editandoId ? "enviados" : "separados (vão ser enviados ao salvar o cliente)";
    if (naoReconhecidos.length > 0) {
      sonnerToast.warning(`${ok} ${feito}. Não reconhecidos: ${naoReconhecidos.join(", ")}`);
    } else {
      sonnerToast.success(`${ok} documento(s) ${feito}.`);
    }
  };

  // Arquivo arrastado para os Documentos CR: solto num documento, entra como aquele documento (igual ao botão dele);
  // solto na caixa de "vários arquivos", cada um vai pelo nome (detecção automática). Aceita o mesmo que os botões.
  const [arrastandoDocCR, setArrastandoDocCR] = useState<string | null>(null);
  const arrastarSobreDocCR = (e: React.DragEvent, alvo: string) => {
    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy";
    if (arrastandoDocCR !== alvo) setArrastandoDocCR(alvo);
  };
  const sairDoArrasteDocCR = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastandoDocCR(null);
  };
  const soltarDocCR = async (e: React.DragEvent, alvo: string) => {
    e.preventDefault(); e.stopPropagation(); setArrastandoDocCR(null);
    const arquivos = Array.from(e.dataTransfer.files ?? []);
    const validos = arquivos.filter(f => f.type === "application/pdf" || f.type.startsWith("image/") || /\.(pdf|jpe?g|png|webp)$/i.test(f.name));
    if (validos.length < arquivos.length) sonnerToast.warning("Só PDF ou foto (JPG, PNG): os outros arquivos ficaram de fora.");
    if (!validos.length) return;
    if (alvo === "lote") { await uploadEmLote(validos); return; }
    if (validos.length > 1) sonnerToast.info("Um documento por vez: usei o primeiro arquivo. Para vários, solte na caixa de cima.");
    const precisaSubTipo = alvo === "comp_residencia" || alvo === "comp_2_end" || alvo === "comp_ocupacao";
    const subTipo = precisaSubTipo ? await pedirSubTipoLote(validos[0].name, alvo) : undefined;
    if (precisaSubTipo && !subTipo) return; // fechou a escolha do tipo: não envia (igual ao botão)
    await enviarDocCR(alvo, validos[0], subTipo);
  };

  // Salva clientes na tabela compartilhada declaracao_clientes (acessível por admin e moderador)
  // Retorna true se salvou com sucesso, false caso contrário
  const saveClientesToCloud = useCallback(async (list: Cliente[]): Promise<boolean> => {
    if (list.length === 0) return true;
    try {
      const me = await usuarioAtual();
      const myId = me?.id ?? "";
      const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const rows = list.map(c => ({
        ...(isUUID(c.id) ? { id: c.id } : {}),
        ...(myId ? { owner_id: myId } : {}),
        nome: c.nome,
        rg: c.rg,
        orgao_emissor: c.orgaoEmissor,
        data_expedicao: c.dataExpedicao,
        cpf: c.cpf,
        nome_pai: c.nomePai,
        nome_mae: c.nomeMae,
        estado_civil: c.estadoCivil,
        data_nascimento: c.dataNascimento,
        local_nascimento: c.localNascimento,
        uf_nascimento: c.ufNascimento,
        endereco: c.endereco,
        numero: c.numero,
        complemento: c.complemento,
        bairro: c.bairro,
        cep: c.cep,
        cidade: c.cidade,
        estado: c.estado,
        email: c.email || null,
        telefone: c.telefone || null,
        profissao: c.profissao || null,
        ...(c.tipo_ocupacao ? { tipo_ocupacao: c.tipo_ocupacao } : {}),
        senha_gov: c.senhaGov,
        data_entrada_processo: c.dataEntradaProcesso || null,
        data_deferimento: c.dataDeferimento || null,
        nome_clube: c.nomeClube,
        login_clube: c.loginClube,
        senha_clube: c.senhaClube,
        status: c.status ?? "doc",
        status2: c.status2 ?? "doc",
      }));
      const { error } = await supabase.from("declaracao_clientes").upsert(rows, { onConflict: "id" });
      if (error) {
        console.error("[saveClientesToCloud] upsert error:", error.message, error);
        const rowsSemStatus = rows.map(({ status: _s, status2: _s2, ...r }) => r);
        const { error: error2 } = await supabase.from("declaracao_clientes").upsert(rowsSemStatus, { onConflict: "id" });
        if (error2) {
          console.error("[saveClientesToCloud] fallback error:", error2.message);
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const exportarExcel = async () => {
    if (clientes.length === 0) { toast({ title: "Nenhum cliente para exportar", variant: "destructive" }); return; }
    toast({ title: "Gerando planilha..." });

    const fmtD = (d: string) => { try { return d ? format(parseISO(d), "dd/MM/yyyy") : ""; } catch { return d ?? ""; } };
    const fmtS = (s?: string) => ({ doc: "Doc. CR", docaut: "Doc. Aut.", deferido: "CR defer.", analise: "CR Analise", autor: "Aut. Analise", craf: "Craf. Analise", doccraf: "Doc Craf", completo: "Concluído" }[s ?? "doc"] ?? "");

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "SINARM CAC";
    const ws = wb.addWorksheet("Clientes SINARM CAC", { views: [{ state: "frozen", ySplit: 4 }] });

    const thin = { style: "thin" as const, color: { argb: "FFD0D0D0" } };
    const border = { top: thin, bottom: thin, left: thin, right: thin };
    const boldWhite = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };

    // ── Linha 1: Título ────────────────────────────────────────────────────────
    ws.mergeCells("A1:Z1");
    const titleCell = ws.getCell("A1");
    titleCell.value = "CLIENTES SINARM CAC";
    titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3A5C" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 32;

    // ── Linha 2: Info ──────────────────────────────────────────────────────────
    ws.mergeCells("A2:Z2");
    const infoCell = ws.getCell("A2");
    infoCell.value = `Total: ${clientes.length} cliente(s)   |   Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`;
    infoCell.font = { size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    infoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D5986" } };
    infoCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 20;

    // ── Linha 3: Grupos de colunas ────────────────────────────────────────────
    const groupRow = ws.getRow(3);
    groupRow.height = 18;
    const groups = [
      { label: "", cols: 1, color: "FF3D3D3D" },           // Nº
      { label: "IDENTIFICAÇÃO", cols: 5, color: "FF1A3A5C" },
      { label: "DADOS PESSOAIS", cols: 6, color: "FF1A5C44" },
      { label: "ENDEREÇO", cols: 7, color: "FF5C3D1A" },
      { label: "PROCESSO", cols: 5, color: "FF4A1A5C" },
      { label: "CLUBE", cols: 2, color: "FF1A4A5C" },
    ];
    let col = 1;
    for (const g of groups) {
      if (g.cols > 1) {
        const start = ws.getColumn(col).letter;
        const end = ws.getColumn(col + g.cols - 1).letter;
        ws.mergeCells(`${start}3:${end}3`);
      }
      const cell = groupRow.getCell(col);
      cell.value = g.label;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: g.color } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      col += g.cols;
    }

    // ── Linha 4: Cabeçalhos ────────────────────────────────────────────────────
    const colDefs = [
      { header: "Nº",                  width: 5,  color: "FF4A4A4A" },
      { header: "Nome Completo",        width: 32, color: "FF1E4A70" },
      { header: "CPF",                  width: 14, color: "FF1E4A70" },
      { header: "RG",                   width: 14, color: "FF1E4A70" },
      { header: "Órgão Emissor",        width: 12, color: "FF1E4A70" },
      { header: "Data Expedição",       width: 14, color: "FF1E4A70" },
      { header: "Nome do Pai",          width: 26, color: "FF1E6B4A" },
      { header: "Nome da Mãe",          width: 26, color: "FF1E6B4A" },
      { header: "Estado Civil",         width: 14, color: "FF1E6B4A" },
      { header: "Data Nasc.",           width: 12, color: "FF1E6B4A" },
      { header: "Local Nasc.",          width: 18, color: "FF1E6B4A" },
      { header: "UF Nasc.",             width: 9,  color: "FF1E6B4A" },
      { header: "Endereço",             width: 28, color: "FF704A1E" },
      { header: "Nº",                   width: 7,  color: "FF704A1E" },
      { header: "Complemento",          width: 16, color: "FF704A1E" },
      { header: "Bairro",               width: 18, color: "FF704A1E" },
      { header: "CEP",                  width: 11, color: "FF704A1E" },
      { header: "Cidade",               width: 16, color: "FF704A1E" },
      { header: "Estado",               width: 8,  color: "FF704A1E" },
      { header: "Data Entrada",         width: 13, color: "FF5C1E70" },
      { header: "Data Deferimento",     width: 16, color: "FF5C1E70" },
      { header: "Situação Doc",         width: 13, color: "FF5C1E70" },
      { header: "Situação Processo",    width: 18, color: "FF5C1E70" },
      { header: "Senha Gov",            width: 14, color: "FF5C1E70" },
      { header: "Nome Clube",           width: 20, color: "FF1E5C70" },
      { header: "Login Clube",          width: 20, color: "FF1E5C70" },
    ];

    ws.columns = colDefs.map(c => ({ width: c.width }));
    const hdrRow = ws.getRow(4);
    hdrRow.height = 22;
    colDefs.forEach((def, i) => {
      const cell = hdrRow.getCell(i + 1);
      cell.value = def.header;
      cell.font = boldWhite;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: def.color } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
      cell.border = border;
    });

    // Ativa filtro automático na linha de cabeçalhos
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: colDefs.length } };

    // ── Dados ──────────────────────────────────────────────────────────────────
    const statusFill: Record<string, string> = {
      deferido: "FFC6EFCE",
      analise:  "FFFFEB9C",
      docaut:   "FFDCE6F1",
      doc:      "FFFFFFFF",
      autor:    "FFFFE0B2",
      craf:     "FFE0F7FA",
    };

    clientes.forEach((c, i) => {
      const isEven = i % 2 === 0;
      const baseFill = isEven ? "FFF5F8FF" : "FFFFFFFF";
      const statusKey = c.status ?? "doc";

      const row = ws.addRow([
        i + 1, c.nome, c.cpf, c.rg, c.orgaoEmissor, fmtD(c.dataExpedicao),
        c.nomePai, c.nomeMae, c.estadoCivil,
        fmtD(c.dataNascimento), c.localNascimento, c.ufNascimento,
        c.endereco, c.numero, c.complemento, c.bairro, c.cep, c.cidade, c.estado,
        fmtD(c.dataEntradaProcesso), fmtD(c.dataDeferimento),
        fmtS(c.status), fmtS(c.status2), c.senhaGov,
        c.nomeClube, c.loginClube,
      ]);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.border = border;
        cell.font = { size: 10, name: "Calibri" };
        cell.alignment = { vertical: "middle", wrapText: false };
        // Colunas de situação recebem cor do status
        if (colNum === 22 || colNum === 23) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill[statusKey] ?? "FFFFFFFF" } };
          cell.font = { size: 10, name: "Calibri", bold: true };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseFill } };
        }
        if (colNum === 1) cell.alignment = { horizontal: "center", vertical: "middle" };
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_sinarm_${format(new Date(), "dd-MM-yyyy")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Planilha gerada: ${clientes.length} cliente(s)` });
  };

  const fetchClientes = useCallback(async () => {
    try {
      const me = await usuarioAtual();
      const myId = me?.id ?? "";
      if (!myId) return;
      // Busca apenas clientes do próprio usuário
      const { data: rows, error } = await supabase
        .from("declaracao_clientes")
        .select("*")
        .eq("owner_id", myId)
        .order("nome", { ascending: true });

      if (!error && rows && rows.length > 0) {
        const clientes: Cliente[] = rows.map((r: any) => ({
          id: r.id,
          nome: r.nome,
          rg: r.rg,
          orgaoEmissor: r.orgao_emissor,
          dataExpedicao: r.data_expedicao,
          cpf: r.cpf,
          nomePai: (r.nome_pai ?? "").toUpperCase(),
          nomeMae: (r.nome_mae ?? "").toUpperCase(),
          estadoCivil: r.estado_civil,
          dataNascimento: r.data_nascimento,
          localNascimento: r.local_nascimento ?? "",
          ufNascimento: r.uf_nascimento ?? "AM",
          endereco: r.endereco,
          numero: r.numero,
          complemento: r.complemento ?? "",
          bairro: r.bairro,
          cep: r.cep,
          cidade: r.cidade,
          estado: r.estado,
          email: r.email ?? "",
          telefone: maskTelefone(r.telefone ?? ""),
          profissao: r.profissao ?? "",
          senhaGov: r.senha_gov,
          dataEntradaProcesso: r.data_entrada_processo ?? "",
          dataDeferimento: r.data_deferimento ?? "",
          nomeClube: r.nome_clube ?? "",
          loginClube: r.login_clube ?? "",
          senhaClube: r.senha_clube ?? "",
          status: (r.status ?? "doc") as ClienteStatus,
          status2: (r.status2 ?? "doc") as ClienteStatus,
          owner_id: r.owner_id ?? undefined,
        }));
        setClientes(clientes);
        try { sessionStorage.setItem("decl_clientes_cache", JSON.stringify(clientes)); } catch {}
        try { localStorage.setItem(`sinarm_backup_${myId}`, JSON.stringify(clientes)); } catch {}

        // Migra dados antigos do user_metadata se existirem
        const user = await usuarioAtual();
        const oldCloud: Cliente[] = user?.user_metadata?.decl_clientes ?? [];
        if (oldCloud.length > 0) {
          const merged = [...clientes];
          for (const lc of oldCloud) {
            if (!clientes.find(c => c.cpf === lc.cpf && c.nome === lc.nome)) merged.push(lc);
          }
          let saveDeu = true;
          if (merged.length > clientes.length) {
            saveDeu = await saveClientesToCloud(merged);
            if (saveDeu) setClientes(merged);
          }
          // Só limpa metadata se o save foi confirmado com sucesso
          if (saveDeu) {
            await supabase.auth.updateUser({ data: { decl_clientes: null } });
          }
        }
      } else if (!error && rows && rows.length === 0) {
        // Banco retornou vazio sem erro = nenhum cliente cadastrado
        const user = await usuarioAtual();
        const cloud: Cliente[] = user?.user_metadata?.decl_clientes ?? [];
        if (cloud.length > 0) {
          const saved = await saveClientesToCloud(cloud);
          setClientes(cloud);
          if (saved) {
            await supabase.auth.updateUser({ data: { decl_clientes: null } });
          }
        } else {
          // Banco retornou 0 sem erro = estado legítimo (ex: dados transferidos para outro usuário)
          // Limpa backup local desatualizado para não mostrar aviso falso
          try { localStorage.removeItem(`sinarm_backup_${myId}`); } catch {}
          setClientes([]);
          try { sessionStorage.setItem("decl_clientes_cache", "[]"); } catch {}
        }
      }
      // Se error !== null, mantém dados existentes no state (não limpa UI por erro temporário do DB)
    } catch {
      // mantém dados cacheados em caso de erro de rede
    }
    setLoadingClientes(false);
  }, [saveClientesToCloud, isAdmin]);

  useEffect(() => {
    const init = async () => {
      // Só roda migração se ainda não foi feita neste browser (evita pg_notify a cada carregamento)
      const migDone = localStorage.getItem("dc_migration_v4");
      if (!migDone) {
        await supabase.functions.invoke("run-migration", {
          body: { sql: "DO $$ BEGIN ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS local_nascimento TEXT NOT NULL DEFAULT ''; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS uf_nascimento TEXT NOT NULL DEFAULT 'AM'; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS nome_clube TEXT NOT NULL DEFAULT ''; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS login_clube TEXT NOT NULL DEFAULT ''; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS senha_clube TEXT NOT NULL DEFAULT ''; PERFORM pg_notify('pgrst', 'reload schema'); END $$;" },
        }).catch(() => {});
        localStorage.setItem("dc_migration_v4", "1");
        await new Promise(r => setTimeout(r, 2000));
      }
      const mig5Done = localStorage.getItem("dc_migration_v5");
      if (!mig5Done) {
        await supabase.functions.invoke("run-migration", {
          body: { sql: "ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS email TEXT; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS telefone TEXT;" },
        }).catch(() => {});
        localStorage.setItem("dc_migration_v5", "1");
      }
      const mig6Done = localStorage.getItem("dc_migration_v6");
      if (!mig6Done) {
        await supabase.functions.invoke("run-migration", {
          body: { sql: "ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS profissao TEXT;" },
        }).catch(() => {});
        localStorage.setItem("dc_migration_v6", "1");
      }
      const migDocsCR = localStorage.getItem("dc_migration_docs_cr");
      if (!migDocsCR) {
        await supabase.functions.invoke("run-migration", {
          body: { sql: `CREATE TABLE IF NOT EXISTS declaracao_docs_cr (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, cliente_id TEXT NOT NULL, tipo TEXT NOT NULL, file_name TEXT NOT NULL, storage_path TEXT NOT NULL, file_url TEXT NOT NULL DEFAULT '', uploaded_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(cliente_id, tipo)); ALTER TABLE declaracao_docs_cr ENABLE ROW LEVEL SECURITY; DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='auth_all_docs_cr' AND tablename='declaracao_docs_cr') THEN CREATE POLICY auth_all_docs_cr ON declaracao_docs_cr TO authenticated USING (true) WITH CHECK (true); END IF; END $$; INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('cac-docs', 'cac-docs', true, 52428800) ON CONFLICT DO NOTHING;` },
        }).catch(() => {});
        localStorage.setItem("dc_migration_docs_cr", "1");
      }
      const migDocsCRv2 = localStorage.getItem("dc_migration_docs_cr_v2");
      if (!migDocsCRv2) {
        await supabase.functions.invoke("run-migration", {
          body: { sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='cac_docs_insert' AND tablename='objects' AND schemaname='storage') THEN CREATE POLICY cac_docs_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cac-docs'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='cac_docs_select' AND tablename='objects' AND schemaname='storage') THEN CREATE POLICY cac_docs_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'cac-docs'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='cac_docs_update' AND tablename='objects' AND schemaname='storage') THEN CREATE POLICY cac_docs_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cac-docs'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='cac_docs_delete' AND tablename='objects' AND schemaname='storage') THEN CREATE POLICY cac_docs_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cac-docs'); END IF; END $$;` },
        }).catch(() => {});
        localStorage.setItem("dc_migration_docs_cr_v2", "1");
      }
      const migDocsCRv4 = localStorage.getItem("dc_migration_docs_cr_v4");
      if (!migDocsCRv4) {
        await supabase.functions.invoke("run-migration", {
          body: { sql: `DROP POLICY IF EXISTS cac_docs_public_select ON storage.objects;` },
        }).catch(() => {});
        localStorage.setItem("dc_migration_docs_cr_v4", "1");
      }
      // Limpa cache inválido (pode ter sido gravado como [] por erro anterior)
      const cached = sessionStorage.getItem("decl_clientes_cache");
      if (cached === "[]") sessionStorage.removeItem("decl_clientes_cache");
      await fetchClientes();
      // Carrega docs de todos os clientes para exibir nos cards
      const me2 = await usuarioAtual();
      if (me2?.id) {
        const { data: allDocs } = await supabase.from("declaracao_docs_cr").select("*");
        if (allDocs && allDocs.length > 0) {
          const map = new Map<string, DocCRItem[]>();
          for (const d of allDocs as DocCRRow[]) {
            const arr = map.get(d.cliente_id) ?? [];
            arr.push(toDocCRItem(d));
            map.set(d.cliente_id, arr);
          }
          setDocsCliente(map);
        }
      }
    };
    init();
  }, [fetchClientes, restoreKey]);

  const setC = (field: keyof ClienteForm, value: string) =>
    setFormCliente(prev => ({ ...prev, [field]: value }));

  const abrirNovoCliente = () => {
    setEditandoId(null);
    setDocsPendentes(new Map());
    setFormCliente(EMPTY_CLIENTE);
    setMostrarClubeSection(false);
    setMostrarSenhaClubeForm(false);
    setDialogClienteOpen(true);
  };
  const abrirEditarCliente = (c: Cliente) => {
    setEditandoId(c.id);
    setDocsPendentes(new Map());
    const { id: _id, ...rest } = c;
    setFormCliente(rest);
    const temClube = !!(c.nomeClube || c.loginClube || c.senhaClube);
    setMostrarClubeSection(temClube);
    if (temClube && !c.loginClube && c.cpf) rest.loginClube = c.cpf;
    setMostrarSenhaClubeForm(false);
    setDialogClienteOpen(true);
    fetchDocsCR(c.id);
  };
  const salvarCliente = async () => {
    if (!formCliente.nome) { toast({ title: "Preencha o Nome.", variant: "destructive" }); return; }
    setSavingCliente(true);
    const payload = {
      nome: formCliente.nome,
      rg: formCliente.rg,
      orgao_emissor: formCliente.orgaoEmissor,
      data_expedicao: formCliente.dataExpedicao,
      cpf: formCliente.cpf,
      nome_pai: formCliente.nomePai,
      nome_mae: formCliente.nomeMae,
      estado_civil: formCliente.estadoCivil,
      data_nascimento: formCliente.dataNascimento,
      local_nascimento: formCliente.localNascimento,
      uf_nascimento: formCliente.ufNascimento,
      endereco: formCliente.endereco,
      numero: formCliente.numero,
      complemento: formCliente.complemento,
      bairro: formCliente.bairro,
      cep: formCliente.cep,
      cidade: formCliente.cidade,
      estado: formCliente.estado,
      email: formCliente.email || null,
      telefone: formCliente.telefone || null,
      profissao: formCliente.profissao || null,
      ...(formCliente.tipo_ocupacao ? { tipo_ocupacao: formCliente.tipo_ocupacao } : {}),
      senha_gov: formCliente.senhaGov,
      data_entrada_processo: formCliente.dataEntradaProcesso || null,
      data_deferimento: formCliente.dataDeferimento || null,
      nome_clube: formCliente.nomeClube,
      login_clube: formCliente.loginClube,
      senha_clube: formCliente.senhaClube,
      status: formCliente.status ?? "doc",
      status2: formCliente.status2 ?? "doc",
      updated_at: new Date().toISOString(),
    };
    // devolve o id do cliente (o novo vem do insert, para os documentos pendentes irem para ele)
    const doSave = async (p: typeof payload): Promise<string | null> => {
      if (editandoId) {
        // .select("id") makes Supabase return the updated rows so we can detect 0-row silent failures
        const { data: updated, error } = await supabase
          .from("declaracao_clientes")
          .update(p)
          .eq("id", editandoId)
          .select("id");
        if (error) throw error;
        if (!updated || updated.length === 0) {
          // 0 rows updated: try adding missing columns then retry once
          await supabase.functions.invoke("run-migration", {
            body: { sql: "DO $$ BEGIN ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS complemento TEXT NOT NULL DEFAULT ''; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS local_nascimento TEXT NOT NULL DEFAULT ''; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS uf_nascimento TEXT NOT NULL DEFAULT 'AM'; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS nome_clube TEXT NOT NULL DEFAULT ''; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS login_clube TEXT NOT NULL DEFAULT ''; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS senha_clube TEXT NOT NULL DEFAULT ''; PERFORM pg_notify('pgrst', 'reload schema'); END $$;" },
          }).catch(() => {});
          await new Promise(r => setTimeout(r, 1500));
          const { data: retry, error: err2 } = await supabase
            .from("declaracao_clientes")
            .update(p)
            .eq("id", editandoId)
            .select("id");
          if (err2) throw err2;
          if (!retry || retry.length === 0) throw new Error("Sem permissão para atualizar este cliente. Verifique se você está logado corretamente.");
        }
        return editandoId;
      } else {
        const currentUser = await usuarioAtual();
        const ownerId = currentUser?.id ?? userId;
        const { data: novo, error } = await supabase.from("declaracao_clientes").insert({ ...p, owner_id: ownerId }).select("id").single();
        if (error) throw error;
        return (novo as { id?: string } | null)?.id ?? null;
      }
    };
    // Cliente novo salvo: manda os documentos que ficaram pendentes no cadastro
    const mandarPendentes = async (id: string | null) => {
      if (editandoId || !id || docsPendentes.size === 0) return;
      const tid = sonnerToast.loading(`Enviando ${docsPendentes.size} documento(s)...`);
      try { await enviarPendentes(id); } finally { sonnerToast.dismiss(tid); }
    };
    try {
      await mandarPendentes(await doSave(payload));
      setDialogClienteOpen(false);
      toast({ title: editandoId ? "Cliente atualizado!" : "Cliente cadastrado!" });
      await fetchClientes();
    } catch (e: unknown) {
      const errMsg: string = (e as any)?.message ?? "";
      // Column missing — apply migration + reload schema cache then retry
      if (errMsg.includes("complemento") || errMsg.includes("local_nascimento") || errMsg.includes("uf_nascimento") || errMsg.includes("nome_clube") || errMsg.includes("login_clube") || errMsg.includes("senha_clube") || errMsg.includes("email") || errMsg.includes("telefone") || (e as any)?.code === "42703") {
        try {
          await supabase.functions.invoke("run-migration", {
            body: { sql: "DO $$ BEGIN ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS complemento TEXT NOT NULL DEFAULT ''; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS local_nascimento TEXT NOT NULL DEFAULT ''; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS uf_nascimento TEXT NOT NULL DEFAULT 'AM'; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS nome_clube TEXT NOT NULL DEFAULT ''; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS login_clube TEXT NOT NULL DEFAULT ''; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS senha_clube TEXT NOT NULL DEFAULT ''; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS email TEXT; ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS telefone TEXT; PERFORM pg_notify('pgrst', 'reload schema'); END $$;" },
          });
          // Wait for PostgREST schema cache to reload
          await new Promise(r => setTimeout(r, 2500));
          await mandarPendentes(await doSave(payload));
          setDialogClienteOpen(false);
          toast({ title: editandoId ? "Cliente atualizado!" : "Cliente cadastrado!" });
          await fetchClientes();
          return;
        } catch (e2: unknown) {
          toast({ title: "Erro ao salvar", description: (e2 as any)?.message ?? errMsg, variant: "destructive" });
          return;
        }
      }
      toast({ title: "Erro ao salvar", description: errMsg || "Erro desconhecido", variant: "destructive" });
    } finally {
      setSavingCliente(false);
    }
  };
  const excluirCliente = async (id: string) => {
    if (!confirm("Excluir este cliente?")) return;
    const user = await usuarioAtual();
    if (!user?.id) return;
    const { error } = await supabase.from("declaracao_clientes").delete().eq("id", id).eq("owner_id", user.id);
    if (!error) setClientes(prev => prev.filter(c => c.id !== id));
  };

  const alterarStatus = async (id: string, status: ClienteStatus) => {
    setClientes(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    await supabase.from("declaracao_clientes").update({ status }).eq("id", id);
  };

  const alterarStatus2 = async (id: string, status2: ClienteStatus) => {
    setClientes(prev => prev.map(c => c.id === id ? { ...c, status2 } : c));
    await supabase.from("declaracao_clientes").update({ status2 }).eq("id", id);
  };

  // Opção global: folha sem logo/marca d'água
  const [semLogo, setSemLogo] = useState(false);

  // Diálogo 1 — Inquérito
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const set = (field: keyof FormData, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  // Diálogo 2 — Acervo
  const [dialogAcervoOpen, setDialogAcervoOpen] = useState(false);

  // Diálogo 4 — DSA
  const [dialogDSAOpen, setDialogDSAOpen] = useState(false);

  // ── Contrato de assessoria ──
  const [dialogContratoOpen, setDialogContratoOpen] = useState(false);
  const [formContrato, setFormContrato] = useState<FormContrato>(novoFormContrato);
  const [contratado, setContratado] = useState<DadosContratado>(CONTRATADO_VAZIO);
  const [editandoContratado, setEditandoContratado] = useState(false);
  const [gerandoContrato, setGerandoContrato] = useState(false);
  const setFormC = <K extends keyof FormContrato>(k: K, v: FormContrato[K]) => setFormContrato(p => ({ ...p, [k]: v }));
  const setContratadoCampo = (k: keyof DadosContratado, v: string) => setContratado(p => ({ ...p, [k]: v }));

  const abrirContrato = async () => {
    setFormContrato(novoFormContrato()); setDialogContratoOpen(true);
    // Tabela de configuração: criada uma vez por navegador (só o admin consegue criar)
    const FLAG = "app_config_migration_v1";
    if (!localStorage.getItem(FLAG)) {
      await supabase.functions.invoke("run-migration", { body: { sql: SQL_APP_CONFIG } }).catch(() => {});
      localStorage.setItem(FLAG, "1");
    }
    const { data } = await supabase.from("app_config" as any).select("valor").eq("chave", "contratado").maybeSingle();
    const salvo = (data as any)?.valor as Partial<DadosContratado> | undefined;
    if (salvo?.nome) { setContratado({ ...CONTRATADO_VAZIO, ...salvo }); setEditandoContratado(false); }
    else setEditandoContratado(true);
  };

  const salvarContratado = async () => {
    if (!contratado.nome.trim()) { alert("Preencha ao menos o nome do contratado."); return; }
    const { error } = await supabase.from("app_config" as any)
      .upsert({ chave: "contratado", valor: contratado, updated_at: new Date().toISOString() });
    if (error) { sonnerToast.error("Não foi possível salvar: " + error.message); return; }
    sonnerToast.success("Dados do contratado salvos.");
    setEditandoContratado(false);
  };

  const preencherContratante = (c: Cliente) => {
    setFormContrato(p => ({
      ...p,
      nome: (c.nome || "").toUpperCase(),
      estadoCivil: c.estadoCivil || "",
      profissao: c.profissao || "",
      cpf: c.cpf || "",
      rg: [c.rg, (c.orgaoEmissor || "").replace("-", "/")].filter(Boolean).join(" "),
      endereco: [c.endereco, c.numero ? `número ${c.numero}` : "", c.complemento, c.bairro].filter(Boolean).join(", "),
      cep: c.cep || "",
      cidadeUf: [c.cidade, c.estado].filter(Boolean).join("/"),
      telefone: c.telefone || "",
      email: c.email || "",
    }));
  };
  const [formDSA, setFormDSA] = useState<FormDataDSA>(EMPTY_FORM_DSA);
  const setDSA = (field: keyof FormDataDSA, value: string) => setFormDSA(prev => ({ ...prev, [field]: value }));
  const [dsaTipo, setDsaTipo] = useState<"registro" | "aquisicao">("registro");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [formAcervo, setFormAcervo] = useState<FormDataAcervo>(EMPTY_FORM_ACERVO);
  const setA = (field: keyof FormDataAcervo, value: string) => setFormAcervo(prev => ({ ...prev, [field]: value }));

  // Diálogo 3 — Residência
  const [dialogResOpen, setDialogResOpen] = useState(false);
  const [formRes, setFormRes] = useState<FormDataResidencia>(EMPTY_FORM_RES);
  const setR = (field: keyof FormDataResidencia, value: string) => setFormRes(prev => ({ ...prev, [field]: value }));
  const [rgDataUrl, setRgDataUrl] = useState<string | null>(null);
  const [rgNome, setRgNome] = useState("");
  const [rgDataUrl2, setRgDataUrl2] = useState<string | null>(null);
  const [rgNome2, setRgNome2] = useState("");
  const [compDataUrl, setCompDataUrl] = useState<string | null>(null);
  const [compNome, setCompNome] = useState("");
  const rgInputRef = useRef<HTMLInputElement>(null);
  const rgInputRef2 = useRef<HTMLInputElement>(null);
  const compInputRef = useRef<HTMLInputElement>(null);

  // Diálogo 5 — Docs Emissão de CRAF
  const [dialogCrafOpen, setDialogCrafOpen] = useState(false);
  const [crafNome, setCrafNome] = useState("");
  const [notaFiscalUrl, setNotaFiscalUrl] = useState<string | null>(null);
  const [notaFiscalNome, setNotaFiscalNome] = useState("");
  const notaFiscalRef = useRef<HTMLInputElement>(null);
  const [autorizacaoCompraUrl, setAutorizacaoCompraUrl] = useState<string | null>(null);
  const [autorizacaoCompraNome, setAutorizacaoCompraNome] = useState("");
  const autorizacaoCompraRef = useRef<HTMLInputElement>(null);
  const [cnhCrafUrl, setCnhCrafUrl] = useState<string | null>(null);
  const [cnhCrafNome, setCnhCrafNome] = useState("");
  const cnhCrafRef = useRef<HTMLInputElement>(null);

  // Abre dialog via URL param ?open=inquerito|acervo|residencia|dsa|craf
  useEffect(() => {
    const open = searchParams.get("open");
    if (!open) return;
    if (open === "inquerito") { setForm(EMPTY_FORM); setDialogOpen(true); }
    else if (open === "acervo") { setFormAcervo(EMPTY_FORM_ACERVO); setDialogAcervoOpen(true); }
    else if (open === "residencia") { setFormRes(EMPTY_FORM_RES); clearRg(); clearComp(); setDialogResOpen(true); }
    else if (open === "dsa") { setFormDSA(EMPTY_FORM_DSA); setDialogDSAOpen(true); }
    else if (open === "craf") { setCrafNome(""); clearNotaFiscal(); clearAutorizacaoCompra(); clearCnhCraf(); setDialogCrafOpen(true); }
    setSearchParams({}, { replace: true });
  }, [searchParams]);

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>, setUrl: (v: string | null) => void, setName: (v: string) => void) => {
    const file = e.target.files?.[0]; if (!file) return;
    setName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };
  const clearRg = () => { setRgDataUrl(null); setRgNome(""); if (rgInputRef.current) rgInputRef.current.value = ""; };
  const clearRg2 = () => { setRgDataUrl2(null); setRgNome2(""); if (rgInputRef2.current) rgInputRef2.current.value = ""; };
  const clearComp = () => { setCompDataUrl(null); setCompNome(""); if (compInputRef.current) compInputRef.current.value = ""; };
  const clearNotaFiscal = () => { setNotaFiscalUrl(null); setNotaFiscalNome(""); if (notaFiscalRef.current) notaFiscalRef.current.value = ""; };
  const clearAutorizacaoCompra = () => { setAutorizacaoCompraUrl(null); setAutorizacaoCompraNome(""); if (autorizacaoCompraRef.current) autorizacaoCompraRef.current.value = ""; };
  const clearCnhCraf = () => { setCnhCrafUrl(null); setCnhCrafNome(""); if (cnhCrafRef.current) cnhCrafRef.current.value = ""; };

  return (
    <>
    {docPreview && (
      <DocPreviewModal url={docPreview.url} nome={docPreview.nome} onClose={() => { URL.revokeObjectURL(docPreview.url); setDocPreview(null); }} />
    )}
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clientes Armas</h1>
            <p className="text-sm text-muted-foreground">Área restrita — Administradores e Moderadores</p>
          </div>
        </div>

        {/* ── Acesso rápido: Ferramentas ── */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Ferramentas</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Inquérito Policial",            action: () => { setForm(EMPTY_FORM); setDialogOpen(true); } },
              { label: "Comp. 2º End. de Guarda",      action: () => { setFormAcervo(EMPTY_FORM_ACERVO); setDialogAcervoOpen(true); } },
              { label: "DSA",                           action: () => { setFormDSA(EMPTY_FORM_DSA); setDialogDSAOpen(true); } },
              { label: "Declaração de Residência",      action: () => { setFormRes(EMPTY_FORM_RES); clearRg(); clearComp(); setDialogResOpen(true); } },
              { label: "Docs Emissão de CRAF",          action: () => { setCrafNome(""); clearNotaFiscal(); clearAutorizacaoCompra(); clearCnhCraf(); setDialogCrafOpen(true); } },
              { label: "Contrato de Assessoria",        action: () => { abrirContrato(); } },
            { label: "Imagem para PDF",               action: () => navigate("/imagem-para-pdf") },
            ].map(({ label, action }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Plus className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Clientes cadastrados */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <button
              type="button"
              className="flex items-center gap-2 text-left flex-1 min-w-0"
              onClick={() => setMostrarClientes(v => !v)}
            >
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />Clientes Cadastrados
                {clientes.length > 0 && (
                  <span className="ml-1 text-xs font-normal bg-primary/10 text-primary rounded-full px-2 py-0.5">{clientes.length}</span>
                )}
              </CardTitle>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${mostrarClientes ? "rotate-180" : ""}`} />
            </button>
            <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
              {mostrarClientes && (
                <>
                  <Button
                    size="icon" variant="ghost"
                    className="h-8 w-8"
                    title={dadosVisiveis ? "Ocultar dados" : "Mostrar dados"}
                    onClick={() => setDadosVisiveis(v => !v)}
                  >
                    {dadosVisiveis ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    className="h-8 w-8"
                    title={viewMode === "grid" ? "Modo lista" : "Modo grade"}
                    onClick={toggleViewMode}
                  >
                    {viewMode === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon" variant={abaDashboard ? "default" : "ghost"}
                    className="h-8 w-8"
                    title="Dashboard de Documentos CR"
                    onClick={async () => {
                      if (!abaDashboard) {
                        for (const c of clientes) { fetchDocsCR(c.id); }
                      }
                      setAbaDashboard(o => !o);
                    }}
                  >
                    <BarChart2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              {clientes.length > 0 && (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={exportarExcel} title="Exportar planilha Excel">
                  <Download className="h-3.5 w-3.5" />Exportar Excel
                </Button>
              )}
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={abrirNovoCliente}>
                <UserPlus className="h-3.5 w-3.5" />Cadastrar Cliente
              </Button>
            </div>
          </CardHeader>
          {mostrarClientes && (
            <CardContent>
              {clientes.length > 0 && (
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente..."
                      value={buscaCliente}
                      onChange={(e) => setBuscaCliente(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(Object.entries(STATUS_LABELS) as [ClienteStatus, string][]).map(([val, label]) => {
                      const grupo = clientes.filter(c => (c.status ?? "doc") === val);
                      const sempreVisivel = val === "doc" || val === "docaut" || val === "completo";
                      if (grupo.length === 0 && !sempreVisivel) return null;
                      const hoje = new Date(); hoje.setHours(0,0,0,0);
                      const nomes = grupo.map(c => {
                        if (!c.dataEntradaProcesso) return c.nome;
                        const ini = new Date(c.dataEntradaProcesso); ini.setHours(0,0,0,0);
                        const dias = Math.round((hoje.getTime() - ini.getTime()) / 86400000);
                        return `${c.nome} (${dias}d)`;
                      }).join("\n");
                      return (
                        <span
                          key={val}
                          title={nomes}
                          onClick={() => setFiltroStatusBadge(prev => prev === val ? null : val)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-pointer select-none transition-all ${STATUS_COLORS[val]} ${filtroStatusBadge === val ? "ring-2 ring-white/50 brightness-125" : "opacity-80 hover:opacity-100"}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[val]}`} />
                          {label}: {grupo.length}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
              {loadingClientes && clientes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Carregando clientes...</p>
              ) : clientes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum cliente cadastrado. Cadastre clientes para preencher declarações automaticamente.
                </p>
              ) : abaDashboard ? (
                /* ── Dashboard Documentos CR ── */
                <div className="overflow-x-auto rounded-xl border border-border/40">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground min-w-[160px] sticky left-0 bg-muted/30">Cliente</th>
                        <th className="px-2 py-2 font-semibold text-center text-muted-foreground min-w-[40px]">OK</th>
                        {DOCS_CR.map((d, i) => (
                          <th key={d.id} className="px-1 py-2 text-center min-w-[28px]" title={d.label}>
                            <span className="text-[10px] text-muted-foreground font-bold">{i + 1}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...clientes].filter(c => casaComBusca(c.nome, c.cpf, buscaCliente)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map(c => {
                        const docs = docsCliente.get(c.id) ?? [];
                        const ok = qtdDocsCR(docs);
                        const cor = ok === DOCS_CR.length ? "text-green-400" : ok > 0 ? "text-yellow-400" : "text-muted-foreground";
                        return (
                          <tr key={c.id} className="border-b border-border/20 hover:bg-muted/10">
                            <td className="px-3 py-2 font-semibold truncate max-w-[200px] sticky left-0 bg-card">{c.nome}</td>
                            <td className={`px-2 py-2 text-center font-bold ${cor}`}>{ok}/{DOCS_CR.length}</td>
                            {DOCS_CR.map(d => {
                              const item = docs.find(x => x.tipo === d.id);
                              return (
                                <td key={d.id} className="px-1 py-2 text-center">
                                  {item
                                    ? <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" title={`${d.label} — ${item.fileName}`}><FileCheck2 className="h-3.5 w-3.5 text-green-400 mx-auto" /></a>
                                    : <FileX2 className="h-3.5 w-3.5 text-red-400/40 mx-auto" />}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 border-t border-border/20 bg-muted/10">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {DOCS_CR.map((d, i) => (
                        <span key={d.id} className="text-[10px] text-muted-foreground"><span className="font-bold text-foreground">{i + 1}</span> — {d.label}{d.tag ? <span className="text-amber-400/70 ml-1">({d.tag})</span> : ""}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...clientes].filter(c => casaComBusca(c.nome, c.cpf, buscaCliente) && (!filtroStatusBadge || (c.status ?? "doc") === filtroStatusBadge)).sort((a, b) => {
                    const order: Record<string, number> = { doc: 0, docaut: 1, analise: 2, craf: 3, autor: 4, deferido: 5, completo: 6 };
                    const sa = order[a.status ?? "doc"] ?? 0;
                    const sb = order[b.status ?? "doc"] ?? 0;
                    if (sa !== sb) return sa - sb;
                    const calcDays = (c: typeof a) => {
                      if (!c.dataEntradaProcesso) return -1;
                      if (c.status === "deferido" && c.dataDeferimento) return differenceInDays(parseISO(c.dataDeferimento), parseISO(c.dataEntradaProcesso));
                      return differenceInDays(new Date(), parseISO(c.dataEntradaProcesso));
                    };
                    const da = calcDays(a); const db = calcDays(b);
                    if (da !== db) return da - db;
                    return a.nome.localeCompare(b.nome, "pt-BR");
                  }).map(c => (
                    <div key={c.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg">

                      {/* Cabeçalho: logo (linha 1) + nome (linha 2) */}
                      <div className="pl-0 pr-2 pt-2 pb-2">
                        {/* Linha 1: logo+status juntos (esquerda) | editar/excluir (direita) */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-0">
                            <svg viewBox="0 0 78 36" width="78" height="28" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                              <circle cx="18" cy="18" r="16"  stroke="#e5e7eb" strokeWidth="1.5"/>
                              <circle cx="18" cy="18" r="10"  stroke="#e5e7eb" strokeWidth="1.5"/>
                              <circle cx="18" cy="18" r="3.5" fill="#e5e7eb"/>
                              <line x1="18" y1="1"  x2="18" y2="7"   stroke="#e5e7eb" strokeWidth="1.5"/>
                              <line x1="18" y1="29" x2="18" y2="35"  stroke="#e5e7eb" strokeWidth="1.5"/>
                              <line x1="1"  y1="18" x2="7"   y2="18" stroke="#e5e7eb" strokeWidth="1.5"/>
                              <line x1="29" y1="18" x2="35"  y2="18" stroke="#e5e7eb" strokeWidth="1.5"/>
                              <text x="40" y="17" fontSize="11" fill="white" fontWeight="bold" fontFamily="Arial" letterSpacing="0.5">SINARM</text>
                              <text x="40" y="29" fontSize="9"  fill="#9ca3af" fontWeight="600" fontFamily="Arial" letterSpacing="1">CAC</text>
                            </svg>
                            <Select value={c.status ?? "doc"} onValueChange={(v) => alterarStatus(c.id, v as ClienteStatus)}>
                              <SelectTrigger className={`h-5 px-1.5 border rounded-full shadow-none focus:ring-0 flex items-center gap-1 w-auto text-[10px] font-semibold ${STATUS_COLORS[c.status ?? "doc"]}`}>
                                <>
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[c.status ?? "doc"]}`} />
                                  <span>{STATUS_LABELS[c.status ?? "doc"]}</span>
                                </>
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.entries(STATUS_LABELS) as [ClienteStatus, string][]).map(([val, label]) => (
                                  <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Compartilhar dados" onClick={() => {
                              const endParts = [c.endereco ? c.endereco.toUpperCase() : "", c.numero ? `Nº ${c.numero}` : "", c.complemento ? c.complemento.toUpperCase() : ""].filter(Boolean).join(", ");
                              const fmtEnd = c.bairro ? `${endParts} - ${c.bairro.toUpperCase()}` : endParts;
                              const linhas = [
                                `Nome: ${c.nome}`,
                                c.cpf              ? `CPF: ${c.cpf}` : null,
                                c.rg               ? `RG: ${c.rg}` : null,
                                c.dataNascimento   ? `Nascimento: ${formatDate(c.dataNascimento)}` : null,
                                c.telefone         ? `Tel: ${c.telefone}` : null,
                                c.email            ? `E-mail: ${c.email}` : null,
                                c.cep              ? `CEP: ${c.cep}` : null,
                                fmtEnd             ? `Endereço: ${fmtEnd}` : null,
                                c.estadoCivil      ? `Estado Civil: ${c.estadoCivil}` : null,
                                c.profissao        ? `Profissão: ${c.profissao.toUpperCase()}` : null,
                                c.nomePai          ? `Pai: ${c.nomePai}` : null,
                                c.nomeMae          ? `Mãe: ${c.nomeMae}` : null,
                              ].filter(Boolean).join("\n\n");
                              navigator.clipboard.writeText(linhas);
                              sonnerToast.success("Dados copiados!");
                            }}>
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEditarCliente(c)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => excluirCliente(c.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wide truncate mt-1 pl-3">{c.nome}</p>
                      </div>

                      <div className="pl-3 pr-3 pb-2 flex flex-col gap-0.5">
                        {c.cpf && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-1.5 min-w-0">
                              <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex-shrink-0">CPF</span>
                              <span className="text-xs font-mono font-semibold truncate">
                                {dadosVisiveis ? c.cpf : "•••.•••.•••-••"}
                              </span>
                            </div>
                            <CopyButton value={c.cpf} />
                          </div>
                        )}
                        {c.senhaGov && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-1.5 min-w-0">
                              <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex-shrink-0">SENHA</span>
                              <span className="text-xs font-mono font-semibold truncate">
                                {dadosVisiveis ? c.senhaGov : "••••••••"}
                              </span>
                            </div>
                            <CopyButton value={c.senhaGov} />
                          </div>
                        )}
                        {c.rg && (
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex-shrink-0">RG</span>
                            <span className="text-xs font-mono font-semibold">
                              {dadosVisiveis ? c.rg : "•••••••-•"}
                            </span>
                          </div>
                        )}
                        {c.dataNascimento && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-1.5 min-w-0">
                              <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex-shrink-0">NASC.</span>
                              <span className="text-xs font-mono font-semibold text-yellow-400">
                                {dadosVisiveis ? formatDate(c.dataNascimento) : "••/••/••••"}
                              </span>
                            </div>
                            <CopyButton value={formatDate(c.dataNascimento)} />
                          </div>
                        )}
                        {(c.dataEntradaProcesso || c.dataDeferimento) && (
                          <div className="flex items-center gap-3 border-t border-white/5 pt-1 mt-0.5">
                            {c.dataEntradaProcesso && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">ENT.</span>
                                <span className="text-xs font-mono font-semibold text-blue-400">{formatDate(c.dataEntradaProcesso)}</span>
                              </div>
                            )}
                            {c.dataEntradaProcesso && (
                              <>
                                <span className="text-muted-foreground/30 text-xs select-none">|</span>
                                <span className="text-xs font-bold text-red-400">
                                  {c.dataDeferimento
                                    ? differenceInDays(parseISO(c.dataDeferimento), parseISO(c.dataEntradaProcesso))
                                    : differenceInDays(new Date(), parseISO(c.dataEntradaProcesso))}d
                                </span>
                                {c.dataDeferimento && <span className="text-muted-foreground/30 text-xs select-none">|</span>}
                              </>
                            )}
                            {c.dataDeferimento && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">DEF.</span>
                                <span className="text-xs font-mono font-semibold text-green-400">{formatDate(c.dataDeferimento)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {c.nomeClube && (
                          <div className="flex items-center gap-1.5 border-t border-white/5 pt-1 mt-0.5">
                            <Trophy className="h-3 w-3 text-yellow-400/70 flex-shrink-0" />
                            <span className="text-[9px] font-semibold text-yellow-400/80 uppercase tracking-wide truncate">{c.nomeClube}</span>
                          </div>
                        )}
                        {(() => {
                          const docs = docsCliente.get(c.id) ?? [];
                          const ok = qtdDocsCR(docs);
                          const total = DOCS_CR.length;
                          const cor = ok === total ? "border-green-500/40 text-green-400" : ok > 0 ? "border-yellow-500/40 text-yellow-400" : "border-border/30 text-muted-foreground";
                          return (
                            <div className="border-t border-white/5 pt-1 mt-0.5">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button type="button" className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold hover:opacity-100 opacity-80 transition-opacity ${cor}`}>
                                    <FileText className="h-2.5 w-2.5" />
                                    Docs CR {ok}/{total}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="right" align="start" className="w-72 p-2">
                                  <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">Documentos CR — {c.nome}</p>
                                  <div className="space-y-0.5">
                                    {DOCS_CR.map((d, i) => {
                                      const item = docs.find(x => x.tipo === d.id);
                                      return (
                                        <div key={d.id} className="flex items-center gap-1.5">
                                          <span className="text-[9px] text-muted-foreground w-4 text-right flex-shrink-0">{i + 1}</span>
                                          {item
                                            ? <FileCheck2 className="h-3 w-3 text-green-400 flex-shrink-0" />
                                            : <FileX2 className="h-3 w-3 text-red-400/50 flex-shrink-0" />}
                                          <span className={`text-[10px] leading-tight ${item ? "text-green-300" : "text-foreground/60"}`}>{d.label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── Modo Lista ── */
                <div className="overflow-x-auto rounded-xl border border-border">
                <div className="min-w-[640px] divide-y divide-border">
                  {/* Cabeçalho da tabela */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 items-center px-3 py-1.5 bg-muted/40">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-32 text-center">CPF / Senha</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-20 text-center">RG</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-28 text-center">Status</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-14 text-center">Ações</span>
                  </div>
                  {[...clientes].filter(c => casaComBusca(c.nome, c.cpf, buscaCliente) && (!filtroStatusBadge || (c.status ?? "doc") === filtroStatusBadge)).sort((a, b) => {
                    const order: Record<string, number> = { doc: 0, docaut: 1, analise: 2, craf: 3, autor: 4, deferido: 5, completo: 6 };
                    const sa = order[a.status ?? "doc"] ?? 0;
                    const sb = order[b.status ?? "doc"] ?? 0;
                    if (sa !== sb) return sa - sb;
                    const calcDays = (c: typeof a) => {
                      if (!c.dataEntradaProcesso) return -1;
                      if (c.status === "deferido" && c.dataDeferimento) return differenceInDays(parseISO(c.dataDeferimento), parseISO(c.dataEntradaProcesso));
                      return differenceInDays(new Date(), parseISO(c.dataEntradaProcesso));
                    };
                    const da = calcDays(a); const db = calcDays(b);
                    if (da !== db) return da - db;
                    return a.nome.localeCompare(b.nome, "pt-BR");
                  }).map(c => (
                    <div key={c.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 items-center px-3 py-2 hover:bg-muted/20 transition-colors">
                      {/* Nome */}
                      <p className="text-xs font-bold uppercase truncate">{c.nome}</p>

                      {/* CPF + Senha + Nasc */}
                      <div className="w-32 flex flex-col gap-0.5">
                        {c.cpf && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground uppercase w-9 flex-shrink-0">CPF</span>
                            <span className="text-[10px] font-mono font-semibold truncate">
                              {dadosVisiveis ? c.cpf : "•••.•••-••"}
                            </span>
                            <CopyButton value={c.cpf} />
                          </div>
                        )}
                        {c.senhaGov && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground uppercase w-9 flex-shrink-0">SENHA</span>
                            <span className="text-[10px] font-mono font-semibold truncate">
                              {dadosVisiveis ? c.senhaGov : "••••••••"}
                            </span>
                            <CopyButton value={c.senhaGov} />
                          </div>
                        )}
                        {c.dataNascimento && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground uppercase w-9 flex-shrink-0">NASC.</span>
                            <span className="text-[10px] font-mono font-semibold text-yellow-400">
                              {dadosVisiveis ? formatDate(c.dataNascimento) : "••/••/••••"}
                            </span>
                            <CopyButton value={formatDate(c.dataNascimento)} />
                          </div>
                        )}
                        {(c.dataEntradaProcesso || c.dataDeferimento) && (
                          <div className="flex items-center gap-2 border-t border-white/5 pt-0.5 mt-0.5">
                            {c.dataEntradaProcesso && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-muted-foreground uppercase">ENT.</span>
                                <span className="text-[10px] font-mono font-semibold text-blue-400">{formatDate(c.dataEntradaProcesso)}</span>
                              </div>
                            )}
                            {c.dataEntradaProcesso && (
                              <>
                                <span className="text-muted-foreground/30 text-[10px] select-none">|</span>
                                <span className="text-[10px] font-bold text-red-400">
                                  {c.dataDeferimento
                                    ? differenceInDays(parseISO(c.dataDeferimento), parseISO(c.dataEntradaProcesso))
                                    : differenceInDays(new Date(), parseISO(c.dataEntradaProcesso))}d
                                </span>
                                {c.dataDeferimento && <span className="text-muted-foreground/30 text-[10px] select-none">|</span>}
                              </>
                            )}
                            {c.dataDeferimento && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-muted-foreground uppercase">DEF.</span>
                                <span className="text-[10px] font-mono font-semibold text-green-400">{formatDate(c.dataDeferimento)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {c.nomeClube && (
                          <div className="flex items-center gap-1.5 border-t border-white/5 pt-0.5 mt-0.5">
                            <Trophy className="h-3 w-3 text-yellow-400/70 flex-shrink-0" />
                            <span className="text-[9px] font-semibold text-yellow-400/80 uppercase tracking-wide truncate">{c.nomeClube}</span>
                          </div>
                        )}
                      </div>

                      {/* RG */}
                      <div className="w-20 text-center">
                        {c.rg && (
                          <span className="text-[10px] font-mono font-semibold">
                            {dadosVisiveis ? c.rg : "•••••-•"}
                          </span>
                        )}
                      </div>

                      {/* Status pills */}
                      <div className="w-28 flex items-center gap-1 justify-center">
                        <Select value={c.status ?? "doc"} onValueChange={(v) => alterarStatus(c.id, v as ClienteStatus)}>
                          <SelectTrigger className={`h-5 px-1.5 border rounded-full shadow-none focus:ring-0 flex items-center gap-1 w-auto text-[10px] font-semibold ${STATUS_COLORS[c.status ?? "doc"]}`}>
                            <>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[c.status ?? "doc"]}`} />
                              <span>{STATUS_LABELS[c.status ?? "doc"]}</span>
                            </>
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(STATUS_LABELS) as [ClienteStatus, string][]).map(([val, label]) => (
                              <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Ações */}
                      <div className="w-20 flex items-center gap-0.5 justify-center">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" title="Compartilhar dados" onClick={() => {
                          const endParts = [c.endereco ? c.endereco.toUpperCase() : "", c.numero ? `Nº ${c.numero}` : "", c.complemento ? c.complemento.toUpperCase() : ""].filter(Boolean).join(", ");
                          const fmtEnd = c.bairro ? `${endParts} - ${c.bairro.toUpperCase()}` : endParts;
                          const linhas = [
                            `Nome: ${c.nome}`,
                            c.cpf              ? `CPF: ${c.cpf}` : null,
                            c.rg               ? `RG: ${c.rg}` : null,
                            c.dataNascimento   ? `Nascimento: ${formatDate(c.dataNascimento)}` : null,
                            c.telefone         ? `Tel: ${c.telefone}` : null,
                            c.email            ? `E-mail: ${c.email}` : null,
                            c.cep              ? `CEP: ${c.cep}` : null,
                            fmtEnd             ? `Endereço: ${fmtEnd}` : null,
                            c.estadoCivil      ? `Estado Civil: ${c.estadoCivil}` : null,
                            c.profissao        ? `Profissão: ${c.profissao.toUpperCase()}` : null,
                            c.nomePai          ? `Pai: ${c.nomePai}` : null,
                            c.nomeMae          ? `Mãe: ${c.nomeMae}` : null,
                          ].filter(Boolean).join("\n\n");
                          navigator.clipboard.writeText(linhas);
                          sonnerToast.success("Dados copiados!");
                        }}>
                          <Share2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => abrirEditarCliente(c)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => excluirCliente(c.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

      </div>

      {/* ── Dialog: Cadastro de Cliente ── */}
      <Dialog open={dialogClienteOpen} onOpenChange={setDialogClienteOpen}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onInteractOutside={e => e.preventDefault()}
          // Arquivo solto fora da área de importar: o navegador abriria o arquivo e o formulário seria perdido
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "none"; }}
          onDrop={e => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              {editandoId ? "Editar Cliente" : "Cadastrar Cliente"}
            </DialogTitle>
          </DialogHeader>
          {/* ── Documentos CR (no cadastro novo, ficam pendentes e vão junto ao salvar) ── */}
          {(
            <div className="mt-1">
              <input ref={docUploadRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f && docUploadTipo) enviarDocCR(docUploadTipo, f, subTipoPendente || undefined);
                  e.target.value = "";
                  setSubTipoPendente("");
                }} />
              <input ref={docLoteRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden"
                onChange={e => {
                  if (e.target.files) uploadEmLote(e.target.files);
                  e.target.value = "";
                }} />
              <button type="button"
                className="w-full flex items-center justify-between rounded-lg border border-dashed border-primary/40 px-3 py-2 text-xs text-primary hover:border-primary/80 transition-colors"
                onClick={() => setAbaDocsForm(o => !o)}>
                <span className="flex items-center gap-1.5 font-semibold">
                  <FileText className="h-3.5 w-3.5" />
                  Documentos CR
                  {(() => {
                    const ok = editandoId ? qtdDocsCR(docsCliente.get(editandoId) ?? []) : docsPendentes.size;
                    return ok > 0 ? <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${ok === DOCS_CR.length ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>{ok}/{DOCS_CR.length}</span> : null;
                  })()}
                </span>
                {abaDocsForm ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {abaDocsForm && (
                <div className="mt-2 space-y-1 rounded-lg border border-border/40 bg-muted/10 p-2">
                  {/* Envio em lote (clique ou arraste os arquivos para cá) */}
                  <button type="button" disabled={uploadingLote}
                    className={`w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-[11px] transition-colors disabled:opacity-50 mb-2 ${arrastandoDocCR === "lote" ? "border-primary bg-primary/15 text-primary" : "border-primary/30 text-primary/70 hover:border-primary/60 hover:text-primary hover:bg-primary/5"}`}
                    onClick={() => docLoteRef.current?.click()}
                    onDragOver={e => arrastarSobreDocCR(e, "lote")} onDragLeave={sairDoArrasteDocCR} onDrop={e => soltarDocCR(e, "lote")}>
                    <Upload className="h-3 w-3" />
                    {uploadingLote ? "Enviando..." : arrastandoDocCR === "lote" ? "Solte os arquivos aqui (detecção automática)"
                      : "Enviar vários arquivos de uma vez: clique ou arraste (detecção automática)"}
                  </button>
                  {DOCS_CR.map((doc, i) => {
                    const item = editandoId ? (docsCliente.get(editandoId) ?? []).find(d => d.tipo === doc.id) : undefined;
                    const pendente = editandoId ? undefined : docsPendentes.get(doc.id);
                    const uploading = uploadingDocTipo === doc.id;
                    const alvo = arrastandoDocCR === doc.id;
                    return (
                      <div key={doc.id}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${alvo ? "bg-primary/15 border border-primary ring-1 ring-primary/40" : item ? "bg-green-500/10 border border-green-500/20" : pendente ? "bg-amber-500/10 border border-amber-500/30" : "bg-muted/20"}`}
                        onDragOver={e => arrastarSobreDocCR(e, doc.id)} onDragLeave={sairDoArrasteDocCR} onDrop={e => soltarDocCR(e, doc.id)}>
                        <span className="text-[10px] text-muted-foreground w-4 text-right flex-shrink-0">{i + 1}</span>
                        {item ? <FileCheck2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                          : pendente ? <FileCheck2 className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                          : <FileX2 className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] leading-tight ${item ? "text-green-300" : pendente ? "text-amber-300" : "text-foreground/70"}`}>{doc.label}</p>
                          {alvo ? <p className="text-[9px] text-primary font-semibold">Solte o arquivo aqui{item || pendente ? " (substitui o atual)" : ""}</p>
                            : item ? <p className="text-[9px] text-muted-foreground truncate">{item.fileName}</p>
                            : pendente && <p className="text-[9px] text-amber-300/80 truncate">{pendente.file.name} — vai ser enviado ao salvar o cliente</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {pendente && (
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="Tirar"
                              onClick={() => setDocsPendentes(prev => { const m = new Map(prev); m.delete(doc.id); return m; })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                          {item && (
                            <>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-blue-400 hover:text-blue-300" title="Visualizar"
                                onClick={async () => {
                                  const tid = sonnerToast.loading("Carregando...");
                                  try {
                                    const { data, error } = await supabase.storage.from("cac-docs").download(item.storagePath);
                                    if (error || !data) throw new Error(error?.message ?? "arquivo não encontrado");
                                    const blob = /\.pdf$/i.test(item.fileName) ? new Blob([data], { type: "application/pdf" }) : data;
                                    setDocPreview({ url: URL.createObjectURL(blob), nome: item.fileName });
                                  } catch (err) {
                                    sonnerToast.error("Erro ao abrir: " + (err instanceof Error ? err.message : String(err)));
                                  } finally { sonnerToast.dismiss(tid); }
                                }}>
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-amber-400 hover:text-amber-300" title="Baixar"
                                onClick={async () => {
                                  const tid = sonnerToast.loading("Baixando...");
                                  try {
                                    const { data, error } = await supabase.storage.from("cac-docs").download(item.storagePath);
                                    if (error || !data) throw new Error(error?.message ?? "arquivo não encontrado");
                                    baixarBlob(data, item.fileName);
                                  } catch (err) {
                                    sonnerToast.error("Erro ao baixar: " + (err instanceof Error ? err.message : String(err)));
                                  } finally { sonnerToast.dismiss(tid); }
                                }}>
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="Remover"
                                onClick={() => deleteDocCR(editandoId!, doc.id, item.storagePath)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-primary hover:text-primary/80" title="Enviar documento"
                            disabled={uploading}
                            onClick={() => {
                              setDocUploadTipo(doc.id);
                              if (doc.id === "comp_residencia" || doc.id === "comp_2_end" || doc.id === "comp_ocupacao") {
                                setSubTipoDialogOpen(true);
                              } else {
                                setTimeout(() => docUploadRef.current?.click(), 0);
                              }
                            }}>
                            {uploading ? <span className="text-[9px]">...</span> : <Upload className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="space-y-4 py-2">
            {/* Importar documentos: preenchem o cadastro (PDF ou foto, pelo botão ou arrastando) */}
            <div className="space-y-2">
              <CaixaImportar titulo="Importar CNH ou RG"
                descricao="Arraste aqui ou selecione: PDF ou foto — preenche nome, CPF, RG, nascimento, naturalidade e filiação"
                lendo={parsendoCNH} progresso={progressoDoc} onArquivo={importarDocumento} />
              <CaixaImportar titulo="Importar comprovante de residência"
                descricao="Arraste aqui ou selecione: conta de luz ou água (PDF ou foto) — preenche CEP, endereço, número, complemento, bairro e cidade"
                lendo={lendoComprovante} progresso={progressoComprovante} onArquivo={importarComprovante} />
            </div>
            {/* Nome */}
            <div className="space-y-1">
              <Label className="text-xs">Nome Completo *</Label>
              <div className="flex gap-1.5">
                <Input className="h-9 text-sm uppercase" placeholder="Nome completo"
                  value={formCliente.nome} onChange={e => setC("nome", e.target.value.toUpperCase())} />
                <CopyButton value={formCliente.nome} />
              </div>
            </div>
            {/* Email + Telefone + Profissão */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">E-mail</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm" placeholder="exemplo@email.com"
                    value={formCliente.email} onChange={e => setC("email", e.target.value)} />
                  <CopyButton value={formCliente.email} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefone</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm" placeholder="(92) 9 0000-0000"
                    value={formCliente.telefone} onChange={e => setC("telefone", maskTelefone(e.target.value))} />
                  <CopyButton value={formCliente.telefone} />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Profissão</Label>
              <div className="flex gap-1.5">
                <Input className="h-9 text-sm" placeholder="Ex: Servidor Público, Comerciante..."
                  value={formCliente.profissao} onChange={e => setC("profissao", e.target.value)} />
                <CopyButton value={formCliente.profissao} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Comprovante de Ocupação Lícita</Label>
              <Select value={formCliente.tipo_ocupacao || ""} onValueChange={v => setC("tipo_ocupacao", v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione o tipo de documento..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contracheque">Contracheque / Holerite / CTPS</SelectItem>
                  <SelectItem value="registros municipais">Registros Municipais / DECORE</SelectItem>
                  <SelectItem value="oab">OAB</SelectItem>
                  <SelectItem value="junta comercial">Junta Comercial / CNPJ</SelectItem>
                  <SelectItem value="ccmei">MEI / DAS-MEI / CCMEI</SelectItem>
                  <SelectItem value="inss">INSS (aposentadoria)</SelectItem>
                  <SelectItem value="instituicao publica">Instituição Pública</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* CPF + RG */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm font-mono" placeholder="000.000.000-00"
                    value={formCliente.cpf} onChange={e => setC("cpf", maskCpf(e.target.value))} />
                  <CopyButton value={formCliente.cpf} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">RG</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm font-mono" placeholder="0000000-0"
                    value={formCliente.rg} onChange={e => setC("rg", maskRg(e.target.value))} />
                  <CopyButton value={formCliente.rg} />
                </div>
              </div>
            </div>
            {/* Órgão + Data Expedição */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Órgão Emissor RG</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm uppercase" placeholder="SSP-AM"
                    value={formCliente.orgaoEmissor} onChange={e => setC("orgaoEmissor", e.target.value)} />
                  <CopyButton value={formCliente.orgaoEmissor} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de Expedição RG</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm" type="date"
                    value={formCliente.dataExpedicao} onChange={e => setC("dataExpedicao", e.target.value)} />
                  <CopyButton value={formCliente.dataExpedicao} />
                </div>
              </div>
            </div>
            {/* Estado Civil + Data Nascimento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Estado Civil</Label>
                <div className="flex gap-1.5">
                  <Select value={formCliente.estadoCivil} onValueChange={v => setC("estadoCivil", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                      <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                      <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                      <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                      <SelectItem value="União Estável">União Estável</SelectItem>
                    </SelectContent>
                  </Select>
                  <CopyButton value={formCliente.estadoCivil} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-yellow-400 font-semibold">Data de Nascimento</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm text-yellow-400 font-semibold" type="date"
                    value={formCliente.dataNascimento} onChange={e => setC("dataNascimento", e.target.value)}
                    onPaste={e => onPasteDate(e, v => setC("dataNascimento", v))} />
                  <CopyButton value={formCliente.dataNascimento} />
                </div>
              </div>
            </div>
            {/* Naturalidade */}
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">Local de Nascimento</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm uppercase" placeholder="Ex: Manaus"
                    value={formCliente.localNascimento} onChange={e => setC("localNascimento", e.target.value.toUpperCase())} />
                  <CopyButton value={formCliente.localNascimento} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">UF Nascimento</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm uppercase" placeholder="AM" maxLength={2}
                    value={formCliente.ufNascimento} onChange={e => setC("ufNascimento", e.target.value.toUpperCase())} />
                  <CopyButton value={formCliente.ufNascimento} />
                </div>
              </div>
            </div>
            {/* Pais */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Pai</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm uppercase" placeholder="Nome do pai"
                    value={formCliente.nomePai} onChange={e => setC("nomePai", e.target.value.toUpperCase())} />
                  <CopyButton value={formCliente.nomePai} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome da Mãe</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm uppercase" placeholder="Nome da mãe"
                    value={formCliente.nomeMae} onChange={e => setC("nomeMae", e.target.value.toUpperCase())} />
                  <CopyButton value={formCliente.nomeMae} />
                </div>
              </div>
            </div>
            {/* Endereço */}
            <div className="space-y-1">
              <Label className="text-xs">CEP</Label>
              <div className="flex gap-1.5 max-w-[160px]">
                <Input className="h-9 text-sm font-mono" placeholder="00.000-000"
                  value={formCliente.cep} onChange={async e => {
                    const masked = maskCep(e.target.value);
                    setC("cep", masked);
                    const addr = await buscarCep(masked);
                    if (addr) {
                      if (addr.logradouro) setC("endereco", titleCase(addr.logradouro));
                      if (addr.bairro) setC("bairro", titleCase(addr.bairro));
                      if (addr.localidade) setC("cidade", addr.localidade);
                      if (addr.uf) setC("estado", addr.uf.toUpperCase());
                    }
                  }} />
                <CopyButton value={formCliente.cep} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">Endereço (Rua/Beco)</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm" placeholder="Ex: Beco São Francisco"
                    value={formCliente.endereco} onChange={e => setC("endereco", titleCase(e.target.value))} />
                  <CopyButton value={formCliente.endereco} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm" placeholder="58"
                    value={formCliente.numero} onChange={e => setC("numero", e.target.value)} />
                  <CopyButton value={formCliente.numero} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Complemento</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm" placeholder="BL-10, Apt 201, s/c"
                    value={formCliente.complemento} onChange={e => setC("complemento", e.target.value.toUpperCase())} />
                  <CopyButton value={formCliente.complemento} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm" placeholder="Bairro"
                    value={formCliente.bairro} onChange={e => setC("bairro", titleCase(e.target.value))} />
                  <CopyButton value={formCliente.bairro} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm"
                    value={formCliente.cidade} onChange={e => setC("cidade", e.target.value)} />
                  <CopyButton value={formCliente.cidade} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado (sigla)</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm uppercase w-24" placeholder="AM"
                    value={formCliente.estado} onChange={e => setC("estado", e.target.value)} />
                  <CopyButton value={formCliente.estado} />
                </div>
              </div>
            </div>

            {/* Senha GOV */}
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                Senha GOV.br
                <span className="text-[10px] font-normal text-muted-foreground">(salva localmente, não compartilhada)</span>
              </Label>
              <div className="flex gap-1.5">
                <Input className="h-9 text-sm font-mono" placeholder="Senha de acesso gov.br"
                  type="text"
                  value={formCliente.senhaGov} onChange={e => setC("senhaGov", e.target.value)} />
                <CopyButton value={formCliente.senhaGov} />
              </div>
            </div>

            {/* Data de Entrada do Processo */}
            <div className="space-y-1">
              <Label className="text-xs">Data de Entrada do Processo</Label>
              <div className="flex gap-1.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal h-9 text-sm", !formCliente.dataEntradaProcesso && "text-muted-foreground")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {formCliente.dataEntradaProcesso
                        ? format(parseISO(formCliente.dataEntradaProcesso), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={formCliente.dataEntradaProcesso ? parseISO(formCliente.dataEntradaProcesso) : undefined}
                      onSelect={(d) => setC("dataEntradaProcesso", d ? format(d, "yyyy-MM-dd") : "")}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                {formCliente.dataEntradaProcesso && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => setC("dataEntradaProcesso", "")}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Data de Deferimento */}
            <div className="space-y-1">
              <Label className="text-xs">Data de Deferimento</Label>
              <div className="flex gap-1.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal h-9 text-sm", !formCliente.dataDeferimento && "text-muted-foreground")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {formCliente.dataDeferimento
                        ? format(parseISO(formCliente.dataDeferimento), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={formCliente.dataDeferimento ? parseISO(formCliente.dataDeferimento) : undefined}
                      onSelect={(d) => setC("dataDeferimento", d ? format(d, "yyyy-MM-dd") : "")}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                {formCliente.dataDeferimento && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => setC("dataDeferimento", "")}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {/* Clube */}
            <div>
              <button
                type="button"
                className="w-full flex items-center justify-between rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2 text-xs text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-colors"
                onClick={() => {
                  const abrindo = !mostrarClubeSection;
                  setMostrarClubeSection(abrindo);
                  if (!abrindo) { setC("nomeClube", ""); setC("loginClube", ""); setC("senhaClube", ""); }
                  else if (!formCliente.loginClube && formCliente.cpf) setC("loginClube", formCliente.cpf);
                }}
              >
                <span className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Dados do Clube (opcional)</span>
                {mostrarClubeSection ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {mostrarClubeSection && (
                <div className="mt-3 space-y-3 rounded-lg border border-muted-foreground/20 bg-muted/10 p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do Clube</Label>
                    <div className="flex gap-1.5">
                      <Input className="h-9 text-sm uppercase" placeholder="Ex: CSAM"
                        value={formCliente.nomeClube} onChange={e => setC("nomeClube", e.target.value.toUpperCase())} />
                      <CopyButton value={formCliente.nomeClube} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Login</Label>
                      <div className="flex gap-1.5">
                        <Input className="h-9 text-sm" placeholder="Usuário ou e-mail"
                          autoComplete="off" name="clube-login"
                          value={formCliente.loginClube} onChange={e => setC("loginClube", e.target.value)} />
                        <CopyButton value={formCliente.loginClube} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-yellow-400/80">Senha</Label>
                      <div className="flex gap-1.5">
                        <div className="relative flex-1">
                          <Input className="h-9 text-sm font-mono pr-8" placeholder="••••••••"
                            type={mostrarSenhaClubeForm ? "text" : "password"}
                            autoComplete="new-password" name="clube-senha"
                            value={formCliente.senhaClube} onChange={e => setC("senhaClube", e.target.value)} />
                          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setMostrarSenhaClubeForm(o => !o)}>
                            {mostrarSenhaClubeForm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <CopyButton value={formCliente.senhaClube} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setDialogClienteOpen(false); setAbaDocsForm(false); }}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={salvarCliente} disabled={savingCliente}>
              <UserPlus className="h-3.5 w-3.5" />{savingCliente ? "Salvando..." : editandoId ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog sub-tipo para upload em lote ── */}
      <Dialog open={loteSubTipoDialogOpen} onOpenChange={open => { if (!open) { loteSubTipoResolveRef.current?.(""); loteSubTipoResolveRef.current = null; setLoteSubTipoDialogOpen(false); } }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Tipo de comprovante</DialogTitle>
            <p className="text-[11px] text-muted-foreground truncate">{loteSubTipoArquivo}</p>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {(loteSubTipoDocId === "comp_ocupacao"
              ? ["Contracheque", "DECORE", "OAB", "Junta Comercial", "MEI / CCMEI", "INSS", "Instituição Pública", "Outros"]
              : ["Telefone", "Energia", "Água", "Gás"]
            ).map(sub => (
              <button key={sub} type="button"
                className="w-full text-left rounded-lg border border-border/50 px-4 py-3 text-sm hover:bg-primary/10 hover:border-primary/50 transition-colors"
                onClick={() => {
                  loteSubTipoResolveRef.current?.(sub);
                  loteSubTipoResolveRef.current = null;
                  setLoteSubTipoDialogOpen(false);
                }}>
                {sub}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog sub-tipo comprovante de residência / ocupação ── */}
      <Dialog open={subTipoDialogOpen} onOpenChange={setSubTipoDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Tipo de comprovante</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {(docUploadTipo === "comp_ocupacao"
              ? ["Contracheque", "DECORE", "OAB", "Junta Comercial", "MEI / CCMEI", "INSS", "Instituição Pública", "Outros"]
              : ["Telefone", "Energia", "Água", "Gás"]
            ).map(tipo => (
              <button key={tipo} type="button"
                className="w-full text-left rounded-lg border border-border/50 px-4 py-3 text-sm hover:bg-primary/10 hover:border-primary/50 transition-colors"
                onClick={() => {
                  setSubTipoPendente(tipo);
                  setSubTipoDialogOpen(false);
                  setTimeout(() => docUploadRef.current?.click(), 100);
                }}>
                {tipo}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Contrato de prestação de serviços de assessoria bélica ── */}
      <Dialog open={dialogContratoOpen} onOpenChange={setDialogContratoOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2 pr-6">
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="flex-1">Contrato de Prestação de Serviços de Assessoria Bélica</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none ml-auto flex-shrink-0">
                <span className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">Sem logo</span>
                <div onClick={() => setSemLogo(v => !v)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${semLogo ? "bg-amber-500" : "bg-muted"}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${semLogo ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </div>
              </label>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Busca do cliente cadastrado → preenche o contratante */}
            <BuscaCliente clientes={clientes} label="Buscar cliente cadastrado (nome ou CPF)" onSelect={preencherContratante} />

            {/* Contratante */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Contratante (cliente)</p>
              <div className="space-y-1">
                <Label className="text-xs">Nome completo</Label>
                <Input className="h-9 text-sm uppercase" value={formContrato.nome} onChange={e => setFormC("nome", e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">Nacionalidade</Label>
                  <Input className="h-9 text-sm" value={formContrato.nacionalidade} onChange={e => setFormC("nacionalidade", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Estado civil</Label>
                  <Input className="h-9 text-sm" value={formContrato.estadoCivil} onChange={e => setFormC("estadoCivil", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Profissão</Label>
                  <Input className="h-9 text-sm" value={formContrato.profissao} onChange={e => setFormC("profissao", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">CPF</Label>
                  <Input className="h-9 text-sm font-mono" value={formContrato.cpf} onChange={e => setFormC("cpf", maskCpf(e.target.value))} /></div>
                <div className="space-y-1"><Label className="text-xs">RG (com órgão)</Label>
                  <Input className="h-9 text-sm" placeholder="0000000-0 SSP/AM" value={formContrato.rg} onChange={e => setFormC("rg", e.target.value)} /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Endereço</Label>
                <Input className="h-9 text-sm" placeholder="Rua, número, complemento, bairro" value={formContrato.endereco} onChange={e => setFormC("endereco", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">CEP</Label>
                  <Input className="h-9 text-sm font-mono" value={formContrato.cep} onChange={e => setFormC("cep", maskCep(e.target.value))} /></div>
                <div className="space-y-1"><Label className="text-xs">Cidade/UF</Label>
                  <Input className="h-9 text-sm" placeholder="Manaus/AM" value={formContrato.cidadeUf} onChange={e => setFormC("cidadeUf", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Telefone/WhatsApp</Label>
                  <Input className="h-9 text-sm" value={formContrato.telefone} onChange={e => setFormC("telefone", maskTelefone(e.target.value))} /></div>
                <div className="space-y-1"><Label className="text-xs">E-mail</Label>
                  <Input className="h-9 text-sm" value={formContrato.email} onChange={e => setFormC("email", e.target.value)} /></div>
              </div>
            </div>

            {/* Serviços */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Serviços do contrato</p>
              <div className="flex flex-wrap gap-2">
                {SERVICOS_CONTRATO.map(s => {
                  const on = formContrato.servicos.includes(s.key);
                  return (
                    <button key={s.key} type="button"
                      onClick={() => setFormC("servicos", on ? formContrato.servicos.filter(x => x !== s.key) : [...formContrato.servicos, s.key])}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-border/60 bg-card hover:border-primary/50 hover:text-primary"}`}>
                      {on ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{s.label}
                    </button>
                  );
                })}
              </div>
              {formContrato.servicos.includes("cr") && (
                <div className="space-y-1"><Label className="text-xs">Categoria do CR</Label>
                  <Input className="h-9 text-sm" placeholder="ex.: Atirador Desportivo" value={formContrato.categoriaCR} onChange={e => setFormC("categoriaCR", e.target.value)} /></div>
              )}
            </div>

            {/* Valor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor total do contrato (R$)</Label>
                <Input className="h-9 text-sm" inputMode="decimal" placeholder="1.950,00" value={formContrato.valorTotal} onFocus={e => e.target.select()} onChange={e => setFormC("valorTotal", e.target.value)} />
                {(() => {
                  const v = lerValor(formContrato.valorTotal);
                  return v !== null && v > 0
                    ? <p className="text-[11px] text-muted-foreground">R$ {fmtReais(v)} ({valorPorExtenso(v)})</p> : null;
                })()}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Forma de pagamento</Label>
                <Input className="h-9 text-sm" placeholder="escolha abaixo ou escreva" value={formContrato.formaPagamento} onChange={e => setFormC("formaPagamento", e.target.value)} />
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {FORMAS_PAGAMENTO.map(fp => {
                    const on = formContrato.formaPagamento === fp.texto;
                    return (
                      <button key={fp.label} type="button"
                        onClick={() => setFormC("formaPagamento", on ? "" : fp.texto)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-border/60 bg-card hover:border-primary/50 hover:text-primary"}`}>
                        {fp.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* O que o valor já cobre (vai no contrato como "incluído no valor") */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Incluso no valor</p>
              <div className="flex flex-wrap gap-2">
                {INCLUSOS_CONTRATO.map(s => {
                  const on = formContrato.inclusos.includes(s.key);
                  return (
                    <button key={s.key} type="button"
                      onClick={() => setFormC("inclusos", on ? formContrato.inclusos.filter(x => x !== s.key) : [...formContrato.inclusos, s.key])}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-border/60 bg-card hover:border-primary/50 hover:text-primary"}`}>
                      {on ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campos opcionais do contrato */}
            <details className="rounded-md border border-border/60 p-3">
              <summary className="text-xs font-semibold cursor-pointer select-none">Mais detalhes (opcional): arma, foro, local e data</summary>
              <div className="space-y-3 mt-3">
                <div className="space-y-1"><Label className="text-xs">Arma do pedido (espécie, marca, modelo, calibre e nº de série) — só entra no contrato se preencher</Label>
                  <Input className="h-9 text-sm" value={formContrato.identificacaoArma} onChange={e => setFormC("identificacaoArma", e.target.value)} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Foro</Label>
                    <Input className="h-9 text-sm" value={formContrato.foro} onChange={e => setFormC("foro", e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Local</Label>
                    <Input className="h-9 text-sm" value={formContrato.local} onChange={e => setFormC("local", e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Data</Label>
                    <Input className="h-9 text-sm" type="date" value={formContrato.data} onChange={e => setFormC("data", e.target.value)} /></div>
                </div>
              </div>
            </details>

            {/* Contratado (a assessoria) — fica salvo no banco, não no código */}
            <div className="rounded-md border border-border/60 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Contratado (assessoria)</p>
                {!editandoContratado && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditandoContratado(true)}>
                    <Pencil className="h-3 w-3" />Editar
                  </Button>
                )}
              </div>
              {!editandoContratado ? (
                <p className="text-xs text-muted-foreground">{contratado.nome}{contratado.cpf ? ` · CPF ${contratado.cpf}` : ""}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">Preencha uma vez e salve: fica guardado no sistema para os próximos contratos.</p>
                  <div className="space-y-1"><Label className="text-xs">Nome completo</Label>
                    <Input className="h-9 text-sm uppercase" value={contratado.nome} onChange={e => setContratadoCampo("nome", e.target.value.toUpperCase())} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Nacionalidade</Label>
                      <Input className="h-9 text-sm" value={contratado.nacionalidade} onChange={e => setContratadoCampo("nacionalidade", e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Estado civil</Label>
                      <Input className="h-9 text-sm" value={contratado.estadoCivil} onChange={e => setContratadoCampo("estadoCivil", e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">CPF</Label>
                      <Input className="h-9 text-sm font-mono" value={contratado.cpf} onChange={e => setContratadoCampo("cpf", maskCpf(e.target.value))} /></div>
                    <div className="space-y-1"><Label className="text-xs">RG (com órgão)</Label>
                      <Input className="h-9 text-sm" value={contratado.rg} onChange={e => setContratadoCampo("rg", e.target.value)} /></div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Endereço</Label>
                    <Input className="h-9 text-sm" value={contratado.endereco} onChange={e => setContratadoCampo("endereco", e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">CEP</Label>
                      <Input className="h-9 text-sm font-mono" value={contratado.cep} onChange={e => setContratadoCampo("cep", e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Cidade/UF</Label>
                      <Input className="h-9 text-sm" value={contratado.cidadeUf} onChange={e => setContratadoCampo("cidadeUf", e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Telefone/WhatsApp</Label>
                      <Input className="h-9 text-sm" value={contratado.telefone} onChange={e => setContratadoCampo("telefone", e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">E-mail</Label>
                      <Input className="h-9 text-sm" value={contratado.email} onChange={e => setContratadoCampo("email", e.target.value)} /></div>
                  </div>
                  <Button size="sm" className="h-8 text-xs" onClick={salvarContratado}>Salvar dados do contratado</Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogContratoOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" disabled={gerandoContrato} onClick={async () => {
              if (!formContrato.nome.trim()) { alert("Busque o cliente ou preencha o nome do contratante."); return; }
              if (!formContrato.cpf.trim()) { alert("Preencha o CPF do contratante."); return; }
              if (!formContrato.servicos.length) { alert("Escolha ao menos um serviço."); return; }
              const total = lerValor(formContrato.valorTotal);
              if (total === null || total <= 0) { alert("Informe o valor do contrato."); return; }
              if (!contratado.nome.trim()) { alert("Preencha e salve os dados do contratado (assessoria)."); return; }
              setGerandoContrato(true);
              try {
                const ok = await gerarPDFContrato(formContrato, contratado, semLogo);
                if (ok) setDialogContratoOpen(false);
              } finally { setGerandoContrato(false); }
            }}><Download className="h-3.5 w-3.5" />{gerandoContrato ? "Gerando…" : "Gerar PDF"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 1: Inquérito Policial ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2 pr-6">
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="flex-1">Declaração de Inexistência de Inquéritos Policiais ou Processos Criminais</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none ml-auto flex-shrink-0">
                <span className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">Sem logo</span>
                <div onClick={() => setSemLogo(v => !v)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${semLogo ? "bg-amber-500" : "bg-muted"}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${semLogo ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </div>
              </label>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ClienteSelector clientes={clientes} label="Selecionar cliente cadastrado" onSelect={c => {
              setForm({
                nome: c.nome, estadoCivil: c.estadoCivil, dataNascimento: c.dataNascimento,
                nomePai: c.nomePai, nomeMae: c.nomeMae, endereco: c.endereco, numero: c.numero, complemento: c.complemento, bairro: c.bairro,
                cep: c.cep, cidade: c.cidade.toUpperCase(), estado: c.estado,
                rg: c.rg, orgaoEmissor: c.orgaoEmissor, dataExpedicao: c.dataExpedicao, cpf: c.cpf,
              });
            }} />
            {clientes.length > 0 && <div className="border-t border-dashed border-border/60" />}
            <div className="space-y-1">
              <Label className="text-xs">Nome Completo</Label>
              <Input className="h-9 text-sm uppercase" value={form.nome} onChange={e => set("nome", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Estado Civil</Label>
                <Select value={form.estadoCivil} onValueChange={v => set("estadoCivil", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                    <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                    <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                    <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                    <SelectItem value="União Estável">União Estável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de Nascimento</Label>
                <Input className="h-9 text-sm" type="date" value={form.dataNascimento} onChange={e => set("dataNascimento", e.target.value)}
                  onPaste={e => onPasteDate(e, v => set("dataNascimento", v))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Pai</Label>
                <Input className="h-9 text-sm uppercase" value={form.nomePai} onChange={e => set("nomePai", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome da Mãe</Label>
                <Input className="h-9 text-sm uppercase" value={form.nomeMae} onChange={e => set("nomeMae", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">Endereço (Rua/Beco)</Label>
                <Input className="h-9 text-sm" value={form.endereco} onChange={e => set("endereco", titleCase(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº</Label>
                <Input className="h-9 text-sm" placeholder="58" value={form.numero} onChange={e => set("numero", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Complemento</Label>
                <Input className="h-9 text-sm" placeholder="BL-10, Apt 201, s/c" value={form.complemento} onChange={e => set("complemento", e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input className="h-9 text-sm" value={form.bairro} onChange={e => set("bairro", titleCase(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CEP</Label>
                <Input className="h-9 text-sm font-mono" value={form.cep} onChange={async e => {
                  const masked = maskCep(e.target.value); set("cep", masked);
                  const addr = await buscarCep(masked);
                  if (addr) {
                    if (addr.logradouro) set("endereco", titleCase(addr.logradouro));
                    if (addr.bairro) set("bairro", titleCase(addr.bairro));
                    if (addr.localidade) set("cidade", addr.localidade);
                    if (addr.uf) set("estado", addr.uf.toUpperCase());
                  }
                }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input className="h-9 text-sm" value={form.cidade} onChange={e => set("cidade", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Input className="h-9 text-sm uppercase w-24" placeholder="AM" value={form.estado} onChange={e => set("estado", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">RG</Label>
                <Input className="h-9 text-sm font-mono" placeholder="0000000-0" value={form.rg} onChange={e => set("rg", maskRg(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Órgão Emissor</Label>
                <Input className="h-9 text-sm uppercase" value={form.orgaoEmissor} onChange={e => set("orgaoEmissor", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de Expedição</Label>
                <Input className="h-9 text-sm" type="date" value={form.dataExpedicao} onChange={e => set("dataExpedicao", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF</Label>
              <Input className="h-9 text-sm font-mono" value={form.cpf} onChange={e => set("cpf", maskCpf(e.target.value))} />
            </div>
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
              Data preenchida automaticamente: {format(getSiteDate(), "dd/MM/yyyy")}.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={async () => {
              if (!form.nome || !form.dataNascimento || !form.rg) { alert("Preencha Nome, Data de Nascimento e RG."); return; }
              const tipo = await new Promise<string>(resolve => { inqTipoResolveRef.current = resolve; setInqTipoDialogOpen(true); });
              if (!tipo) return;
              if (tipo === "CR") {
                const ok = await gerarPDF(form, semLogo);
                if (ok) setDialogOpen(false);
              }
            }}><Download className="h-3.5 w-3.5" />Gerar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: tipo de declaração de inquérito ── */}
      <Dialog open={inqTipoDialogOpen} onOpenChange={open => { if (!open) { inqTipoResolveRef.current?.(""); inqTipoResolveRef.current = null; setInqTipoDialogOpen(false); } }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Tipo de declaração</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {[
              { label: "CR", disponivel: true },
              { label: "Autorização", disponivel: false },
              { label: "Renovação", disponivel: false },
            ].map(({ label, disponivel }) => (
              <button key={label} type="button" disabled={!disponivel}
                className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors ${disponivel ? "border-border/50 hover:bg-primary/10 hover:border-primary/50" : "border-border/20 text-muted-foreground opacity-40 cursor-not-allowed"}`}
                onClick={() => {
                  if (!disponivel) return;
                  inqTipoResolveRef.current?.(label);
                  inqTipoResolveRef.current = null;
                  setInqTipoDialogOpen(false);
                }}>
                {label}{!disponivel && <span className="ml-2 text-[10px]">em breve</span>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 2: Acervo ── */}
      <Dialog open={dialogAcervoOpen} onOpenChange={setDialogAcervoOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2 pr-6">
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="flex-1">Comprovante de Segundo Endereço de Guarda do Acervo</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none ml-auto flex-shrink-0">
                <span className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">Sem logo</span>
                <div onClick={() => setSemLogo(v => !v)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${semLogo ? "bg-amber-500" : "bg-muted"}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${semLogo ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </div>
              </label>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ClienteSelector clientes={clientes} label="Selecionar cliente cadastrado" onSelect={c => {
              setFormAcervo({ nome: c.nome, rg: c.rg, orgaoEmissor: c.orgaoEmissor, cpf: c.cpf, nomePai: c.nomePai, nomeMae: c.nomeMae, cidade: c.cidade, estado: c.estado });
            }} />
            {clientes.length > 0 && <div className="border-t border-dashed border-border/60" />}
            <div className="space-y-1">
              <Label className="text-xs">Nome Completo</Label>
              <Input className="h-9 text-sm uppercase" value={formAcervo.nome} onChange={e => setA("nome", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">RG</Label>
                <Input className="h-9 text-sm font-mono" placeholder="0000000-0" value={formAcervo.rg} onChange={e => setA("rg", maskRg(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Órgão Emissor</Label>
                <Input className="h-9 text-sm uppercase" value={formAcervo.orgaoEmissor} onChange={e => setA("orgaoEmissor", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF</Label>
              <Input className="h-9 text-sm font-mono" value={formAcervo.cpf} onChange={e => setA("cpf", maskCpf(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Pai</Label>
                <Input className="h-9 text-sm uppercase" value={formAcervo.nomePai} onChange={e => setA("nomePai", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome da Mãe</Label>
                <Input className="h-9 text-sm uppercase" value={formAcervo.nomeMae} onChange={e => setA("nomeMae", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input className="h-9 text-sm" value={formAcervo.cidade} onChange={e => setA("cidade", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Input className="h-9 text-sm uppercase w-20" value={formAcervo.estado} onChange={e => setA("estado", e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
              Data gerada automaticamente por extenso ({dataExtenso()}).
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogAcervoOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={async () => {
              if (!formAcervo.nome || !formAcervo.rg || !formAcervo.cpf) { alert("Preencha Nome, RG e CPF."); return; }
              const ok = await gerarPDFAcervo(formAcervo, semLogo);
              if (ok) setDialogAcervoOpen(false);
            }}><Download className="h-3.5 w-3.5" />Gerar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 4: DSA ── */}
      <Dialog open={dialogDSAOpen} onOpenChange={setDialogDSAOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2 pr-6">
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="flex-1">Declaração de Segurança do Acervo (DSA)</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none ml-auto flex-shrink-0">
                <span className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">Sem logo</span>
                <div onClick={() => setSemLogo(v => !v)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${semLogo ? "bg-amber-500" : "bg-muted"}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${semLogo ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </div>
              </label>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Tipo de DSA */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDsaTipo("registro")}
                className={`h-9 rounded-md border text-xs font-medium transition-colors ${dsaTipo === "registro" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/60"}`}
              >
                Concessão de Registro
              </button>
              <button
                type="button"
                onClick={() => setDsaTipo("aquisicao")}
                className={`h-9 rounded-md border text-xs font-medium transition-colors ${dsaTipo === "aquisicao" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/60"}`}
              >
                Autorização de Aquisição
              </button>
            </div>
            <ClienteSelector clientes={clientes} label="Selecionar cliente cadastrado" onSelect={c => {
              setFormDSA(prev => ({
                ...prev,
                nome: c.nome, dataNascimento: c.dataNascimento,
                naturalidade: `${c.localNascimento}/${c.ufNascimento}`.toUpperCase(),
                endereco: c.endereco, numero: c.numero, complemento: c.complemento, bairro: c.bairro,
                cep: c.cep, cidade: c.cidade, estado: c.estado, cpf: c.cpf,
              }));
            }} />
            {clientes.length > 0 && <div className="border-t border-dashed border-border/60" />}
            <div className="space-y-1">
              <Label className="text-xs">Nome Completo</Label>
              <Input className="h-9 text-sm uppercase" value={formDSA.nome} onChange={e => setDSA("nome", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Naturalidade</Label>
                <Input className="h-9 text-sm uppercase" placeholder="MANAUS/AM" value={formDSA.naturalidade} onChange={e => setDSA("naturalidade", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de Nascimento</Label>
                <Input className="h-9 text-sm" type="date" value={formDSA.dataNascimento} onChange={e => setDSA("dataNascimento", e.target.value)}
                  onPaste={e => onPasteDate(e, v => setDSA("dataNascimento", v))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Profissão</Label>
              <Input className="h-9 text-sm uppercase" value={formDSA.profissao} onChange={e => setDSA("profissao", e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Endereço (Rua/Beco)</Label>
                <Input className="h-9 text-sm uppercase" value={formDSA.endereco} onChange={e => setDSA("endereco", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº</Label>
                <Input className="h-9 text-sm" value={formDSA.numero} onChange={e => setDSA("numero", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Complemento</Label>
                <Input className="h-9 text-sm" placeholder="s/c" value={formDSA.complemento} onChange={e => setDSA("complemento", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input className="h-9 text-sm uppercase" value={formDSA.bairro} onChange={e => setDSA("bairro", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CEP</Label>
                <Input className="h-9 text-sm font-mono" value={formDSA.cep} onChange={async e => {
                  const masked = maskCep(e.target.value); setDSA("cep", masked);
                  const addr = await buscarCep(masked);
                  if (addr) {
                    if (addr.logradouro) setDSA("endereco", titleCase(addr.logradouro));
                    if (addr.bairro) setDSA("bairro", titleCase(addr.bairro));
                    if (addr.localidade) setDSA("cidade", addr.localidade);
                    if (addr.uf) setDSA("estado", addr.uf.toUpperCase());
                  }
                }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input className="h-9 text-sm" value={formDSA.cidade} onChange={e => setDSA("cidade", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Input className="h-9 text-sm uppercase" value={formDSA.estado} onChange={e => setDSA("estado", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF</Label>
              <Input className="h-9 text-sm font-mono" value={formDSA.cpf} onChange={e => setDSA("cpf", maskCpf(e.target.value))} />
            </div>
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
              Data preenchida automaticamente: {format(getSiteDate(), "dd/MM/yyyy")}.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogDSAOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={async () => {
              if (!formDSA.nome || !formDSA.dataNascimento || !formDSA.cpf) { alert("Preencha Nome, Data de Nascimento e CPF."); return; }
              const ok = await gerarPDFDSA(formDSA, dsaTipo, semLogo);
              if (ok) setDialogDSAOpen(false);
            }}><Download className="h-3.5 w-3.5" />Gerar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 3: Residência ── */}
      <Dialog open={dialogResOpen} onOpenChange={setDialogResOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2 pr-6">
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="flex-1">Declaração de Residência</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none ml-auto flex-shrink-0">
                <span className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">Sem logo</span>
                <div onClick={() => setSemLogo(v => !v)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${semLogo ? "bg-amber-500" : "bg-muted"}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${semLogo ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </div>
              </label>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Declarante */}
            <div>
              <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Declarante (quem assina)</p>
              <div className="space-y-3">
                <ClienteSelector clientes={clientes} label="Selecionar declarante" onSelect={c => {
                  setR("nomeDeclarante", c.nome); setR("rgDeclarante", c.rg);
                  setR("orgaoDeclarante", c.orgaoEmissor); setR("cpfDeclarante", c.cpf);
                }} />
                <div className="space-y-1">
                  <Label className="text-xs">Nome Completo</Label>
                  <Input className="h-9 text-sm uppercase" value={formRes.nomeDeclarante} onChange={e => setR("nomeDeclarante", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">RG</Label>
                    <Input className="h-9 text-sm font-mono" placeholder="0000000-0" value={formRes.rgDeclarante} onChange={e => setR("rgDeclarante", maskRg(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Órgão Emissor</Label>
                    <Input className="h-9 text-sm uppercase" value={formRes.orgaoDeclarante} onChange={e => setR("orgaoDeclarante", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CPF</Label>
                    <Input className="h-9 text-sm font-mono" value={formRes.cpfDeclarante} onChange={e => setR("cpfDeclarante", maskCpf(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-border/50" />
            {/* Declarado */}
            <div>
              <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Declarado (quem reside)</p>
              <div className="space-y-3">
                <ClienteSelector clientes={clientes} label="Selecionar declarado" onSelect={c => {
                  setR("nomeDeclarado", c.nome); setR("rgDeclarado", c.rg);
                  setR("orgaoDeclarado", c.orgaoEmissor); setR("cpfDeclarado", c.cpf);
                  setR("nomePai", c.nomePai); setR("nomeMae", c.nomeMae);
                  setR("endereco", c.endereco); setR("numero", c.numero); setR("complemento", c.complemento); setR("bairro", c.bairro);
                  setR("cep", c.cep); setR("cidade", c.cidade); setR("estado", c.estado);
                }} />
                <div className="space-y-1">
                  <Label className="text-xs">Nome Completo</Label>
                  <Input className="h-9 text-sm uppercase" value={formRes.nomeDeclarado} onChange={e => setR("nomeDeclarado", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">RG</Label>
                    <Input className="h-9 text-sm font-mono" placeholder="0000000-0" value={formRes.rgDeclarado} onChange={e => setR("rgDeclarado", maskRg(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Órgão Emissor</Label>
                    <Input className="h-9 text-sm uppercase" value={formRes.orgaoDeclarado} onChange={e => setR("orgaoDeclarado", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CPF</Label>
                    <Input className="h-9 text-sm font-mono" value={formRes.cpfDeclarado} onChange={e => setR("cpfDeclarado", maskCpf(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do Pai</Label>
                    <Input className="h-9 text-sm uppercase" value={formRes.nomePai} onChange={e => setR("nomePai", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nome da Mãe</Label>
                    <Input className="h-9 text-sm uppercase" value={formRes.nomeMae} onChange={e => setR("nomeMae", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-border/50" />
            {/* Endereço */}
            <div>
              <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Endereço</p>
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Endereço (Rua/Beco)</Label>
                    <Input className="h-9 text-sm" value={formRes.endereco} onChange={e => setR("endereco", titleCase(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nº</Label>
                    <Input className="h-9 text-sm" placeholder="58" value={formRes.numero} onChange={e => setR("numero", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Complemento</Label>
                    <Input className="h-9 text-sm" placeholder="BL-10, Apt 201, s/c" value={formRes.complemento} onChange={e => setR("complemento", e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bairro</Label>
                    <Input className="h-9 text-sm" placeholder="Ex: Cidade Nova" value={formRes.bairro} onChange={e => setR("bairro", titleCase(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">CEP</Label>
                    <Input className="h-9 text-sm font-mono" value={formRes.cep} onChange={async e => {
                      const masked = maskCep(e.target.value); setR("cep", masked);
                      const addr = await buscarCep(masked);
                      if (addr) {
                        if (addr.logradouro) setR("endereco", titleCase(addr.logradouro));
                        if (addr.bairro) setR("bairro", titleCase(addr.bairro));
                        if (addr.localidade) setR("cidade", addr.localidade);
                        if (addr.uf) setR("estado", addr.uf.toUpperCase());
                      }
                    }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cidade</Label>
                    <Input className="h-9 text-sm" value={formRes.cidade} onChange={e => setR("cidade", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estado</Label>
                    <Input className="h-9 text-sm uppercase" value={formRes.estado} onChange={e => setR("estado", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-border/50" />
            {/* Anexos */}
            <div>
              <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Anexos (opcional)</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">RG (imagem ou PDF)</Label>
                  {/* RG Frente */}
                  {rgDataUrl ? (
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/30 text-sm">
                      <Paperclip className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="truncate flex-1 text-xs">{rgNome}</span>
                      <button onClick={clearRg}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                    </div>
                  ) : (
                    <>
                      <input ref={rgInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                        onChange={e => handleFileRead(e, setRgDataUrl, setRgNome)} />
                      <Button type="button" variant="outline" size="sm" className="h-9 text-xs gap-1.5 w-full justify-start"
                        onClick={() => rgInputRef.current?.click()}>
                        <Paperclip className="h-3.5 w-3.5" />Anexar RG (Frente)
                      </Button>
                    </>
                  )}
                  {/* RG Verso — aparece sempre (com ou sem frente) */}
                  {rgDataUrl2 ? (
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/30 text-sm">
                      <Paperclip className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="truncate flex-1 text-xs">{rgNome2}</span>
                      <button onClick={clearRg2}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                    </div>
                  ) : (
                    <>
                      <input ref={rgInputRef2} type="file" accept="image/*,application/pdf" className="hidden"
                        onChange={e => handleFileRead(e, setRgDataUrl2, setRgNome2)} />
                      <Button type="button" variant="outline" size="sm" className="h-9 text-xs gap-1.5 w-full justify-start"
                        onClick={() => rgInputRef2.current?.click()}>
                        <Paperclip className="h-3.5 w-3.5" />Anexar RG (Verso)
                      </Button>
                    </>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Comprovante de Residência (imagem ou PDF)</Label>
                  {compDataUrl ? (
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/30 text-sm">
                      <Paperclip className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="truncate flex-1 text-xs">{compNome}</span>
                      <button onClick={clearComp}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                    </div>
                  ) : (
                    <>
                      <input ref={compInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                        onChange={e => handleFileRead(e, setCompDataUrl, setCompNome)} />
                      <Button type="button" variant="outline" size="sm" className="h-9 text-xs gap-1.5 w-full justify-start"
                        onClick={() => compInputRef.current?.click()}>
                        <Paperclip className="h-3.5 w-3.5" />Anexar Comprovante de Residência
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
                  Anexos impressos em páginas separadas. Data: {dataExtenso()}.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogResOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={async () => {
              if (!formRes.nomeDeclarante || !formRes.nomeDeclarado || !formRes.endereco) {
                alert("Preencha Declarante, Declarado e Endereço."); return;
              }
              const ok = await gerarPDFResidencia(formRes, rgDataUrl, rgDataUrl2, compDataUrl, semLogo);
              if (ok) setDialogResOpen(false);
            }}><Download className="h-3.5 w-3.5" />Gerar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 5: Docs Emissão de CRAF ── */}
      <Dialog open={dialogCrafOpen} onOpenChange={setDialogCrafOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2 pr-6">
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="flex-1">Docs Emissão de CRAF</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none ml-auto flex-shrink-0">
                <span className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">Sem logo</span>
                <div onClick={() => setSemLogo(v => !v)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${semLogo ? "bg-amber-500" : "bg-muted"}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${semLogo ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </div>
              </label>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ClienteSelector clientes={clientes} label="Selecionar cliente cadastrado" onSelect={c => setCrafNome(c.nome)} />
            {clientes.length > 0 && <div className="border-t border-dashed border-border/60" />}
            <div className="space-y-1">
              <Label className="text-xs">Nome Completo</Label>
              <Input className="h-9 text-sm uppercase" value={crafNome} onChange={e => setCrafNome(e.target.value)} />
            </div>
            <div className="border-t border-border/50" />
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nota Fiscal (imagem ou PDF)</Label>
                {notaFiscalUrl ? (
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/30 text-sm">
                    <Paperclip className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="truncate flex-1 text-xs">{notaFiscalNome}</span>
                    <button onClick={clearNotaFiscal}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                  </div>
                ) : (
                  <>
                    <input ref={notaFiscalRef} type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={e => handleFileRead(e, setNotaFiscalUrl, setNotaFiscalNome)} />
                    <Button type="button" variant="outline" size="sm" className="h-9 text-xs gap-1.5 w-full justify-start"
                      onClick={() => notaFiscalRef.current?.click()}>
                      <Paperclip className="h-3.5 w-3.5" />Anexar Nota Fiscal
                    </Button>
                  </>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Autorização de Compra (imagem ou PDF)</Label>
                {autorizacaoCompraUrl ? (
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/30 text-sm">
                    <Paperclip className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="truncate flex-1 text-xs">{autorizacaoCompraNome}</span>
                    <button onClick={clearAutorizacaoCompra}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                  </div>
                ) : (
                  <>
                    <input ref={autorizacaoCompraRef} type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={e => handleFileRead(e, setAutorizacaoCompraUrl, setAutorizacaoCompraNome)} />
                    <Button type="button" variant="outline" size="sm" className="h-9 text-xs gap-1.5 w-full justify-start"
                      onClick={() => autorizacaoCompraRef.current?.click()}>
                      <Paperclip className="h-3.5 w-3.5" />Anexar Autorização de Compra
                    </Button>
                  </>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CNH (imagem ou PDF)</Label>
                {cnhCrafUrl ? (
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/30 text-sm">
                    <Paperclip className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="truncate flex-1 text-xs">{cnhCrafNome}</span>
                    <button onClick={clearCnhCraf}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                  </div>
                ) : (
                  <>
                    <input ref={cnhCrafRef} type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={e => handleFileRead(e, setCnhCrafUrl, setCnhCrafNome)} />
                    <Button type="button" variant="outline" size="sm" className="h-9 text-xs gap-1.5 w-full justify-start"
                      onClick={() => cnhCrafRef.current?.click()}>
                      <Paperclip className="h-3.5 w-3.5" />Anexar CNH
                    </Button>
                  </>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
                Cada documento é anexado em uma página separada do PDF final.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogCrafOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={async () => {
              const anexos = [
                notaFiscalUrl ? { label: "Nota Fiscal", dataUrl: notaFiscalUrl } : null,
                autorizacaoCompraUrl ? { label: "Autorização de Compra", dataUrl: autorizacaoCompraUrl } : null,
                cnhCrafUrl ? { label: "CNH", dataUrl: cnhCrafUrl } : null,
              ].filter((a): a is { label: string; dataUrl: string } => a !== null);
              if (anexos.length === 0) { alert("Anexe ao menos um documento."); return; }
              const ok = await gerarPDFCraf(crafNome, anexos);
              if (ok) setDialogCrafOpen(false);
            }}><Download className="h-3.5 w-3.5" />Gerar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
