import { useState, useEffect } from "react";
import { ClipboardList, Download, CalendarIcon, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────────────────
type SistReg = "" | "SINARM" | "SIGMA";

type Finalidade = "aquisicao" | "porte" | "cr";
type Categoria  = "defesa" | "institucional" | "cac";

// Armas pré-definidas do Laudo SINARM Posse/Porte
const ARMAS_SINARM = [
  { id: "g25",   label: "PISTOLA 380 GLOCK G25 PYM 777" },
  { id: "ack",   label: "REVOLVER 357 TAURUS ACK 359643" },
  { id: "rt85",  label: "REVOLVER 38 85S TAURUS ACL 493291" },
  { id: "58hc",  label: "PISTOLA 380 TAURUS 58HC AEK783002" },
  { id: "puma",  label: "RIFLE PUMA 357 CBC NWE 4872174" },
  { id: "t4",    label: "RIFLE T4 556 ABJ 857767" },
  { id: "gx4",   label: "PISTOLA 9MM TAURUS GX4 ADK 818094" },
  { id: "boito", label: "ESPINGARDA 12 BOITO G115340-22" },
] as const;
type ArmaSinarmId = typeof ARMAS_SINARM[number]["id"];

interface LaudoForm {
  numero: string;
  nome: string;
  cpf: string;
  endereco: string;
  endNumero: string;
  endCompl: string;
  endBairro: string;
  pistola: SistReg;
  revolver: SistReg;
  rifle: SistReg;
  espingarda: SistReg;
  dataDecl: string;
  local: "" | "juliet" | "texas" | "cta";
  finalidade: Finalidade[];   // múltipla seleção
  categoria: Categoria[];     // múltipla seleção
  notaTeorica: string;
  notaPistola: string;
  notaRevolver: string;
  notaRifle: string;
  notaEspingarda: string;
  notaMulticolorido: string;  // SINARM: pontuação alvo multicolorido
  armasSinarm: ArmaSinarmId[]; // SINARM: armas selecionadas
  conclusao: "" | "apto" | "inapto";
  dataFinal: string;
}

const EMPTY: LaudoForm = {
  numero: "", nome: "", cpf: "", endereco: "", endNumero: "", endCompl: "", endBairro: "",
  pistola: "", revolver: "", rifle: "", espingarda: "",
  dataDecl: "", local: "",
  finalidade: [], categoria: [],
  notaTeorica: "20", notaPistola: "", notaRevolver: "", notaRifle: "", notaEspingarda: "",
  notaMulticolorido: "", armasSinarm: [],
  conclusao: "", dataFinal: "",
};

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

function maskCpf(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function fmtDate(iso: string) {
  if (!iso) return "____/____/________";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = () => res(); s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ─── PDF idêntico ao original ────────────────────────────────────────────────────
async function gerarLaudoPDF(f: LaudoForm, tipo: "cr_cac" | "sinarm") {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  const PW = 210;
  const ML = 10, CW = 190; // content width
  const HDR = 6.5; // section header height

  // Font helpers — mesma família (helvetica = Arial) e tamanhos do documento original
  const B = (sz: number) => { doc.setFont("helvetica", "bold");   doc.setFontSize(sz); doc.setTextColor(0); };
  const N = (sz: number) => { doc.setFont("helvetica", "normal"); doc.setFontSize(sz); doc.setTextColor(0); };
  // Tamanhos usados no original:
  //   ANEXO II heading   → 16
  //   Title / sec header → 10
  //   Body labels/vals   → 9
  //   Legal / small      → 7.5
  //   Weapon rows body   → 8.5 / 8
  //   APTO / INAPTO      → 12

  // Horizontal line — sempre preto
  const hl = (y: number, x1 = ML, x2 = ML + CW, w = 0.2) => { doc.setDrawColor(0); doc.setLineWidth(w); doc.line(x1, y, x2, y); };
  // Vertical line — sempre preto
  const vl = (x: number, y1: number, y2: number) => { doc.setDrawColor(0); doc.setLineWidth(0.2); doc.line(x, y1, x, y2); };
  // Underline field — sempre preto
  const ul = (x: number, y: number, w: number) => { doc.setDrawColor(0); doc.setLineWidth(0.2); doc.line(x, y, x + w, y); };

  // Checkbox quadrado — reset completo de cores antes de desenhar
  const sqBox = (x: number, y: number, marked: boolean, sz = 3.5) => {
    doc.setDrawColor(0); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.25);
    doc.rect(x, y - sz + 0.3, sz, sz, "S");
    if (marked) { B(9); doc.setTextColor(0); doc.text("X", x + sz / 2, y - 0.1, { align: "center" }); }
  };

  // Parenthesis checkbox — X em negrito quando marcado
  const pc = (ok: boolean) => ok ? "(  X  )" : "(      )";
  const renderPc = (ok: boolean, x: number, y: number): number => {
    const str = pc(ok);
    if (ok) {
      // "( " normal, "X" negrito, " )" normal
      N(9);
      const open = "(  "; const close = "  )";
      doc.text(open, x, y);
      const ow = doc.getTextWidth(open);
      B(9); doc.setTextColor(0); doc.text("X", x + ow, y);
      const xw = doc.getTextWidth("X");
      N(9); doc.text(close, x + ow + xw, y);
    } else {
      N(9); doc.text(str, x, y);
    }
    N(9);
    return doc.getTextWidth(str);
  };

  // Write bold label then normal value on same line
  const labelVal = (x: number, y: number, lbl: string, val: string, sz = 8.5) => {
    B(sz); doc.text(lbl, x, y);
    const w = doc.getTextWidth(lbl);
    N(sz); doc.text(val, x + w, y);
    return x + w + doc.getTextWidth(val);
  };

  // Draw section: outer rect + header row (sem fill, só borda inferior)
  const section = (y: number, h: number, title: string) => {
    doc.setLineWidth(0.35); doc.setDrawColor(0);
    doc.rect(ML, y, CW, h);
    // linha separando o cabeçalho do conteúdo
    doc.setLineWidth(0.2);
    doc.line(ML, y + HDR, ML + CW, y + HDR);
    B(10); doc.text(title, PW / 2, y + 4.7, { align: "center" });
  };

  let y = 10;

  // ════════════════════════════════════════════
  // ANEXO II  (fora da caixa, centrado em cima)
  // ════════════════════════════════════════════
  B(16); doc.text("ANEXO II", PW / 2, y + 4, { align: "center" });
  y += 10;

  // ════════════════════════════════════════════
  // CAIXA DO TÍTULO + TEXTO LEGAL
  // ════════════════════════════════════════════
  N(7.5);
  const legalTxt = "O comprovante de capacidade técnica de arma de fogo deverá ser expedido por instrutor de armamento e tiro credenciado pela Polícia Federal e deverá atestar, necessariamente: (a) conhecimento da conceituação e normas de segurança pertinentes à arma de fogo; (b) conhecimento básico dos componentes e partes da arma de fogo e (c) habilidade do uso da arma de fogo demonstrada, pelo interessado, em estande de tiro (artigo 4°, inciso III e artigo 12, inciso VI e § 3°, da Lei nº 10.826/03; e artigo 36 do Decreto nº 5.123/04).";
  const legalLines = doc.splitTextToSize(legalTxt, CW - 4);

  B(10);
  const titleTxt = `COMPROVANTE DE CAPACIDADE TÉCNICA PARA O MANUSEIO DE ARMA DE FOGO N°${f.numero || "______"}/2026`;
  const titleLines = doc.splitTextToSize(titleTxt, CW - 6);
  const titleH = titleLines.length * 5;
  const legalH = legalLines.length * 3.2;
  const box1H = 1.5 + titleH + 0.5 + legalH + 1;

  doc.setLineWidth(0.35); doc.rect(ML, y, CW, box1H);
  B(10); doc.text(titleLines, PW / 2, y + 3.5, { align: "center" });
  N(7.5);  doc.text(legalLines, ML + 2, y + 3.5 + titleH + 0.5);
  y += box1H + 0.8;

  // ════════════════════════════════════════════
  // DADOS DO AVALIADO
  // ════════════════════════════════════════════
  const dadosH = HDR + 14;
  section(y, dadosH, "DADOS DO AVALIADO");

  const dy = y + HDR + 1;

  // NOME
  B(9); doc.text("NOME:", ML + 2, dy + 3);
  const nomeLblW = doc.getTextWidth("NOME:");
  const nomeVal = f.nome.toUpperCase();
  const nomeX = ML + 2 + nomeLblW + 2;
  N(9); doc.text(nomeVal, nomeX, dy + 3);

  // CPF
  B(9); doc.text("CPF:", ML + 2, dy + 7);
  const cpfLblW = doc.getTextWidth("CPF:");
  const cpfX = ML + 2 + cpfLblW + 2;
  N(9); doc.text(f.cpf, cpfX, dy + 7);

  // ENDEREÇO (compõe: rua, Nº, complemento, bairro)
  B(9); doc.text("ENDEREÇO:", ML + 2, dy + 11);
  const endLblW = doc.getTextWidth("ENDEREÇO:");
  const endX = ML + 2 + endLblW + 2;
  const _endBase = [
    f.endereco,
    f.endNumero ? `Nº ${f.endNumero}` : "",
    f.endCompl  || "",
  ].filter(Boolean).join(", ");
  const endVal = (f.endBairro
    ? `${_endBase} - ${f.endBairro}`
    : _endBase
  ).toUpperCase();
  N(9); doc.text(endVal, endX, dy + 11);

  y += dadosH + 0.8;

  // ════════════════════════════════════════════
  // DADOS DA ARMA DE FOGO
  // ════════════════════════════════════════════
  if (tipo === "sinarm") {
    // SINARM: lista de 8 armas pré-definidas com checkboxes em 2 colunas
    // sRowH=8: texto centrado em 4mm → margem topo=4mm, base=4mm ✓
    const sRowH = 8;
    const sinarmArmasH = HDR + 4 * sRowH; // 4 linhas × 2 colunas = 8 armas
    const midColX = ML + CW / 2;
    section(y, sinarmArmasH, "DADOS DA ARMA DE FOGO UTILIZADA");
    vl(midColX, y + HDR, y + sinarmArmasH);

    ARMAS_SINARM.forEach((arma, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ax = col === 0 ? ML + 3 : midColX + 3;
      const ay = y + HDR + row * sRowH + 4; // centrado em 4mm (era 4.5)
      const checked = f.armasSinarm.includes(arma.id);
      N(9);
      const pcW2 = renderPc(checked, ax, ay);
      N(9); doc.text(` ${arma.label}`, ax + pcW2, ay);
    });

    y += sinarmArmasH + 0.8;
  } else {
    // CR/CAC: tabela com tipo, marca, calibre, registro SINARM/SIGMA
    // aRowH=10: linhas em +3.5 e +7 → margens topo≈3.5mm, base=3mm ✓
    const ARMAS = [
      { tipo: "PISTOLA",    serie: "ADK 818094",  marca: "TAUROS GX4",    reg: "905970870", cal: "9 MM",    sist: f.pistola },
      { tipo: "REVOLVER",   serie: "ACL 493291",  marca: "TAURUS RT 85S", reg: "906589762", cal: "38",      sist: f.revolver },
      { tipo: "RIFLE",      serie: "NWE 4872174", marca: "ROSSI",         reg: "905938944", cal: "357 MAG", sist: f.rifle },
      { tipo: "ESPINGARDA", serie: "G11534022",   marca: "BOITO",         reg: "905938936", cal: "12",      sist: f.espingarda },
    ];
    const aRowH = 10;
    const armasH = HDR + ARMAS.length * aRowH;
    section(y, armasH, "ARMAS DE FOGO UTILIZADAS");

    const c1 = ML + 65, c2 = ML + 126;
    vl(c1, y + HDR, y + armasH);
    vl(c2, y + HDR, y + armasH);

    ARMAS.forEach((a, i) => {
      const ry = y + HDR + i * aRowH;
      B(8.5); doc.text(`TIPO: ${a.tipo}`,      ML + 3, ry + 3.5);
      N(8);   doc.text(`Nº SÉRIE: ${a.serie}`, ML + 3, ry + 7);
      B(8.5); doc.text(`MARCA: ${a.marca}`,       c1 + 3, ry + 3.5);
      N(8);   doc.text(`REGISTRO Nº: ${a.reg}`,    c1 + 3, ry + 7);
      const col3Center = c2 + (ML + CW - c2) / 2;
      // Calcula rx (início do grupo SINARM/SIGMA) antes de renderizar CALIBRE
      N(8);
      const pcStr = "(      )";
      const pcW = doc.getTextWidth(pcStr);
      const sinarmLbl = " SINARM"; const sigmaLbl = " SIGMA";
      const gap2 = 2;
      const row2W = pcW + doc.getTextWidth(sinarmLbl) + gap2 + pcW + doc.getTextWidth(sigmaLbl);
      let rx = col3Center - row2W / 2;
      // CALIBRE alinha à esquerda com o "(" da linha abaixo
      B(8.5); doc.text(`CALIBRE: ${a.cal}`, rx, ry + 3.5);
      rx += renderPc(a.sist === "SINARM", rx, ry + 7);
      doc.text(sinarmLbl, rx, ry + 7); rx += doc.getTextWidth(sinarmLbl) + gap2;
      rx += renderPc(a.sist === "SIGMA", rx, ry + 7);
      doc.text(sigmaLbl, rx, ry + 7);
    });

    y += armasH + 0.8;
  }

  // ════════════════════════════════════════════
  // DECLARAÇÃO
  // ════════════════════════════════════════════
  const declH = HDR + 38;
  section(y, declH, "DECLARAÇÃO");

  const decY = y + HDR + 1;

  // Texto corrido com DECLARO e NÃO ME SUBMETI em negrito
  const nomeDecl = (f.nome || "___________________________________").toUpperCase();
  type DRun = { txt: string; b: boolean };
  const declRuns: DRun[] = [
    { txt: `Eu ${nomeDecl} acima identificado, `,  b: false },
    { txt: "DECLARO",                               b: true  },
    { txt: ", sob as penas da lei, que ",           b: false },
    { txt: "NÃO ME SUBMETI ",                       b: true  },
    { txt: `a testes para a aferição de capacidade técnica para o manuseio de armas de fogo nos últimos 30 dias. Manaus/AM, ${fmtDate(f.dataDecl)}`, b: false },
  ];
  const decMaxW = CW - 4, decStartX = ML + 2;
  let dcx = decStartX, dcy = decY + 5;
  const dcLH = 5.5;
  for (const { txt, b } of declRuns) {
    const words = txt.match(/\S+\s*/g) ?? [txt];
    for (const w of words) {
      if (b) B(9); else N(9);
      const ww = doc.getTextWidth(w);
      if (dcx > decStartX && dcx + ww > decStartX + decMaxW) {
        dcx = decStartX; dcy += dcLH;
      }
      doc.text(w, dcx, dcy);
      dcx += ww;
    }
  }

  // Linha de assinatura — canto direito, dentro da caixa
  const sigLineX = PW / 2 + 5;
  const sigLineW = ML + CW - sigLineX - 2;
  ul(sigLineX, decY + 32, sigLineW);
  N(9); doc.text("ASSINATURA DO AVALIADO", sigLineX + sigLineW / 2, decY + 36, { align: "center" });

  y += declH + 0.8;

  // ════════════════════════════════════════════
  // LOCAL DE APLICAÇÃO PROVA PRATICA
  // ════════════════════════════════════════════
  const LOCAIS = [
    { id: "juliet", nome: "Clube de Tiro Juliet Papa",           end: "R. Alm. Maximiano, 8 - Dom Pedro, Manaus/AM." },
    { id: "texas",  nome: "Clube de Tiro Texas Gun",             end: "Av. Compensa, 180B – Vila da Prata, Manaus/AM." },
    { id: "cta",    nome: "CTA INDOR Clube de Tiro do Amazonas", end: "Av. Pedro Teixeira - Chapada, Manaus/AM." },
  ];
  // lRowH=11: NOME em +3.5, ENDEREÇO em +7.5 → margem 3.5mm topo e base ✓
  const lRowH = 11;
  const localH = HDR + LOCAIS.length * lRowH;
  section(y, localH, "LOCAL DE APLICAÇÃO PROVA PRATICA (ESTANDE)");

  LOCAIS.forEach((loc, i) => {
    const ly = y + HDR + i * lRowH;
    if (i > 0) hl(ly);
    sqBox(ML + 2.5, ly + 5.5, f.local === loc.id);
    B(9); doc.text(`NOME: ${loc.nome}`, ML + 8, ly + 3.5);
    N(9); doc.text(`ENDEREÇO: ${loc.end}`, ML + 8, ly + 7.5);
  });

  y += localH + 0.8;

  // ════════════════════════════════════════════
  // FUNDAMENTAÇÃO
  // ════════════════════════════════════════════
  // Margens iguais 4mm topo e base:
  // fndY = content+1 → first_offset = 3 → topo = 1+3 = 4mm
  // SINARM: 5 linhas a 4.5mm → last = 3+18 = 21 → content=26 → base=26-22=4mm ✓
  // CR/CAC: 4 linhas a 4.5mm → last = 3+13.5=16.5 → content=22 → base=22-17.5=4.5mm ✓
  const fundH = tipo === "sinarm" ? HDR + 26 : HDR + 22;
  section(y, fundH, "FUNDAMENTAÇÃO");

  const fndY = y + HDR + 1;

  // FINALIDADE  (offset +3 → topo=4mm)
  N(9); doc.text("FINALIDADE:", ML + 2, fndY + 3);
  let fx = ML + 2 + doc.getTextWidth("FINALIDADE:") + 2;
  fx += renderPc(f.finalidade.includes("aquisicao"), fx, fndY + 3);
  doc.text(" AQUISIÇÃO, REGISTRO OU TRANSFERÊNCIA  ", fx, fndY + 3);
  fx += doc.getTextWidth(" AQUISIÇÃO, REGISTRO OU TRANSFERÊNCIA  ");
  fx += renderPc(f.finalidade.includes("porte"), fx, fndY + 3);
  doc.text(" PORTE  ", fx, fndY + 3);
  fx += doc.getTextWidth(" PORTE  ");
  if (tipo === "cr_cac") {
    fx += renderPc(f.finalidade.includes("cr"), fx, fndY + 3);
    N(9); doc.text(" CR", fx, fndY + 3);
  }

  // CATEGORIA  (offset +7.5)
  N(9); doc.text("CATEGORIA:", ML + 2, fndY + 7.5);
  fx = ML + 2 + doc.getTextWidth("CATEGORIA:") + 2;
  fx += renderPc(f.categoria.includes("defesa"), fx, fndY + 7.5);
  doc.text(" DEFESA PESSOAL  ", fx, fndY + 7.5);
  fx += doc.getTextWidth(" DEFESA PESSOAL  ");
  fx += renderPc(f.categoria.includes("institucional"), fx, fndY + 7.5);
  doc.text(" INSTITUCIONAL  ", fx, fndY + 7.5);
  fx += doc.getTextWidth(" INSTITUCIONAL  ");
  if (tipo === "cr_cac") {
    fx += renderPc(f.categoria.includes("cac"), fx, fndY + 7.5);
    N(9); doc.text(" CAC", fx, fndY + 7.5);
  }

  // NOTA — label normal, valor em negrito  (offset +12)
  N(9); doc.text("NOTA DA PROVA TEÓRICA:", ML + 2, fndY + 12);
  const notaX = ML + 2 + doc.getTextWidth("NOTA DA PROVA TEÓRICA:") + 2;
  B(9); doc.text(f.notaTeorica || "–", notaX, fndY + 12);

  // PONTUAÇÃO SILHUETA — label normal, valores em negrito  (offset +16.5)
  N(9); doc.text("PONTUAÇÃO NO ALVO SILHUETA:", ML + 2, fndY + 16.5);
  let px = ML + 2 + doc.getTextWidth("PONTUAÇÃO NO ALVO SILHUETA:") + 2;
  const armas2 = [
    { lbl: "PISTOLA: ",      val: f.notaPistola    || "–" },
    { lbl: "  REVOLVER: ",   val: f.notaRevolver   || "–" },
    { lbl: "  RIFLE: ",      val: f.notaRifle      || "–" },
    { lbl: "  ESPINGARDA: ", val: f.notaEspingarda || "–" },
  ];
  armas2.forEach(({ lbl, val }) => {
    N(9); doc.text(lbl, px, fndY + 16.5); px += doc.getTextWidth(lbl);
    B(9); doc.text(val, px, fndY + 16.5); px += doc.getTextWidth(val);
  });

  // PONTUAÇÃO ALVO MULTICOLORIDO — apenas SINARM  (offset +21)
  if (tipo === "sinarm") {
    N(9); doc.text("PONTUAÇÃO NO ALVO MULTICOLORIDO:", ML + 2, fndY + 21);
    const multiX = ML + 2 + doc.getTextWidth("PONTUAÇÃO NO ALVO MULTICOLORIDO:") + 2;
    B(9); doc.text(f.notaMulticolorido || "–", multiX, fndY + 21);
  }

  y += fundH + 0.8;

  // ════════════════════════════════════════════
  // CONCLUSÃO
  // ════════════════════════════════════════════
  const concH = HDR + 7;
  section(y, concH, "CONCLUSÃO");

  // Caixas menores, X centralizado, centralizado na largura da caixa
  const bsz = 3.2;
  // ccY calculado para centralizar o box (bsz=3.2) na área de conteúdo (concH-HDR=7mm)
  // box_top = ccY - bsz + 0.3 ; para box_top = 1.9mm → ccY = 1.9 + 3.2 - 0.3 = 4.8
  const ccY = y + HDR + 4.8;
  // Calcula largura total e centraliza dinamicamente
  N(9);
  const _aptoW  = doc.getTextWidth("APTO");
  const _inaptW = doc.getTextWidth("INAPTO");
  const _gapGrp = 14; // espaço entre grupos
  const _totalConc = bsz + 1 + _aptoW + _gapGrp + bsz + 1 + _inaptW;
  const bx1 = ML + (CW - _totalConc) / 2;
  const bx2 = bx1 + bsz + 1 + _aptoW + _gapGrp;

  // Desenha caixa e X centralizado manualmente
  const drawBox = (bx: number, marked: boolean) => {
    doc.setDrawColor(0); doc.setFillColor(255,255,255); doc.setLineWidth(0.25);
    doc.rect(bx, ccY - bsz + 0.3, bsz, bsz, "S");
    if (marked) {
      B(9); doc.setTextColor(0);
      // Centraliza X: topo_caixa + bsz/2 + ajuste_baseline
      doc.text("X", bx + bsz / 2, (ccY - bsz + 0.3) + bsz / 2 + 1.2, { align: "center" });
    }
  };

  drawBox(bx1, f.conclusao === "apto");
  N(9); doc.text("APTO",   bx1 + bsz + 1, ccY);

  drawBox(bx2, f.conclusao === "inapto");
  N(9); doc.text("INAPTO", bx2 + bsz + 1, ccY);

  y += concH + 0.8;

  // ════════════════════════════════════════════
  // AVALIADOR
  // ════════════════════════════════════════════
  const avalH = HDR + 13;
  section(y, avalH, "AVALIADOR");

  const avY = y + HDR + 1;
  // Linha 1 — fluxo natural, sem posição fixa de coluna
  let ax = ML + 2;
  N(9); doc.text("NOME: William Bruno Toyoda Hitotuzi", ax, avY + 4.5);
  ax += doc.getTextWidth("NOME: William Bruno Toyoda Hitotuzi") + 3;
  doc.text("CPF: 733.633.592-68", ax, avY + 4.5);

  // Linha 2 — fluxo natural
  ax = ML + 2;
  N(9); doc.text("PORTARIA: DREX/SR/PF/AM - N° 01/2025, 14/11/2025", ax, avY + 9.5);
  ax += doc.getTextWidth("PORTARIA: DREX/SR/PF/AM - N° 01/2025, 14/11/2025") + 3;
  doc.text("VALIDADE: 31/10/2029", ax, avY + 9.5);

  y += avalH + 6;

  // ════════════════════════════════════════════
  // DATA FINAL + ASSINATURA DO AVALIADOR
  // ════════════════════════════════════════════
  N(10);
  doc.text(`Manaus/AM. ${fmtDate(f.dataFinal)}`, ML + CW, y, { align: "right" });

  y += 20;   // espaço para assinatura digital GOV.BR
  ul(PW / 2 - 43, y, 86);
  y += 5;
  B(10); doc.text("William Bruno Toyoda Hitotuzi", PW / 2, y, { align: "center" });
  y += 5;
  B(10); doc.text("IAT", PW / 2, y, { align: "center" });

  // ─── Download ───
  const blob = doc.output("blob");
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  // ── Nome do arquivo ────────────────────────────────────────────────────────
  const _ano2 = new Date().getFullYear().toString().slice(-2);
  const _nr   = f.numero ? `${f.numero}.${_ano2}` : "";
  const _nome = (f.nome || "Laudo").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  let _armasLabel: string;
  if (tipo === "cr_cac") {
    const _ativos = [
      f.pistola    ? "Pistola"    : "",
      f.revolver   ? "Revolver"   : "",
      f.rifle      ? "Rifle"      : "",
      f.espingarda ? "Espingarda" : "",
    ].filter(Boolean);
    _armasLabel = _ativos.length === 4 ? "Completo"
                : _ativos.length === 0 ? ""
                : _ativos.join(" ");
  } else {
    // SINARM: deduz tipos das armas selecionadas
    const _idTipo: Record<string, string> = {
      g25: "Pistola", "58hc": "Pistola", gx4: "Pistola",
      ack: "Revolver", rt85: "Revolver",
      puma: "Rifle", t4: "Rifle",
      boito: "Espingarda",
    };
    const _tipos = new Set(f.armasSinarm.map(id => _idTipo[id]).filter(Boolean));
    const _tiposOrdem = ["Pistola","Revolver","Rifle","Espingarda"].filter(t => _tipos.has(t));
    _armasLabel = _tiposOrdem.length === 4 ? "Completo"
                : _tiposOrdem.length === 0 ? ""
                : _tiposOrdem.join(" ");
  }

  const _tipoLabel = tipo === "sinarm" ? "Sinarm" : "CR";
  const _parts = [_tipoLabel, _armasLabel, _nr, _nome].filter(Boolean);
  a.download = `Laudo ${_parts.join(" ")}.pdf`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── UI helpers ──────────────────────────────────────────────────────────────────
// Seleção única (radio) — círculo
function RadioBtn({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border transition-colors
        ${checked ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
    >
      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0
        ${checked ? "border-primary-foreground" : "border-current"}`}>
        {checked && <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
      </span>
      {label}
    </button>
  );
}

// Seleção múltipla (checkbox) — quadrado com ✓
function CheckBtn({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border transition-colors
        ${checked ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
    >
      <span className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center flex-shrink-0
        ${checked ? "border-primary-foreground" : "border-current"}`}>
        {checked && <span className="text-[9px] leading-none font-black">✓</span>}
      </span>
      {label}
    </button>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────
const Laudos = () => {
  const [form, setForm] = useState<LaudoForm>(EMPTY);
  const [laudoTipo, setLaudoTipo] = useState<"cr_cac" | "sinarm">("cr_cac");
  const [pistOpen, setPistOpen] = useState(false);
  const [revolOpen, setRevolOpen] = useState(false);
  const [coloridoOpen, setColoridoOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const set = <K extends keyof LaudoForm>(k: K, v: LaudoForm[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // Carrega o último número usado (compartilhado entre todos os usuários)
  useEffect(() => {
    supabase.rpc("get_laudo_ultimo_numero").then(({ data, error }) => {
      if (error) { console.error("[laudo] get_ultimo_numero:", error); return; }
      if (data) set("numero", String(data));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seleciona registro SINARM/SIGMA — sem auto-preencher notas
  const setArma = (key: "pistola" | "revolver" | "rifle" | "espingarda", val: SistReg) => {
    setForm(p => ({ ...p, [key]: val }));
  };

  const armaRows: Array<{ label: string; key: "pistola" | "revolver" | "rifle" | "espingarda" }> = [
    { label: "Pistola",    key: "pistola" },
    { label: "Revólver",   key: "revolver" },
    { label: "Rifle",      key: "rifle" },
    { label: "Espingarda", key: "espingarda" },
  ];

  // Silhueta: 60-100 (41 opções, grid 7×6)
  const PONT_SILHUETA = Array.from({ length: 41 }, (_, i) => String(60 + i));
  // Multicolorido: 72-120 (49 opções, grid 7×7)
  const PONT_COLORIDO = Array.from({ length: 49 }, (_, i) => String(72 + i));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
          <ClipboardList className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <h1 className="text-base sm:text-lg font-bold tracking-tight">Laudos</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Comprovante de Capacidade Técnica — Arma de Fogo
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 max-w-2xl mx-auto space-y-4">

        {/* Dados do Avaliado */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-primary">
                Dados do Avaliado
              </CardTitle>
              {/* Tipo de Laudo — radio pill + Limpar */}
              <div className="flex items-center gap-2 text-xs font-medium">
                <button type="button"
                  onClick={() => { setForm(EMPTY); toast.info("Formulário limpo."); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border text-muted-foreground hover:border-destructive/60 hover:text-destructive transition-all">
                  <RotateCcw className="h-3 w-3" />
                  Limpar
                </button>
                {(["cr_cac", "sinarm"] as const).map(opt => {
                  const label = opt === "cr_cac" ? "CR / CAC" : "SINARM Posse/Porte";
                  const active = laudoTipo === opt;
                  return (
                    <button key={opt} type="button"
                      onClick={() => setLaudoTipo(opt)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}>
                      <span className={cn(
                        "h-2.5 w-2.5 rounded-full border-2 flex-shrink-0 transition-all",
                        active ? "border-primary bg-primary" : "border-muted-foreground bg-transparent"
                      )} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Nome Completo</Label>
                <Input className="h-9 text-sm uppercase" value={form.nome}
                  onChange={e => set("nome", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">N° Comprovante</Label>
                <Input className="h-9 text-sm"
                  value={form.numero} onChange={e => set("numero", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <Input className="h-9 text-sm font-mono" placeholder="000.000.000-00"
                  value={form.cpf} onChange={e => set("cpf", maskCpf(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">Endereço</Label>
                <Input className="h-9 text-sm uppercase" value={form.endereco}
                  onChange={e => set("endereco", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº</Label>
                <Input className="h-9 text-sm" value={form.endNumero}
                  onChange={e => set("endNumero", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Complemento</Label>
                <Input className="h-9 text-sm uppercase" value={form.endCompl}
                  onChange={e => set("endCompl", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input className="h-9 text-sm uppercase" value={form.endBairro}
                  onChange={e => set("endBairro", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Armas — conteúdo muda por tipo de laudo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-primary">
              {laudoTipo === "sinarm" ? "Dados da Arma de Fogo Utilizada" : "Armas de Fogo — SINARM / SIGMA"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {laudoTipo === "sinarm" ? (
              /* SINARM: lista de armas pré-definidas com toggle */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {ARMAS_SINARM.map(arma => {
                  const checked = form.armasSinarm.includes(arma.id);
                  return (
                    <CheckBtn key={arma.id}
                      checked={checked}
                      onClick={() => set("armasSinarm", toggle(form.armasSinarm, arma.id))}
                      label={arma.label} />
                  );
                })}
              </div>
            ) : (
              /* CR/CAC: SINARM / SIGMA radio por tipo de arma */
              <div className="divide-y divide-border">
                {armaRows.map(({ label, key }) => (
                  <div key={key} className="flex items-center gap-3 py-2.5">
                    <span className="text-sm font-medium w-24 flex-shrink-0">{label}</span>
                    <div className="flex gap-2">
                      <RadioBtn checked={form[key] === "SINARM"}
                        onClick={() => setArma(key, form[key] === "SINARM" ? "" : "SINARM")} label="SINARM" />
                      <RadioBtn checked={form[key] === "SIGMA"}
                        onClick={() => setArma(key, form[key] === "SIGMA" ? "" : "SIGMA")}  label="SIGMA"  />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Declaração */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-primary">
              Data da Declaração (Avaliado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline"
                  className={cn("h-9 w-52 justify-start text-left font-normal text-sm gap-2",
                    !form.dataDecl && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                  {form.dataDecl
                    ? format(new Date(form.dataDecl + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                    : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.dataDecl ? new Date(form.dataDecl + "T12:00:00") : undefined}
                  onSelect={date => {
                    if (date) {
                      const iso = date.toLocaleDateString("sv-SE"); // YYYY-MM-DD
                      setForm(p => ({ ...p, dataDecl: iso, dataFinal: iso }));
                      setDateOpen(false); // fecha ao selecionar
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        {/* Local */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-primary">
              Local da Prova Prática (Estande)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {([
              ["juliet", "Clube de Tiro Juliet Papa"],
              ["texas",  "Clube de Tiro Texas Gun"],
              ["cta",    "CTA INDOR Clube de Tiro do Amazonas"],
            ] as const).map(([id, nome]) => (
              <RadioBtn key={id} checked={form.local === id}
                onClick={() => set("local", form.local === id ? "" : id)} label={nome} />
            ))}
          </CardContent>
        </Card>

        {/* Fundamentação */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-primary">
              Fundamentação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Finalidade</p>
              <div className="flex flex-wrap gap-2">
                <CheckBtn checked={form.finalidade.includes("aquisicao")}
                  onClick={() => set("finalidade", toggle(form.finalidade, "aquisicao"))}
                  label="Aquisição / Registro / Transferência" />
                <CheckBtn checked={form.finalidade.includes("porte")}
                  onClick={() => set("finalidade", toggle(form.finalidade, "porte"))}
                  label="Porte" />
                {laudoTipo === "cr_cac" && (
                  <CheckBtn checked={form.finalidade.includes("cr")}
                    onClick={() => set("finalidade", toggle(form.finalidade, "cr"))}
                    label="CR" />
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Categoria</p>
              <div className="flex flex-wrap gap-2">
                <CheckBtn checked={form.categoria.includes("defesa")}
                  onClick={() => set("categoria", toggle(form.categoria, "defesa"))}
                  label="Defesa Pessoal" />
                <CheckBtn checked={form.categoria.includes("institucional")}
                  onClick={() => set("categoria", toggle(form.categoria, "institucional"))}
                  label="Institucional" />
                {laudoTipo === "cr_cac" && (
                  <CheckBtn checked={form.categoria.includes("cac")}
                    onClick={() => set("categoria", toggle(form.categoria, "cac"))}
                    label="CAC" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-primary">
              Notas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Nota Teórica — sempre 20 */}
            <div className="space-y-1">
              <Label className="text-xs">Nota da Prova Teórica</Label>
              <div className="h-9 px-3 flex items-center rounded-md border bg-muted text-sm font-semibold w-28">
                20
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">
                Pontuação no Alvo Silhueta
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Pistola — Popover grade 72-120 */}
                <div className="space-y-1">
                  <Label className="text-xs">Pistola</Label>
                  <Popover open={pistOpen} onOpenChange={setPistOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("h-9 w-full justify-start text-sm font-normal",
                        !form.notaPistola && "text-muted-foreground")}>
                        {form.notaPistola || "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-2 w-64">
                      {/* Grade 7×6 = 42 slots para 41 opções (60-100), sem rolagem */}
                      <div className="grid grid-cols-7 gap-0.5">
                        {PONT_SILHUETA.map(n => (
                          <button key={n} type="button"
                            onClick={() => { set("notaPistola", form.notaPistola === n ? "" : n); setPistOpen(false); }}
                            className={cn("h-8 w-full rounded text-xs hover:bg-muted transition-colors",
                              form.notaPistola === n && "bg-primary text-primary-foreground")}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Revólver — Popover grade 72-120 sem rolagem */}
                <div className="space-y-1">
                  <Label className="text-xs">Revólver</Label>
                  <Popover open={revolOpen} onOpenChange={setRevolOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("h-9 w-full justify-start text-sm font-normal",
                        !form.notaRevolver && "text-muted-foreground")}>
                        {form.notaRevolver || "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-2 w-64">
                      <div className="grid grid-cols-7 gap-0.5">
                        {PONT_SILHUETA.map(n => (
                          <button key={n} type="button"
                            onClick={() => { set("notaRevolver", form.notaRevolver === n ? "" : n); setRevolOpen(false); }}
                            className={cn("h-8 w-full rounded text-xs hover:bg-muted transition-colors",
                              form.notaRevolver === n && "bg-primary text-primary-foreground")}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Rifle — toggle manual: marcado = 50 */}
                <div className="space-y-1">
                  <Label className="text-xs">Rifle</Label>
                  <button type="button"
                    onClick={() => set("notaRifle", form.notaRifle ? "" : "50")}
                    className={cn("h-9 px-3 w-full flex items-center justify-between rounded-md border text-sm transition-colors",
                      form.notaRifle
                        ? "bg-primary text-primary-foreground border-primary font-semibold"
                        : "border-border text-muted-foreground hover:border-primary/50")}>
                    <span>{form.notaRifle ? `50 ✓` : "- (clique p/ marcar)"}</span>
                  </button>
                </div>
                {/* Espingarda — toggle manual: marcada = APTO */}
                <div className="space-y-1">
                  <Label className="text-xs">Espingarda</Label>
                  <button type="button"
                    onClick={() => set("notaEspingarda", form.notaEspingarda ? "" : "APTO")}
                    className={cn("h-9 px-3 w-full flex items-center justify-between rounded-md border text-sm transition-colors",
                      form.notaEspingarda
                        ? "bg-primary text-primary-foreground border-primary font-semibold"
                        : "border-border text-muted-foreground hover:border-primary/50")}>
                    <span>{form.notaEspingarda ? `APTO ✓` : "- (clique p/ marcar)"}</span>
                  </button>
                </div>
              </div>
            </div>
            {/* Alvo Multicolorido — apenas SINARM Posse/Porte */}
            {laudoTipo === "sinarm" && (
              <div>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">
                  Pontuação no Alvo Multicolorido
                </p>
                <div className="w-full sm:w-48">
                  <Popover open={coloridoOpen} onOpenChange={setColoridoOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("h-9 w-full justify-start text-sm font-normal",
                        !form.notaMulticolorido && "text-muted-foreground")}>
                        {form.notaMulticolorido || "Selecionar (72-120)"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-2 w-64">
                      {/* Grade 7×7 = 49 opções (72-120), estilo calendário */}
                      <div className="grid grid-cols-7 gap-0.5">
                        {PONT_COLORIDO.map(n => (
                          <button key={n} type="button"
                            onClick={() => { set("notaMulticolorido", form.notaMulticolorido === n ? "" : n); setColoridoOpen(false); }}
                            className={cn("h-8 w-full rounded text-xs hover:bg-muted transition-colors",
                              form.notaMulticolorido === n && "bg-primary text-primary-foreground")}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conclusão */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-primary">
              Conclusão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <RadioBtn checked={form.conclusao === "apto"}
                onClick={() => set("conclusao", form.conclusao === "apto" ? "" : "apto")}
                label="APTO" />
              <RadioBtn checked={form.conclusao === "inapto"}
                onClick={() => set("conclusao", form.conclusao === "inapto" ? "" : "inapto")}
                label="INAPTO" />
            </div>
          </CardContent>
        </Card>

        {/* Botão */}
        <Button size="lg" className="w-full gap-2 h-12"
          onClick={async () => {
            if (!form.nome || !form.cpf) { toast.error("Preencha Nome e CPF do avaliado."); return; }
            if (!form.conclusao) { toast.error("Selecione APTO ou INAPTO."); return; }
            try {
              await gerarLaudoPDF(form, laudoTipo);
              // Salva o último número usado para todos os usuários
              if (form.numero) {
                supabase.rpc("set_laudo_ultimo_numero", { p_numero: form.numero })
                  .then(({ error }) => { if (error) console.error("[laudo] set_ultimo_numero:", error); });
              }
              toast.success("Laudo gerado com sucesso!");
            } catch (e) {
              console.error(e);
              toast.error("Erro ao gerar PDF.");
            }
          }}
        >
          <Download className="h-4 w-4" />
          Gerar Laudo PDF
        </Button>

        <div className="h-6" />
      </main>
    </div>
  );
};

export default Laudos;
