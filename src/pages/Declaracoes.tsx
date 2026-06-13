import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { FileText, Plus, Download, Paperclip, X, UserPlus, Users, Pencil, Trash2, ChevronDown, Copy, Check, Eye, EyeOff, LayoutGrid, List, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Cliente ───────────────────────────────────────────────────────────────
type ClienteStatus = "doc" | "docaut" | "deferido" | "analise";

const STATUS_LABELS: Record<ClienteStatus, string> = {
  doc:      "Doc",
  docaut:   "Doc Aut.",
  deferido: "Defer.",
  analise:  "CR Anál.",
};
const STATUS_COLORS: Record<ClienteStatus, string> = {
  doc:      "text-white border-white/40 bg-white/10",
  docaut:   "text-blue-300 border-blue-400/50 bg-blue-500/10",
  deferido: "text-green-400 border-green-500/50 bg-green-500/10",
  analise:  "text-yellow-300/80 border-yellow-400/40 bg-yellow-400/10",
};
const STATUS_DOT: Record<ClienteStatus, string> = {
  doc:      "bg-white",
  docaut:   "bg-blue-300",
  deferido: "bg-green-400",
  analise:  "bg-yellow-300/80",
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
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
  senhaGov: string;
  dataEntradaProcesso: string;
  dataDeferimento: string;
  status?: ClienteStatus;
  status2?: ClienteStatus;
}

type ClienteForm = Omit<Cliente, "id">;

const EMPTY_CLIENTE: ClienteForm = {
  nome: "", rg: "", orgaoEmissor: "SSP-AM", dataExpedicao: "",
  cpf: "", nomePai: "", nomeMae: "", estadoCivil: "Solteiro(a)",
  dataNascimento: "", endereco: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "Manaus", estado: "AM",
  senhaGov: "", dataEntradaProcesso: "", dataDeferimento: "", status: "doc", status2: "doc",
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
function titleCase(s: string) { return s.replace(/\b\w/g, (c) => c.toUpperCase()); }

// ─── Redimensiona imagem ─────────────────────────────────────────────────────
async function fitImageToPage(
  dataUrl: string,
  maxW = 700, maxH = 950, quality = 0.70
): Promise<string> {
  if (!dataUrl.startsWith("data:image")) return dataUrl;
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ─── Mescla frente e verso do RG em uma única imagem (mesma folha) ────────
async function mergeImagesVertical(url1: string, url2: string): Promise<string> {
  const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
  const [img1, img2] = await Promise.all([loadImg(url1), loadImg(url2)]);

  const PAGE_W = 1300;
  const SLOT_H = 800;
  const GAP = 24;

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

  return c.toDataURL("image/jpeg", 0.88);
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

async function salvarPDF(doc: any, filename: string) {
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
      return;
    } catch (_) {}
  }
  doc.save(filename);
  sonnerToast.success("PDF baixado!", {
    description: "Verifique a pasta de Downloads.",
    duration: 4000,
  });
}

async function gerarPDF(data: FormData) {
  const hoje = format(getSiteDate(), "dd/MM/yyyy");
  const cidadeEstado = `${data.cidade.toUpperCase()} - ${data.estado.toUpperCase()}`;
  const primeiroNome = capitalize(data.nome.trim().split(/\s+/)[0] || "Declaração");
  const normAddr = (s: string) =>
    s.replace(/(\d)\s*[-]+\s*([A-Za-zÀ-ÿ])/g, "$1 - $2").replace(/\s{2,}/g, " ").trim();
  const numStr = data.numero ? `, Nº ${data.numero}` : "";
  const compNorm = normAddr((data.complemento ?? "").replace(/[-\s]+$/, "").trim());
  const compStr = compNorm ? `, ${compNorm.toUpperCase()}` : "";
  const bairroNorm = normAddr(data.bairro ?? "");
  const bairroStr = bairroNorm ? ` - ${bairroNorm.toUpperCase()},` : ",";
  const enderecoCompleto = `${data.endereco}${numStr}${compStr}${bairroStr} CEP ${data.cep}, ${data.cidade.toUpperCase()} - ${data.estado.toUpperCase()}`
    .replace(/(\d)-(\s*[A-Za-zÀ-ÿ])/g, (_, d, after) => `${d} - ${after.trimStart()}`);
  const pai = data.nomePai?.trim() ? data.nomePai.toUpperCase() : "";
  const mae = data.nomeMae?.trim() ? data.nomeMae.toUpperCase() : "";
  const filhoDe = pai && mae ? `${pai} e ${mae}` : pai || mae;

  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const W = 210, M = 20, CW = 170;
  let y = 14;

  // Título (2 linhas centradas, negrito)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("DECLARAÇÃO DE INEXISTÊNCIA DE INQUÉRITOS POLICIAIS OU", W / 2, y, { align: "center" });
  y += 5.5;
  doc.text("PROCESSOS CRIMINAIS", W / 2, y, { align: "center" });
  y += 8;

  // Corpo da declaração — nome em negrito
  doc.setFontSize(12);
  const segsInq: Array<{ text: string; bold?: boolean }> = [
    { text: "Eu, " },
    { text: data.nome.toUpperCase(), bold: true },
    { text: `, abaixo assinado, ${data.estadoCivil}, nascido em ${formatDate(data.dataNascimento)}${filhoDe ? `, filho de ${filhoDe}` : ""}, residência no(a), ${enderecoCompleto}, RG nº ${data.rg}, expedido em ${formatDate(data.dataExpedicao)}, declaro, sob as penas da lei, que não respondo a inquéritos policiais nem a processos criminais, e estou ciente de que, em caso de falsidade ideológica, ficarei sujeito às sanções prescritas no Código Penal e às demais cominações legais aplicáveis.` },
  ];
  y = writeInlinePara(doc, segsInq, M, y, CW, 5.0);
  y += 5;

  // Art. 299
  const art = `Art. 299 - Omitir, em documento público ou particular, declaração que nele deveria constar, ou nele inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sobre o fato juridicamente relevante. Pena - reclusão de 1 (um) a 5 (cinco) anos e multa, se o documento é público e reclusão de 1 (um) a 3 (três) anos, se o documento é particular.`;
  const artLines = doc.splitTextToSize(art, CW);
  doc.text(artLines, M, y, { align: "justify", maxWidth: CW });
  y += artLines.length * 6.5 + 6;

  // Validade com "90" em negrito
  const antes = "Esta declaração tem validade de ";
  const depois = " dias.";
  doc.setFont("helvetica", "normal");
  const antesW = doc.getTextWidth(antes);
  doc.text(antes, M, y);
  doc.setFont("helvetica", "bold");
  const boldW = doc.getTextWidth("90");
  doc.text("90", M + antesW, y);
  doc.setFont("helvetica", "normal");
  doc.text(depois, M + antesW + boldW, y);
  y += 18;

  // Cidade e data
  doc.text(`${cidadeEstado}, ${hoje}`, W / 2, y, { align: "center" });
  y += 42;

  // Assinatura
  doc.line(W / 2 - 40, y, W / 2 + 40, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(data.nome.toUpperCase(), W / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(data.cpf, W / 2, y, { align: "center" });

  await salvarPDF(doc, `3 Declaração de não estar respondendo a inquérito policial ou a processo criminal - ${primeiroNome}.pdf`);
}

async function gerarPDFAcervo(data: FormDataAcervo) {
  const primeiroNome = capitalize(data.nome.trim().split(/\s+/)[0] || "Declaração");
  const cidadeEstado = `${data.cidade.toUpperCase()}-${data.estado.toUpperCase()}`;
  const dia = format(getSiteDate(), "d");
  const mes = format(getSiteDate(), "MMMM", { locale: ptBR }).toUpperCase();
  const ano = format(getSiteDate(), "yyyy");
  const dataFormatada = `${cidadeEstado}, ${dia} de ${mes} de ${ano}`;
  const paiAcervo = data.nomePai?.trim() ? data.nomePai.toUpperCase() : "";
  const maeAcervo = data.nomeMae?.trim() ? data.nomeMae.toUpperCase() : "";
  const filhoDeAcervo = paiAcervo && maeAcervo ? `${paiAcervo} e ${maeAcervo}` : paiAcervo || maeAcervo;

  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const W = 210, ML = 20, MT = 25, CW = 170;
  let y = MT;

  // Título: bold, underline, uppercase, centered, 12pt
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const titleAc = "COMPROVANTE DE SEGUNDO ENDEREÇO DE GUARDA DO ACERVO";
  const titleAcLines = doc.splitTextToSize(titleAc, CW);
  titleAcLines.forEach((line: string, i: number) => {
    const ty = y + i * 6;
    doc.text(line, W / 2, ty, { align: "center" });
    const tw = doc.getTextWidth(line);
    doc.line(W / 2 - tw / 2, ty + 1, W / 2 + tw / 2, ty + 1);
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

  // "Por ser verdade, firmo o presente."
  doc.text("Por ser verdade, firmo o presente.", W / 2, y, { align: "center" });
  y += 50;

  // Data (centered)
  doc.text(dataFormatada, W / 2, y, { align: "center" });
  y += 45;

  // Assinatura
  doc.line(W / 2 - 40, y, W / 2 + 40, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(data.nome.toUpperCase(), W / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(data.cpf, W / 2, y, { align: "center" });

  await salvarPDF(doc, `8 Comprovante de Segundo Endereço de Guarda do Acervo - ${primeiroNome}.pdf`);
}

// ─── DSA — Declaração de Segurança do Acervo ──────────────────────────────
async function gerarPDFDSA(data: FormDataDSA, tipo: "registro" | "aquisicao" = "registro") {
  const primeiroNome = capitalize(data.nome.trim().split(/\s+/)[0] || "DSA");
  const cidadeEstado = `${data.cidade.toUpperCase()}/${data.estado.toUpperCase()}`;
  const hoje = format(getSiteDate(), "dd/MM/yyyy");

  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const W = 210, ML = 10, CW = 190;
  let y = 14;

  // Título: ANEXO A
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ANEXO A", W / 2, y, { align: "center" });
  y += 8;

  // Corpo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  const comp = data.complemento.trim() ? ` ${data.complemento.toUpperCase()},` : "";
  const enderecoStr = `${data.endereco.toUpperCase()} ${data.numero.toUpperCase()},${comp} ${data.bairro.toUpperCase()}, ${cidadeEstado} - CEP: ${data.cep}`;

  const finalidade = tipo === "aquisicao"
    ? "Autorização para Aquisição de Arma de Fogo"
    : "Concessão de registro";
  const segs: Array<{ text: string; bold?: boolean }> = [
    { text: "EU, " },
    { text: data.nome.toUpperCase() },
    { text: `, brasileiro(a), natural de ${data.naturalidade.toUpperCase()}, nascido em ${formatDate(data.dataNascimento)}${data.profissao.trim() ? `, ${data.profissao.toUpperCase()}` : ``}, residindo em ${enderecoStr}, e CPF nº ${data.cpf}. DECLARO, para fim de ${finalidade}, que o local de guarda do meu acervo de Atirador possui cofre ou lugar seguro, com tranca, para armazenamento das armas de fogo desmuniciadas de que sou proprietário, e de que adotarei as medidas necessárias para impedir que menor de dezoito anos de idade ou pessoa civilmente incapaz se apodere de arma de fogo sob minha posse ou de minha propriedade, observado o disposto no art. 13 da Lei nº 10.826, de 2003.` },
  ];

  y = writeInlinePara(doc, segs, ML, y, CW, 5.0);
  y += 6;

  // Data
  doc.setFont("helvetica", "bold");
  doc.text(`${cidadeEstado}, ${hoje}`, ML, y);
  y += 25;

  // Assinatura
  doc.setFont("helvetica", "normal");
  doc.line(W / 2 - 40, y, W / 2 + 40, y);
  y += 5;
  doc.text(data.nome.toUpperCase(), W / 2, y, { align: "center" });
  y += 5;
  doc.text(data.cpf, W / 2, y, { align: "center" });
  y += 30;

  // Segunda linha — Presidente da Entidade
  doc.line(W / 2 - 40, y, W / 2 + 40, y);
  y += 5;
  doc.text("PRESIDENTE DA ENTIDADE DE TIRO", W / 2, y, { align: "center" });

  const sufixo = tipo === "aquisicao"
    ? "10 Declaração de Segurança do Acervo - Aquisição"
    : "10 Declaração de Segurança do Acervo - Concessão";
  await salvarPDF(doc, `${sufixo} - ${primeiroNome}.pdf`);
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
async function renderPdfPageToJpeg(pdfDataUrl: string, scale = 2.0, quality = 0.82): Promise<string> {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  const lib = (window as any).pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await lib.getDocument(pdfDataUrl).promise;
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale });
  const c = document.createElement("canvas");
  c.width = vp.width; c.height = vp.height;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return c.toDataURL("image/jpeg", quality);
}

async function gerarPDFResidencia(data: FormDataResidencia, rgDataUrl: string | null, rgDataUrl2: string | null, compDataUrl: string | null) {
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

  // Pág 2 – RG/CNH: resolução máxima para texto nítido
  if (rgDataUrl && rgDataUrl2) {
    attachmentList.push({ dataUrl: await mergeImagesVertical(rgDataUrl, rgDataUrl2), label: "Anexo: Documento de Identidade (RG)" });
  } else if (rgDataUrl?.startsWith("data:image")) {
    attachmentList.push({ dataUrl: await fitImageToPage(rgDataUrl, 1400, 1800, 0.92), label: "Anexo: Documento de Identidade (RG)" });
  } else if (rgDataUrl?.startsWith("data:application/pdf")) {
    // scale=3.0 → ~1785×2526px — texto da CNH fica nítido
    attachmentList.push({ dataUrl: await renderPdfPageToJpeg(rgDataUrl, 3.0, 0.85), label: "Anexo: Documento de Identidade (RG)" });
  }

  // Pág 3 – Comprovante: pré-escalado para 17cm×23.5cm, sem esticar
  if (compDataUrl?.startsWith("data:image")) {
    attachmentList.push({ dataUrl: await fitImageToPage(compDataUrl, 680, 940, 0.76), label: "Anexo: Comprovante de Residência" });
  } else if (compDataUrl?.startsWith("data:application/pdf")) {
    attachmentList.push({ dataUrl: await renderPdfPageToJpeg(compDataUrl, 1.14, 0.76), label: "Anexo: Comprovante de Residência" });
  }

  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const W = 210, ML = 20, MT = 25, CW = 170;
  let y = MT;

  // Título: bold, underline, 14pt, centered
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const titleRes = "DECLARAÇÃO DE RESIDÊNCIA";
  doc.text(titleRes, W / 2, y, { align: "center" });
  const titleResW = doc.getTextWidth(titleRes);
  doc.line(W / 2 - titleResW / 2, y + 1, W / 2 + titleResW / 2, y + 1);
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

  // Cidade e data (margin-top 3cm)
  y += 30;
  doc.text(`${data.cidade}, ${dataEscrita}.`, ML, y);
  y += 40;

  // Assinatura
  doc.line(W / 2 - 40, y, W / 2 + 40, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(data.nomeDeclarante.toUpperCase(), W / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(data.cpfDeclarante, W / 2, y, { align: "center" });

  // Páginas 2+ — imagens pré-comprimidas (RG e comprovante)
  for (const att of attachmentList) {
    doc.addPage();
    const imgEl = document.createElement("img");
    imgEl.src = att.dataUrl;
    await new Promise<void>(r => { imgEl.onload = () => r(); });
    const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
    const maxImgW = 170, maxImgH = 257;
    let dw = maxImgW, dh = maxImgW / ratio;
    if (dh > maxImgH) { dh = maxImgH; dw = maxImgH * ratio; }
    const dx = (W - dw) / 2, dy = (297 - dh) / 2;
    doc.addImage(att.dataUrl, "JPEG", dx, dy, dw, dh);
  }

  await salvarPDF(doc, `6 Comprovante de Residência Fixa - ${primeiroNome}.pdf`);
}

// ─── Botão copiar ─────────────────────────────────────────────────────────
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

// ─── Seletor de cliente reutilizável ──────────────────────────────────────
function ClienteSelector({ clientes, label, onSelect }: {
  clientes: Cliente[];
  label: string;
  onSelect: (c: Cliente) => void;
}) {
  if (clientes.length === 0) return null;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-primary font-semibold">{label}</Label>
      <Select onValueChange={(id) => { const c = clientes.find(x => x.id === id); if (c) onSelect(c); }}>
        <SelectTrigger className="h-9 text-sm border-primary/40 bg-primary/5">
          <SelectValue placeholder="— Selecionar cliente cadastrado —" />
        </SelectTrigger>
        <SelectContent>
          {clientes.map(c => (
            <SelectItem key={c.id} value={c.id}>
              {c.nome} {c.cpf ? `· ${c.cpf}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
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
    nomePai: (row.nome_pai as string) ?? "",
    nomeMae: (row.nome_mae as string) ?? "",
    estadoCivil: (row.estado_civil as string) ?? "Solteiro(a)",
    dataNascimento: (row.data_nascimento as string) ?? "",
    endereco: (row.endereco as string) ?? "",
    numero: (row.numero as string) ?? "",
    complemento: (row.complemento as string) ?? "",
    bairro: (row.bairro as string) ?? "",
    cep: (row.cep as string) ?? "",
    cidade: (row.cidade as string) ?? "Manaus",
    estado: (row.estado as string) ?? "AM",
    senhaGov: (row.senha_gov as string) ?? "",
    dataEntradaProcesso: (row.data_entrada_processo as string) ?? "",
    dataDeferimento: (row.data_deferimento as string) ?? "",
  };
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function Declaracoes() {
  const { toast } = useToast();
  const { isAdmin } = useUserRole();

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

  // Clientes cadastrados
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [dialogClienteOpen, setDialogClienteOpen] = useState(false);
  const [mostrarClientes, setMostrarClientes] = useState(true);
  const [dadosVisiveis, setDadosVisiveis] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() =>
    (localStorage.getItem("decl_view_mode") as "grid" | "list") || "list"
  );
  const toggleViewMode = () => {
    setViewMode(prev => {
      const next = prev === "grid" ? "list" : "grid";
      localStorage.setItem("decl_view_mode", next);
      return next;
    });
  };
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formCliente, setFormCliente] = useState<ClienteForm>(EMPTY_CLIENTE);
  const [savingCliente, setSavingCliente] = useState(false);

  const _parsearTexto = useCallback((text: string): Partial<ClienteForm> => {
    const r: Partial<ClienteForm> = {};
    // Normaliza espaços múltiplos em cada linha (CNH digital tem "CPF   000.000.000-00")
    const linhas = text.split(/\n/).map(l => l.trim().replace(/\s+/g, " ")).filter(l => l.length > 0);
    const up = (s: string) => s.toUpperCase().trim();

    const parseData = (s: string) => {
      const m = s.match(/(\d{2})[\/\-\.\s](\d{2})[\/\-\.\s](\d{4})/);
      if (!m) return null;
      const [,d,mo,y] = m;
      if (parseInt(mo) > 12 || parseInt(d) > 31) return null;
      return `${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`;
    };

    // Pega valor: mesmo após label na mesma linha OU próxima(s) linha(s)
    const proximo = (i: number, re: RegExp, linhas2 = linhas): string => {
      const resto = linhas2[i].replace(re,"").replace(/^[\s:.\-–]+/,"").trim();
      if (resto.length > 1) return resto;
      for (let j = i+1; j < Math.min(i+4, linhas2.length); j++) {
        const v = linhas2[j].trim();
        if (v.length > 1) return v;
      }
      return "";
    };

    // Verifica se string parece um nome (2+ palavras, letras)
    const pareceNome = (s: string) => {
      const limpo = s.replace(/[^A-ZÀ-Úa-zà-ú\s]/g,"").trim();
      const palavras = limpo.split(/\s+/).filter(p => p.length >= 2);
      return palavras.length >= 2 && palavras.length <= 8 && limpo.length >= 5 && !/\d/.test(s);
    };

    // Palavras que indicam cabeçalhos de campo — não são nomes de pessoa
    const LABEL_WORDS = /\b(NOME|DATA|NASC|CPF|FILIA|PAI|MAE|MÃE|RG|REGISTRO|GERAL|EXPEDI|EMISSOR|VALID|DISPON|DIGITAL|ASSIN|CERTIF|SERPRO|CONFORM|PROVISÓ|PROGRAM|ENDERE|BAIRRO|CEP|ESTADO|CIDADE|NATURAL|DOC|IDENTIDADE|HABILI|CATEG|PRONTU|CNH|SENATRAN|BRASIL|TRANSPORT|REPUB|MINIST|RENACH|SECRETARIA|FEDERAL|NACIONAL|TRANSITO|TRÂNSITO|PORTADOR|TITULAR|PROCESSO|DISPONÍV|HTTP|ASSINAT|INTEGRI|AUTENT)\b/i;

    // Remove datas de uma string para extrair só o nome
    const extrairNome = (s: string) => s.replace(/\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}/g,"").replace(/\s+/g," ").trim();

    // ── Varredura linha por linha ──
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      const U = up(l);

      // CPF — busca padrão XXX.XXX.XXX-XX ou 11 dígitos seguidos
      // Normaliza espaços ao redor de pontos/hífens (CNH digital: "123 . 456 . 789 - 00")
      if (!r.cpf) {
        const lNorm = l.replace(/(\d)\s*\.\s*(\d)/g,"$1.$2").replace(/(\d)\s*-\s*(\d)/g,"$1-$2");
        const m = lNorm.match(/\b(\d{3}[\s\.]?\d{3}[\s\.]?\d{3}[\s\-]?\d{2})\b/);
        if (m) {
          const d = m[1].replace(/\D/g,"");
          if (d.length === 11 && !d.startsWith("00000")) r.cpf = maskCpf(d);
        }
        // Se linha só tem dígitos e label CPF na linha anterior
        if (!r.cpf) {
          const raw = l.replace(/[^\d]/g,"");
          if (raw.length === 11 && !raw.startsWith("00000") && /CPF/i.test((linhas[i-1]||""))) {
            r.cpf = maskCpf(raw);
          }
        }
      }

      // RG
      if (!r.rg) {
        if (/REGISTRO\s*GERAL|^\s*R\.?G\.?\s*$/i.test(U)) {
          const val = proximo(i, /REGISTRO\s*GERAL|R\.?G\.?/i);
          const m = val.match(/(\d[\d\.\-\/\s]{4,14}\d)/);
          if (m) r.rg = maskRg(m[1].replace(/\D/g,""));
        }
        if (!r.rg) {
          const m = l.match(/\bR\.?G\.?[:\s#Nº°]*(\d[\d\.\-\/]{4,14})/i);
          if (m) r.rg = maskRg(m[1].replace(/\D/g,""));
        }
      }

      // NOME — label na linha, valor na mesma ou próxima
      if (!r.nome) {
        // Caso 1: "NOME" sozinho, "NOME COMPLETO", "NOME DO PORTADOR/TITULAR"
        if (/^NOME(\s+COMPLETO|\s+DO\s+(?:PORTADOR|TITULAR))?\s*$/i.test(l)) {
          const val = extrairNome(proximo(i, /NOME(\s+COMPLETO|\s+DO\s+\w+)?/i));
          if (pareceNome(val)) r.nome = up(val);
        }
        // Caso 2: "NOME: valor" na mesma linha
        else if (/^NOME\s*[:\-]/i.test(l)) {
          const val = l.replace(/^NOME\s*[:\-]\s*/i,"").trim();
          if (pareceNome(val)) r.nome = up(val);
        }
        // Caso 3: CNH física — "2 e 1 NOME E SOBRENOME" (número + NOME + outros campos)
        // O valor do nome está na próxima linha
        else if (/^\d[\de\s]+NOME\b/i.test(l)) {
          const nextLine = linhas[i+1]?.trim() || "";
          const val = extrairNome(nextLine);
          if (pareceNome(val)) r.nome = up(val);
        }
        // Caso 4: CNH — "NOME DATA DE NASCIMENTO" (dois labels na mesma linha)
        // O valor está na PRÓXIMA linha junto com a data
        else if (/^NOME\b/i.test(l) && LABEL_WORDS.test(l)) {
          const nextLine = linhas[i+1]?.trim() || "";
          const val = extrairNome(nextLine);
          if (pareceNome(val)) r.nome = up(val);
          // Aproveita e tenta extrair dataNascimento da mesma linha de valores
          if (!r.dataNascimento && /NASC/i.test(l)) {
            const d = parseData(nextLine);
            if (d) r.dataNascimento = d;
          }
        }
      }

      // FILIAÇÃO — bloco com pai e mãe (CNH digital pode ter vários formatos)
      // Regex aceita OCR comuns: FILIAÇÃO / FILIACAO / FILIAGAO
      if (/\bFILIA[ÇCG][AÃA]O\b/i.test(l)) {
        // Caso A: "FILIAÇÃO: PAI / MÃE" ou "FILIAÇÃO PAI MÃE" inline
        const afterFil = l.replace(/.*?\bFILIA[ÇCG][AÃA]O\s*[:\-]?\s*/i,"").trim();
        if (afterFil) {
          const slash = afterFil.split(/\s*\/\s*/);
          if (slash.length >= 2) {
            if (pareceNome(slash[0]) && !r.nomePai) r.nomePai = up(slash[0]);
            if (pareceNome(slash[1]) && !r.nomeMae) r.nomeMae = up(slash[1]);
          } else if (pareceNome(afterFil) && !r.nomePai) {
            r.nomePai = up(afterFil);
          }
        }
        // Caso B: nomes nas próximas linhas (janela ampliada, break menos agressivo)
        if (!r.nomePai || !r.nomeMae) {
          let found = r.nomePai ? 1 : 0;
          for (let j = i+1; j < Math.min(i+12, linhas.length); j++) {
            const v = linhas[j].trim();
            if (!v) continue;
            // Para em linhas claramente de outro campo
            if (/^(?:NACIONAL|CATEGOR|PRONTU|RENACH|REGISTRO|CPF|DOC\.?\s*IDENT|HABILI|VALIDADE|CAT\s*HAB|Nº\s*REG|CARTEIRA|MINISTERIO|MINIST[ÉE]RIO|SENATRAN|BRASIL|DETRAN)/i.test(v)) break;
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) break; // linha só com data isolada
            // Ignora linhas de cabeçalho/label (ex: "CARTEIRA NACIONAL", "REPÚBLICA FEDERATIVA")
            if (LABEL_WORDS.test(v)) continue;
            // Dois nomes na mesma linha (CNH digital pode concatenar)
            if (!r.nomePai && !r.nomeMae) {
              const words = v.split(/\s+/);
              if (words.length > 6 && words.length <= 14 && !/\d/.test(v)) {
                const slash2 = v.split(/\s*\/\s*/);
                if (slash2.length >= 2 && pareceNome(slash2[0]) && pareceNome(slash2[1])) {
                  r.nomePai = up(slash2[0]); r.nomeMae = up(slash2[1]); break;
                }
                // Divide no meio como última tentativa
                const mid = Math.ceil(words.length / 2);
                const n1 = words.slice(0, mid).join(" ");
                const n2 = words.slice(mid).join(" ");
                if (n1.split(/\s+/).length >= 2 && n2.split(/\s+/).length >= 2) {
                  r.nomePai = up(n1); r.nomeMae = up(n2); break;
                }
              }
            }
            // Um nome por linha
            if (pareceNome(v)) {
              if (found === 0 && !r.nomePai) { r.nomePai = up(v); found++; }
              else if (found >= 1 && !r.nomeMae) { r.nomeMae = up(v); break; }
            }
          }
        }
      }

      // PAI
      if (!r.nomePai) {
        if (/^(?:NOME\s+DO\s+)?PAI\s*$/i.test(l)) {
          const val = proximo(i, /(?:NOME\s+DO\s+)?PAI/i);
          if (pareceNome(val)) r.nomePai = up(val);
        } else if (/\bPAI\s*[:\-]\s*/i.test(l) && !/BRASIL|ESTADO|REPUBLICA/i.test(l)) {
          const val = l.replace(/.*\bPAI\s*[:\-]\s*/i,"").trim();
          if (pareceNome(val)) r.nomePai = up(val);
        }
      }

      // MÃE
      if (!r.nomeMae) {
        if (/^(?:NOME\s+DA\s+)?M[ÃA]E\s*$/i.test(l)) {
          const val = proximo(i, /(?:NOME\s+DA\s+)?M[ÃA]E/i);
          if (pareceNome(val)) r.nomeMae = up(val);
        } else if (/\bM[ÃA]E\s*[:\-]\s*/i.test(l) && !/BRASIL|ESTADO/i.test(l)) {
          const val = l.replace(/.*\bM[ÃA]E\s*[:\-]\s*/i,"").trim();
          if (pareceNome(val)) r.nomeMae = up(val);
        }
      }

      // DATA DE NASCIMENTO
      // CNH usa "3 DATA, LOCAL E UF DE NASCIMENTO" na label e a data na próxima linha
      if (!r.dataNascimento && /NASC(?:IMENTO)?/i.test(U)) {
        const val = proximo(i, /DATA\s+(?:DE\s+)?NASC(?:IMENTO)?|DT\.?\s*NASC/i);
        // Se proximo retornou a própria label (sem data), tenta linha seguinte explicitamente
        const d = parseData(val) || parseData(l) || parseData(linhas[i+1] ?? "") || parseData(linhas[i+2] ?? "");
        if (d) r.dataNascimento = d;
      }

      // DATA DE EXPEDIÇÃO / EMISSÃO
      // CNH usa "4a DATA EMISSÃO" na label e a data na próxima linha
      if (!r.dataExpedicao && /EXPEDI|EMISS[AÃ]O|DT\.?\s*EXP/i.test(U)) {
        const val = proximo(i, /DATA\s+(?:DE\s+)?(?:EXPEDI[ÇC][AÃ]O|EMISS[AÃ]O)|DT\.?\s*EXP/i);
        const d = parseData(val) || parseData(l) || parseData(linhas[i+1] ?? "") || parseData(linhas[i+2] ?? "");
        if (d) r.dataExpedicao = d;
      }

      // ÓRGÃO EMISSOR — só pega em linhas com dados, não cabeçalhos
      if (!r.orgaoEmissor && !/^(?:MINISTÉRIO|SECRETARIA|REPÚBLICA|SENATRAN)/i.test(l)) {
        const m = l.match(/\b((?:SSP|SPTC|PC|DETRAN|MD|PMAM|PM|DPF|SEDS|SESP|SEPC|CRB|SDS|PCAM|SESDC)[-\/\s]?(?:[A-Z]{2})?)\b/);
        if (m && m[1].length >= 4) r.orgaoEmissor = m[1].replace(/\s/,"-").toUpperCase().replace(/-$/,"");
      }
      if (!r.orgaoEmissor && /ÓRG[AÃ]O\s*EMISSOR|ORGAO\s*EMISSOR/i.test(U)) {
        const val = proximo(i, /ÓRG[AÃ]O\s*EMISSOR|ORGAO\s*EMISSOR/i);
        if (val && val.length < 30) r.orgaoEmissor = up(val);
      }

      // ENDEREÇO
      if (!r.endereco && /^(?:ENDERE[ÇC]O|LOGRADOURO)\s*[:\-]?\s*/i.test(l)) {
        const val = proximo(i, /ENDERE[ÇC]O|LOGRADOURO/i);
        if (val.length > 4) r.endereco = up(val);
      }

      // BAIRRO
      if (!r.bairro && /^BAIRRO\s*[:\-]?\s*/i.test(l)) {
        const val = proximo(i, /BAIRRO/i);
        if (val.length > 2) r.bairro = up(val);
      }

      // CIDADE / NATURALIDADE / MUNICÍPIO
      if (!r.cidade && /^(?:MUNIC[ÍI]PIO|CIDADE|NATURALIDADE)\s*[:\-]?\s*/i.test(l)) {
        const val = proximo(i, /MUNIC[ÍI]PIO|CIDADE|NATURALIDADE/i);
        if (val) r.cidade = val.split(/[\-\/]/)[0].trim();
      }

      // CEP — só extrai se a linha menciona "CEP" explicitamente
      // (CNH não tem campo CEP; sem esse filtro números do RENACH/RG são capturados errado)
      if (!r.cep && /\bCEP\b/i.test(l)) {
        const m = l.match(/\b(\d{5}[\-\s]?\d{3})\b/);
        if (m) { const d = m[1].replace(/\D/g,""); if (d.length === 8) r.cep = maskCep(d); }
      }

      // Nº — ignora referências legais como "nº 2200-2/2001"
      if (!r.numero) {
        const m = l.match(/\bN[º°ú\.]\s*(\d{1,6})(?![\d\/\-])\b/i);
        if (m) r.numero = m[1];
      }
    }

    // ── Fallback global: busca datas por faixa de ano plausível ──
    // dataNascimento: ano <= 2008 (mínimo 16 anos para habilitação)
    // dataExpedicao : ano >= 2000 (documento recente)
    // Evita pegar a data de "1ª HABILITAÇÃO" como nascimento
    const anoAtual = new Date().getFullYear();
    const todasDatas = [...text.matchAll(/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/g)]
      .map(m => parseData(m[0])).filter(Boolean) as string[];
    if (!r.dataNascimento) {
      const nascCandidata = todasDatas.find(d => {
        const ano = parseInt(d.slice(0,4));
        return ano >= 1920 && ano <= anoAtual - 16;
      });
      if (nascCandidata) r.dataNascimento = nascCandidata;
    }
    if (!r.dataExpedicao) {
      const expCandidata = todasDatas.find(d => {
        const ano = parseInt(d.slice(0,4));
        return ano >= 2000 && ano <= anoAtual + 10;
      });
      if (expCandidata) r.dataExpedicao = expCandidata;
    }

    // ── Fallback global: CPF ──
    if (!r.cpf) {
      // Normaliza espaços ao redor de separadores (CNH digital: "123 . 456 . 789 - 00")
      const normText = text
        .replace(/(\d)\s*\.\s*(\d)/g,"$1.$2")
        .replace(/(\d)\s*-\s*(\d)/g,"$1-$2")
        .replace(/\s+/g," ");
      for (const m of normText.matchAll(/\b(\d{3}[\s\.]?\d{3}[\s\.]?\d{3}[\s\-]?\d{2})\b/g)) {
        const d = m[1].replace(/\D/g,"");
        if (d.length === 11 && !d.startsWith("00000")) { r.cpf = maskCpf(d); break; }
      }
    }

    // ── Fallback global: RG ──
    if (!r.rg) {
      const m = text.match(/\bR\.?G\.?[:\s#Nº°]*(\d[\d\.\-]{5,12})/i);
      if (m) r.rg = maskRg(m[1].replace(/\D/g,""));
    }

    // ── CNH: DOC. IDENTIDADE / ORG. EMISSOR (ex: "1735427-7 SSP/AM") ──
    if (!r.rg || !r.orgaoEmissor) {
      const normText = text.replace(/\s+/g," ");
      // Label "DOC. IDENTIDADE / ÓRG. EMISSOR / UF" seguido pelos valores (aceita ÓRG e ORG)
      const cnh1 = normText.match(/DOC\.?\s*IDENTIDADE[\s\/,]+[ÓO]?RG\.?\s*EMISSOR[\s\/,A-Z]*[:\s]*([^\n]{5,40})/i);
      if (cnh1) {
        const partes = cnh1[1].trim().split(/\s+/);
        for (const p of partes) {
          if (!r.rg && /^\d[\d\.\-]{5,12}$/.test(p)) r.rg = maskRg(p.replace(/\D/g,""));
          if (!r.orgaoEmissor && /^[A-Z]{2,8}$/.test(p) && !/^[AEIOU]{2,}$/i.test(p)) r.orgaoEmissor = p;
        }
      }
      // Formato direto na linha de valor: "1735427-7 SSP AM" ou "1735427-7/SSP-AM"
      const cnh2 = normText.match(/\b(\d{5,10}[\-\.]?\d{1,2})\s*[\/\s]\s*(SSP|SPTC|PC|DETRAN|MD|DPF|PCAM)\s*[\-\/]?\s*([A-Z]{2})\b/i);
      if (cnh2) {
        if (!r.rg) r.rg = maskRg(cnh2[1].replace(/\D/g,""));
        if (!r.orgaoEmissor) r.orgaoEmissor = `${cnh2[2]}-${cnh2[3]}`.toUpperCase();
      }
    }

    // ── CNH: NOME — fallback geral por todo o texto ──
    if (!r.nome) {
      for (const linha of linhas) {
        if (LABEL_WORDS.test(linha)) continue;            // Pula linhas de label/cabeçalho
        if (/^\d/.test(linha)) continue;                  // Pula linhas que começam com número
        if (linha.endsWith(":")) continue;                // Pula labels que terminam com ":"
        if (/^https?:\/\//i.test(linha)) continue;       // Pula URLs
        if (linha.length > 60) continue;                  // Pula linhas muito longas (não são nomes)
        const val = extrairNome(linha);
        if (pareceNome(val) && val.split(/\s+/).length >= 2 && val.length <= 50) {
          r.nome = up(val); break;
        }
      }
    }

    return r;
  }, []);

  // Salva clientes na tabela compartilhada declaracao_clientes (acessível por admin e moderador)
  // Retorna true se salvou com sucesso, false caso contrário
  const saveClientesToCloud = useCallback(async (list: Cliente[]): Promise<boolean> => {
    try {
      const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      // Se todos os itens têm UUIDs, é um save normal (pode deletar rows ausentes)
      // Se algum tem ID antigo (timestamp), é migração — não deve deletar rows existentes
      const allHaveUUIDs = list.length === 0 || list.every(c => isUUID(c.id));

      // Upsert todos os clientes
      if (list.length > 0) {
        const rows = list.map(c => ({
          // Só inclui id se for UUID válido (não IDs antigos baseados em timestamp)
          ...(isUUID(c.id) ? { id: c.id } : {}),
          nome: c.nome,
          rg: c.rg,
          orgao_emissor: c.orgaoEmissor,
          data_expedicao: c.dataExpedicao,
          cpf: c.cpf,
          nome_pai: c.nomePai,
          nome_mae: c.nomeMae,
          estado_civil: c.estadoCivil,
          data_nascimento: c.dataNascimento,
          endereco: c.endereco,
          numero: c.numero,
          complemento: c.complemento,
          bairro: c.bairro,
          cep: c.cep,
          cidade: c.cidade,
          estado: c.estado,
          senha_gov: c.senhaGov,
          data_entrada_processo: c.dataEntradaProcesso || null,
          data_deferimento: c.dataDeferimento || null,
          status: c.status ?? "doc",
          status2: c.status2 ?? "doc",
        }));
        const { error } = await supabase.from("declaracao_clientes").upsert(rows, { onConflict: "id" });
        if (error) {
          console.error("[saveClientesToCloud] upsert error:", error.message, error);
          // Qualquer erro 400 = alguma coluna não existe. Tenta sem status/status2 como fallback
          const rowsSemStatus = rows.map(({ status: _s, status2: _s2, ...r }) => r);
          const { error: error2 } = await supabase.from("declaracao_clientes").upsert(rowsSemStatus, { onConflict: "id" });
          if (error2) {
            console.error("[saveClientesToCloud] fallback error:", error2.message);
            return false;
          }
        }
      }
      // Deleta clientes removidos da lista (só em save normal com UUIDs, não durante migração de metadata)
      if (allHaveUUIDs) {
        const { data: existing } = await supabase.from("declaracao_clientes").select("id");
        const listIds = new Set(list.map(c => c.id));
        const toDelete = (existing || []).map((r: any) => r.id).filter((id: string) => !listIds.has(id));
        if (toDelete.length > 0) {
          await supabase.from("declaracao_clientes").delete().in("id", toDelete);
        }
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const fetchClientes = useCallback(async () => {
    try {
      // Lê da tabela compartilhada (admin e moderador têm acesso)
      const { data: rows, error } = await supabase
        .from("declaracao_clientes")
        .select("*")
        .order("nome", { ascending: true });

      if (!error && rows && rows.length > 0) {
        const clientes: Cliente[] = rows.map((r: any) => ({
          id: r.id,
          nome: r.nome,
          rg: r.rg,
          orgaoEmissor: r.orgao_emissor,
          dataExpedicao: r.data_expedicao,
          cpf: r.cpf,
          nomePai: r.nome_pai,
          nomeMae: r.nome_mae,
          estadoCivil: r.estado_civil,
          dataNascimento: r.data_nascimento,
          endereco: r.endereco,
          numero: r.numero,
          complemento: r.complemento ?? "",
          bairro: r.bairro,
          cep: r.cep,
          cidade: r.cidade,
          estado: r.estado,
          senhaGov: r.senha_gov,
          dataEntradaProcesso: r.data_entrada_processo ?? "",
          dataDeferimento: r.data_deferimento ?? "",
          status: (r.status ?? "doc") as ClienteStatus,
          status2: (r.status2 ?? "doc") as ClienteStatus,
        }));
        setClientes(clientes);

        // Migra dados antigos do user_metadata se existirem
        const { data: { user } } = await supabase.auth.getUser();
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
      } else {
        // Fallback: tenta user_metadata (migração)
        const { data: { user } } = await supabase.auth.getUser();
        const cloud: Cliente[] = user?.user_metadata?.decl_clientes ?? [];
        if (cloud.length > 0) {
          const saved = await saveClientesToCloud(cloud);
          setClientes(cloud);
          // CRÍTICO: só limpa user_metadata se o save foi confirmado com sucesso
          if (saved) {
            await supabase.auth.updateUser({ data: { decl_clientes: null } });
          }
        } else {
          setClientes([]);
        }
      }
    } catch {
      setClientes([]);
    }
    setLoadingClientes(false);
  }, [saveClientesToCloud]);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  const setC = (field: keyof ClienteForm, value: string) =>
    setFormCliente(prev => ({ ...prev, [field]: value }));

  const abrirNovoCliente = () => {
    setEditandoId(null);
    setFormCliente(EMPTY_CLIENTE);
    setDialogClienteOpen(true);
  };
  const abrirEditarCliente = (c: Cliente) => {
    setEditandoId(c.id);
    const { id: _id, ...rest } = c;
    setFormCliente(rest);
    setDialogClienteOpen(true);
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
      endereco: formCliente.endereco,
      numero: formCliente.numero,
      complemento: formCliente.complemento,
      bairro: formCliente.bairro,
      cep: formCliente.cep,
      cidade: formCliente.cidade,
      estado: formCliente.estado,
      senha_gov: formCliente.senhaGov,
      data_entrada_processo: formCliente.dataEntradaProcesso || null,
      data_deferimento: formCliente.dataDeferimento || null,
      status: formCliente.status ?? "doc",
      status2: formCliente.status2 ?? "doc",
      updated_at: new Date().toISOString(),
    };
    const doSave = async (p: typeof payload) => {
      if (editandoId) {
        const { error } = await supabase.from("declaracao_clientes").update(p).eq("id", editandoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("declaracao_clientes").insert(p);
        if (error) throw error;
      }
    };
    try {
      await doSave(payload);
      setDialogClienteOpen(false);
      toast({ title: editandoId ? "Cliente atualizado!" : "Cliente cadastrado!" });
      await fetchClientes();
    } catch (e: unknown) {
      const errMsg: string = (e as any)?.message ?? "";
      // Column complemento missing in DB — apply migration + reload schema cache then retry
      if (errMsg.includes("complemento") || (e as any)?.code === "42703") {
        try {
          await supabase.functions.invoke("run-migration", {
            body: { sql: "DO $$ BEGIN ALTER TABLE declaracao_clientes ADD COLUMN IF NOT EXISTS complemento TEXT NOT NULL DEFAULT ''; PERFORM pg_notify('pgrst', 'reload schema'); END $$;" },
          });
          // Wait for PostgREST schema cache to reload
          await new Promise(r => setTimeout(r, 2500));
          await doSave(payload);
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
    const novaLista = clientes.filter(c => c.id !== id);
    await saveClientesToCloud(novaLista);
    setClientes(novaLista);
  };

  const alterarStatus = async (id: string, status: ClienteStatus) => {
    const novaLista = clientes.map(c => c.id === id ? { ...c, status } : c);
    await saveClientesToCloud(novaLista);
    setClientes(novaLista);
  };

  const alterarStatus2 = async (id: string, status2: ClienteStatus) => {
    const novaLista = clientes.map(c => c.id === id ? { ...c, status2 } : c);
    await saveClientesToCloud(novaLista);
    setClientes(novaLista);
  };

  // Diálogo 1 — Inquérito
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const set = (field: keyof FormData, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  // Diálogo 2 — Acervo
  const [dialogAcervoOpen, setDialogAcervoOpen] = useState(false);

  // Diálogo 4 — DSA
  const [dialogDSAOpen, setDialogDSAOpen] = useState(false);
  const [formDSA, setFormDSA] = useState<FormDataDSA>(EMPTY_FORM_DSA);
  const setDSA = (field: keyof FormDataDSA, value: string) => setFormDSA(prev => ({ ...prev, [field]: value }));
  const [dsaTipo, setDsaTipo] = useState<"registro" | "aquisicao">("registro");
  const [searchParams, setSearchParams] = useSearchParams();
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

  // Abre dialog via URL param ?open=inquerito|acervo|residencia
  useEffect(() => {
    const open = searchParams.get("open");
    if (!open) return;
    if (open === "inquerito") { setForm(EMPTY_FORM); setDialogOpen(true); }
    else if (open === "acervo") { setFormAcervo(EMPTY_FORM_ACERVO); setDialogAcervoOpen(true); }
    else if (open === "residencia") { setFormRes(EMPTY_FORM_RES); clearRg(); clearComp(); setDialogResOpen(true); }
    else if (open === "dsa") { setFormDSA(EMPTY_FORM_DSA); setDialogDSAOpen(true); }
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Declarações</h1>
            <p className="text-sm text-muted-foreground">Área restrita — Administradores e Moderadores</p>
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
                </>
              )}
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={abrirNovoCliente}>
                <UserPlus className="h-3.5 w-3.5" />Cadastrar Cliente
              </Button>
            </div>
          </CardHeader>
          {mostrarClientes && (
            <CardContent>
              {loadingClientes ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Carregando clientes...</p>
              ) : clientes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum cliente cadastrado. Cadastre clientes para preencher declarações automaticamente.
                </p>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...clientes].sort((a, b) => {
                    const order: Record<string, number> = { doc: 0, deferido: 1, analise: 2, docaut: 3 };
                    const sa = order[a.status ?? "doc"] ?? 0;
                    const sb = order[b.status ?? "doc"] ?? 0;
                    if (sa !== sb) return sa - sb;
                    if ((a.status ?? "doc") === "deferido") {
                      const da = a.dataEntradaProcesso ? (a.dataDeferimento ? differenceInDays(parseISO(a.dataDeferimento), parseISO(a.dataEntradaProcesso)) : differenceInDays(new Date(), parseISO(a.dataEntradaProcesso))) : 9999;
                      const db = b.dataEntradaProcesso ? (b.dataDeferimento ? differenceInDays(parseISO(b.dataDeferimento), parseISO(b.dataEntradaProcesso)) : differenceInDays(new Date(), parseISO(b.dataEntradaProcesso))) : 9999;
                      return da - db;
                    }
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
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── Modo Lista ── */
                <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                  {/* Cabeçalho da tabela */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 items-center px-3 py-1.5 bg-muted/40">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-32 text-center">CPF / Senha</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-20 text-center">RG</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-28 text-center">Status</span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-14 text-center">Ações</span>
                  </div>
                  {[...clientes].sort((a, b) => {
                    const order: Record<string, number> = { doc: 0, deferido: 1, analise: 2, docaut: 3 };
                    const sa = order[a.status ?? "doc"] ?? 0;
                    const sb = order[b.status ?? "doc"] ?? 0;
                    if (sa !== sb) return sa - sb;
                    if ((a.status ?? "doc") === "deferido") {
                      const da = a.dataEntradaProcesso ? (a.dataDeferimento ? differenceInDays(parseISO(a.dataDeferimento), parseISO(a.dataEntradaProcesso)) : differenceInDays(new Date(), parseISO(a.dataEntradaProcesso))) : 9999;
                      const db = b.dataEntradaProcesso ? (b.dataDeferimento ? differenceInDays(parseISO(b.dataDeferimento), parseISO(b.dataEntradaProcesso)) : differenceInDays(new Date(), parseISO(b.dataEntradaProcesso))) : 9999;
                      return da - db;
                    }
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
                      <div className="w-14 flex items-center gap-0.5 justify-center">
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
              )}
            </CardContent>
          )}
        </Card>

      </div>

      {/* ── Dialog: Cadastro de Cliente ── */}
      <Dialog open={dialogClienteOpen} onOpenChange={setDialogClienteOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              {editandoId ? "Editar Cliente" : "Cadastrar Cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-1">
              <Label className="text-xs">Nome Completo *</Label>
              <div className="flex gap-1.5">
                <Input className="h-9 text-sm uppercase" placeholder="Nome completo"
                  value={formCliente.nome} onChange={e => setC("nome", e.target.value.toUpperCase())} />
                <CopyButton value={formCliente.nome} />
              </div>
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
                    value={formCliente.dataNascimento} onChange={e => setC("dataNascimento", e.target.value)} />
                  <CopyButton value={formCliente.dataNascimento} />
                </div>
              </div>
            </div>
            {/* Pais */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Pai</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm uppercase" placeholder="Nome do pai"
                    value={formCliente.nomePai} onChange={e => setC("nomePai", e.target.value)} />
                  <CopyButton value={formCliente.nomePai} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome da Mãe</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm uppercase" placeholder="Nome da mãe"
                    value={formCliente.nomeMae} onChange={e => setC("nomeMae", e.target.value)} />
                  <CopyButton value={formCliente.nomeMae} />
                </div>
              </div>
            </div>
            {/* Endereço */}
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
                <Label className="text-xs">CEP</Label>
                <div className="flex gap-1.5">
                  <Input className="h-9 text-sm font-mono" placeholder="00.000-000"
                    value={formCliente.cep} onChange={e => setC("cep", maskCep(e.target.value))} />
                  <CopyButton value={formCliente.cep} />
                </div>
              </div>
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
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogClienteOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={salvarCliente} disabled={savingCliente}>
              <UserPlus className="h-3.5 w-3.5" />{savingCliente ? "Salvando..." : editandoId ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 1: Inquérito Policial ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Declaração de Inexistência de Inquéritos Policiais ou Processos Criminais
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
                <Input className="h-9 text-sm" type="date" value={form.dataNascimento} onChange={e => set("dataNascimento", e.target.value)} />
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
                <Input className="h-9 text-sm font-mono" value={form.cep} onChange={e => set("cep", maskCep(e.target.value))} />
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
              await gerarPDF(form);
              setDialogOpen(false);
            }}><Download className="h-3.5 w-3.5" />Gerar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 2: Acervo ── */}
      <Dialog open={dialogAcervoOpen} onOpenChange={setDialogAcervoOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Comprovante de Segundo Endereço de Guarda do Acervo
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
              await gerarPDFAcervo(formAcervo);
              setDialogAcervoOpen(false);
            }}><Download className="h-3.5 w-3.5" />Gerar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 4: DSA ── */}
      <Dialog open={dialogDSAOpen} onOpenChange={setDialogDSAOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Declaração de Segurança do Acervo (DSA)
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
                <Input className="h-9 text-sm" type="date" value={formDSA.dataNascimento} onChange={e => setDSA("dataNascimento", e.target.value)} />
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
                <Input className="h-9 text-sm font-mono" value={formDSA.cep} onChange={e => setDSA("cep", e.target.value)} />
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
              await gerarPDFDSA(formDSA, dsaTipo);
              setDialogDSAOpen(false);
            }}><Download className="h-3.5 w-3.5" />Gerar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 3: Residência ── */}
      <Dialog open={dialogResOpen} onOpenChange={setDialogResOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />Declaração de Residência
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
                    <Input className="h-9 text-sm font-mono" value={formRes.cep} onChange={e => setR("cep", maskCep(e.target.value))} />
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
              await gerarPDFResidencia(formRes, rgDataUrl, rgDataUrl2, compDataUrl);
              setDialogResOpen(false);
            }}><Download className="h-3.5 w-3.5" />Gerar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
