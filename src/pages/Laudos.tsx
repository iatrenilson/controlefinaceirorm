import { useState, useEffect, useRef } from "react";
import { ClipboardList, Download, CalendarIcon, RotateCcw, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn, norm } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface CacCadastro {
  id: string;
  nome: string;
  cpf: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  tipo_sinarm: string | null;
  armas: string | null;
}

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
  endCidade: string;
  endEstado: string;
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
  numero: "", nome: "", cpf: "", endereco: "", endNumero: "", endCompl: "", endBairro: "", endCidade: "", endEstado: "",
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

// Sanitiza strings para jsPDF (fontes WinAnsi nao suportam Unicode acima de U+00FF)
function sp(s: string): string {
  return (s || “”)
    .replace(/[—–]/g, “-”)   // em dash, en dash
    .replace(/[“”]/g, '”')   // aspas tipograficas
    .replace(/[‘’]/g, “'”)   // apostrofos tipograficos
    .replace(/…/g, “...”)          // reticencias
    .replace(/[^\x00-\xFF]/g, “?”);    // qualquer outro nao-Latin1
}

async function gerarLaudoPDF(f: LaudoForm, tipo: “cr_cac” | “sinarm”, sinarmPorte = false) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  const PW = 210;
  const ML = 10, CW = 190; // content width
  const HDR = 6.5; // section header height

  // Font helpers â€” mesma família (helvetica = Arial) e tamanhos do documento original
  const B = (sz: number) => { doc.setFont("helvetica", "bold");   doc.setFontSize(sz); doc.setTextColor(0); };
  const N = (sz: number) => { doc.setFont("helvetica", "normal"); doc.setFontSize(sz); doc.setTextColor(0); };
  // Tamanhos usados no original:
  //   ANEXO II heading   â†’ 16
  //   Title / sec header â†’ 10
  //   Body labels/vals   â†’ 9
  //   Legal / small      â†’ 7.5
  //   Weapon rows body   â†’ 8.5 / 8
  //   APTO / INAPTO      â†’ 12

  // Horizontal line â€” sempre preto
  const hl = (y: number, x1 = ML, x2 = ML + CW, w = 0.2) => { doc.setDrawColor(0); doc.setLineWidth(w); doc.line(x1, y, x2, y); };
  // Vertical line â€” sempre preto
  const vl = (x: number, y1: number, y2: number) => { doc.setDrawColor(0); doc.setLineWidth(0.2); doc.line(x, y1, x, y2); };
  // Underline field â€” sempre preto
  const ul = (x: number, y: number, w: number) => { doc.setDrawColor(0); doc.setLineWidth(0.2); doc.line(x, y, x + w, y); };

  // Checkbox quadrado â€” reset completo de cores antes de desenhar
  const sqBox = (x: number, y: number, marked: boolean, sz = 3.5) => {
    doc.setDrawColor(0); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.25);
    doc.rect(x, y - sz + 0.3, sz, sz, "S");
    if (marked) { B(9); doc.setTextColor(0); doc.text("X", x + sz / 2, y - 0.1, { align: "center" }); }
  };

  // Parenthesis checkbox â€” X em negrito quando marcado
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

  let y = 5;

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ANEXO II  (fora da caixa, centrado em cima)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  B(16); doc.text("ANEXO II", PW / 2, y + 4, { align: "center" });
  y += 8;

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CAIXA DO TÍTULO + TEXTO LEGAL
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DADOS DO AVALIADO
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const dadosH = HDR + 14;
  section(y, dadosH, "DADOS DO AVALIADO");

  const dy = y + HDR + 1;

  // NOME
  B(9); doc.text("NOME:", ML + 2, dy + 3);
  const nomeLblW = doc.getTextWidth("NOME:");
  const nomeVal = sp(f.nome.toUpperCase());
  const nomeX = ML + 2 + nomeLblW + 2;
  N(9); doc.text(nomeVal, nomeX, dy + 3);

  // CPF
  B(9); doc.text("CPF:", ML + 2, dy + 7);
  const cpfLblW = doc.getTextWidth("CPF:");
  const cpfX = ML + 2 + cpfLblW + 2;
  N(9); doc.text(sp(f.cpf), cpfX, dy + 7);

  // ENDEREÇO (compõe: rua, Nº, complemento, bairro)
  B(9); doc.text("ENDEREÇO:", ML + 2, dy + 11);
  const endLblW = doc.getTextWidth("ENDEREÇO:");
  const endX = ML + 2 + endLblW + 2;
  const _endBase = [
    f.endereco,
    f.endNumero ? `Nº ${f.endNumero}` : "",
    f.endCompl  || "",
  ].filter(Boolean).join(", ");
  const _endWithBairro = f.endBairro ? `${_endBase} - ${f.endBairro}` : _endBase;
  const _endCidUF = [f.endCidade, f.endEstado].filter(Boolean).join("/");
  const endVal = sp((_endCidUF ? `${_endWithBairro} - ${_endCidUF}` : _endWithBairro).toUpperCase());
  N(9); doc.text(endVal, endX, dy + 11);

  y += dadosH + 0.8;

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DADOS DA ARMA DE FOGO
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (tipo === "sinarm") {
    // SINARM: lista de 8 armas pré-definidas com checkboxes em 2 colunas
    // sRowH=9: baseline em +5.5 â†’ topo visual=3.2mm, base visual=3.5mm âœ“
    const sRowH = 9;
    const sinarmArmasH = HDR + 4 * sRowH; // 4 linhas Ã— 2 colunas = 8 armas
    const midColX = ML + CW / 2;
    section(y, sinarmArmasH, "DADOS DA ARMA DE FOGO UTILIZADA");
    vl(midColX, y + HDR, y + sinarmArmasH);

    ARMAS_SINARM.forEach((arma, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ax = col === 0 ? ML + 3 : midColX + 3;
      const ay = y + HDR + row * sRowH + 5.5; // baseline 5.5mm â†’ topo visual ~3.2mm
      const checked = f.armasSinarm.includes(arma.id);
      N(9);
      const pcW2 = renderPc(checked, ax, ay);
      N(9); doc.text(` ${arma.label}`, ax + pcW2, ay);
    });

    y += sinarmArmasH + 0.8;
  } else {
    // CR/CAC: tabela com tipo, marca, calibre, registro SINARM/SIGMA
    // aRowH=10: linhas em +3.5 e +7 â†’ margens topoâ‰ˆ3.5mm, base=3mm âœ“
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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DECLARAÇÃO
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

  // Linha de assinatura â€” canto direito, dentro da caixa
  const sigLineX = PW / 2 + 5;
  const sigLineW = ML + CW - sigLineX - 2;
  ul(sigLineX, decY + 32, sigLineW);
  N(9); doc.text("ASSINATURA DO AVALIADO", sigLineX + sigLineW / 2, decY + 36, { align: "center" });

  y += declH + 0.8;

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // LOCAL DE APLICAÇÃO PROVA PRATICA
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const LOCAIS = [
    { id: "juliet", nome: "Clube de Tiro Juliet Papa", end: "R. Alm. Maximiano, 8 - Dom Pedro, Manaus/AM." },
    { id: "cta",    nome: "CTA Iranduba",              end: "Rodovia AM-070 (Manoel Urbano), km 04 - Iranduba/AM." },
  ];
  // lRowH=12: baseline topo=5mm (visual=2.7mm), base=12-9=3mm â†’ visual igual âœ“
  const lRowH = 12;
  const localH = HDR + LOCAIS.length * lRowH;
  section(y, localH, "LOCAL DE APLICAÇÃO PROVA PRATICA (ESTANDE)");

  LOCAIS.forEach((loc, i) => {
    const ly = y + HDR + i * lRowH;
    if (i > 0) hl(ly);
    sqBox(ML + 2.5, ly + 6, f.local === loc.id);
    B(9); doc.text(`NOME: ${loc.nome}`, ML + 8, ly + 5);
    N(9); doc.text(`ENDEREÇO: ${loc.end}`, ML + 8, ly + 9);
  });

  y += localH + 0.8;

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // FUNDAMENTAÇÃO
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // Margem visual igual ~3mm topo e base.
  // doc.text() posiciona no baseline; letras sobem ~2.3mm (ascender Helvetica 9pt).
  // â†’ topo visual = baseline_from_divider - 2.3mm; base visual = content_h - last_baseline_from_divider
  // fndY = divider + 1; offset = 4.5 â†’ baseline a 5.5mm da divisória â†’ topo visual = 3.2mm âœ“
  // CR/CAC: 4 linhas a 4.5mm â†’ last_offset=18 â†’ content=22 â†’ base visual=22-19=3mm âœ“
  // SINARM: 5 linhas â†’ last_offset=22.5 â†’ content=27 â†’ base visual=27-23.5=3.5mm âœ“
  const fundH = tipo === "sinarm" ? HDR + 27 : HDR + 22;
  section(y, fundH, "FUNDAMENTAÇÃO");

  const fndY = y + HDR + 1;

  // FINALIDADE  (offset +4.5 â†’ baseline 5.5mm da divisória â†’ topo visual ~3.2mm)
  N(9); doc.text("FINALIDADE:", ML + 2, fndY + 4.5);
  let fx = ML + 2 + doc.getTextWidth("FINALIDADE:") + 2;
  fx += renderPc(f.finalidade.includes("aquisicao"), fx, fndY + 4.5);
  doc.text(" AQUISICAO, REGISTRO OU TRANSFERENCIA  ", fx, fndY + 4.5);
  fx += doc.getTextWidth(" AQUISICAO, REGISTRO OU TRANSFERENCIA  ");
  fx += renderPc(f.finalidade.includes("porte"), fx, fndY + 4.5);
  doc.text(" PORTE  ", fx, fndY + 4.5);
  fx += doc.getTextWidth(" PORTE  ");
  if (tipo === "cr_cac") {
    fx += renderPc(f.finalidade.includes("cr"), fx, fndY + 4.5);
    N(9); doc.text(" CR", fx, fndY + 4.5);
  }

  // CATEGORIA  (offset +9)
  N(9); doc.text("CATEGORIA:", ML + 2, fndY + 9);
  fx = ML + 2 + doc.getTextWidth("CATEGORIA:") + 2;
  fx += renderPc(f.categoria.includes("defesa"), fx, fndY + 9);
  doc.text(" DEFESA PESSOAL  ", fx, fndY + 9);
  fx += doc.getTextWidth(" DEFESA PESSOAL  ");
  fx += renderPc(f.categoria.includes("institucional"), fx, fndY + 9);
  doc.text(" INSTITUCIONAL  ", fx, fndY + 9);
  fx += doc.getTextWidth(" INSTITUCIONAL  ");
  if (tipo === "cr_cac") {
    fx += renderPc(f.categoria.includes("cac"), fx, fndY + 9);
    N(9); doc.text(" CAC", fx, fndY + 9);
  }

  // NOTA â€” label normal, valor em negrito  (offset +13.5)
  N(9); doc.text(“NOTA DA PROVA TEORICA:”, ML + 2, fndY + 13.5);
  const notaX = ML + 2 + doc.getTextWidth(“NOTA DA PROVA TEORICA:”) + 2;
  B(9); doc.text(sp(f.notaTeorica) || “-”, notaX, fndY + 13.5);

  // PONTUAÇÃO SILHUETA â€” label normal, valores em negrito  (offset +18)
  N(9); doc.text("PONTUAÇÃO NO ALVO SILHUETA:", ML + 2, fndY + 18);
  let px = ML + 2 + doc.getTextWidth("PONTUAÇÃO NO ALVO SILHUETA:") + 2;
  const armas2 = [
    { lbl: “PISTOLA: “,      val: sp(f.notaPistola)    || “-” },
    { lbl: “  REVOLVER: “,   val: sp(f.notaRevolver)   || “-” },
    { lbl: “  RIFLE: “,      val: sp(f.notaRifle)      || “-” },
    { lbl: “  ESPINGARDA: “, val: sp(f.notaEspingarda) || “-” },
  ];
  armas2.forEach(({ lbl, val }) => {
    N(9); doc.text(lbl, px, fndY + 18); px += doc.getTextWidth(lbl);
    B(9); doc.text(val, px, fndY + 18); px += doc.getTextWidth(val);
  });

  // PONTUAÇÃO ALVO MULTICOLORIDO â€” apenas SINARM  (offset +22.5)
  if (tipo === "sinarm") {
    N(9); doc.text("PONTUAÇÃO NO ALVO MULTICOLORIDO:", ML + 2, fndY + 22.5);
    const multiX = ML + 2 + doc.getTextWidth("PONTUAÇÃO NO ALVO MULTICOLORIDO:") + 2;
    B(9); doc.text(sp(f.notaMulticolorido) || “-”, multiX, fndY + 22.5);
  }

  y += fundH + 0.8;

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CONCLUSÃO
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const concH = HDR + 7;
  section(y, concH, "CONCLUSÃO");

  // Caixas menores, X centralizado, centralizado na largura da caixa
  const bsz = 3.2;
  // ccY calculado para centralizar o box (bsz=3.2) na área de conteúdo (concH-HDR=7mm)
  // box_top = ccY - bsz + 0.3 ; para box_top = 1.9mm â†’ ccY = 1.9 + 3.2 - 0.3 = 4.8
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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // AVALIADOR
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const avalH = HDR + 13;
  section(y, avalH, "AVALIADOR");

  const avY = y + HDR + 1;
  // Linha 1 â€” fluxo natural, sem posição fixa de coluna
  let ax = ML + 2;
  N(9); doc.text("NOME: William Bruno Toyoda Hitotuzi", ax, avY + 4.5);
  ax += doc.getTextWidth("NOME: William Bruno Toyoda Hitotuzi") + 3;
  doc.text("CPF: 733.633.592-68", ax, avY + 4.5);

  // Linha 2 â€” fluxo natural
  ax = ML + 2;
  N(9); doc.text("PORTARIA: DREX/SR/PF/AM - N° 01/2025, 14/11/2025", ax, avY + 9.5);
  ax += doc.getTextWidth("PORTARIA: DREX/SR/PF/AM - N° 01/2025, 14/11/2025") + 3;
  doc.text("VALIDADE: 31/10/2029", ax, avY + 9.5);

  y += avalH + 6;

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DATA FINAL + ASSINATURA DO AVALIADOR (data só no CR/CAC)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  N(10);
  if (tipo === "cr_cac") {
    doc.text(`Manaus/AM. ${fmtDate(f.dataFinal)}`, ML + CW, y, { align: "right" });
  }

  y += 20;   // espaço para assinatura digital GOV.BR
  ul(PW / 2 - 43, y, 86);
  y += 5;
  B(10); doc.text("William Bruno Toyoda Hitotuzi", PW / 2, y, { align: "center" });
  y += 5;
  B(10); doc.text("IAT", PW / 2, y, { align: "center" });

  // â”€â”€â”€ Download â”€â”€â”€
  const blob = doc.output("blob");

  // â”€â”€ Nome do arquivo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const _ano2 = new Date().getFullYear().toString().slice(-2);
  const _nr   = f.numero ? `${f.numero}.${_ano2}` : "";
  const _nome = (f.nome || "Laudo").toLowerCase().split(/\s+/).map(w => w.replace(/^./u, c => c.toUpperCase())).join(" ");

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

  const _tipoLabel = tipo === "sinarm" ? (sinarmPorte ? "Sinarm Porte" : "Sinarm") : "CR";
  const _parts = [_tipoLabel, _armasLabel, _nr, _nome].filter(Boolean);
  const fileName = `Laudo ${_parts.join(" ")}.pdf`;

  // Abre diálogo "Salvar como" nativo no desktop (Chrome/Edge)
  // No celular e outros browsers cai no download direto automático
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (o: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // usuário cancelou
    }
  }

  // Fallback mobile: abre em nova aba (iOS: botão compartilharâ†’Arquivos; Android: menu download do browser)
  const url = URL.createObjectURL(blob);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } else {
    const a = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }
}

// â”€â”€â”€ UI helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Seleção única (radio) â€” círculo
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

// Seleção múltipla (checkbox) â€” quadrado com âœ“
function CheckBtn({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border transition-colors
        ${checked ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
    >
      <span className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center flex-shrink-0
        ${checked ? "border-primary-foreground" : "border-current"}`}>
        {checked && <span className="text-[9px] leading-none font-black">âœ“</span>}
      </span>
      {label}
    </button>
  );
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Laudos = () => {
  const [form, setForm] = useState<LaudoForm>(EMPTY);
  const [laudoTipo, setLaudoTipo] = useState<"cr_cac" | "sinarm">("cr_cac");
  const [sinarmPorte, setSinarmPorte] = useState(false);
  const [pistOpen, setPistOpen] = useState(false);
  const [revolOpen, setRevolOpen] = useState(false);
  const [coloridoOpen, setColoridoOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [cadastros, setCadastros] = useState<CacCadastro[]>([]);
  const [cadSearch, setCadSearch] = useState("");
  const [cadOpen, setCadOpen] = useState(false);
  const cadRef = useRef<HTMLDivElement>(null);
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

  // Garante tabela, carrega e mantém cadastros atualizados em tempo real
  useEffect(() => {
    const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS public.cac_cadastros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT, endereco TEXT, numero TEXT, complemento TEXT, bairro TEXT,
  tipo_sinarm TEXT, armas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.cac_cadastros ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cac_cadastros' AND policyname='cac_cad_insert') THEN
    CREATE POLICY "cac_cad_insert" ON public.cac_cadastros FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cac_cadastros' AND policyname='cac_cad_select') THEN
    CREATE POLICY "cac_cad_select" ON public.cac_cadastros FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
  END IF;
END $$;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS tipo_sinarm TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS armas TEXT;
`.trim();

    const carregar = () =>
      supabase.from("cac_cadastros").select("id,nome,cpf,endereco,numero,complemento,bairro,cidade,estado,tipo_sinarm,armas").order("nome")
        .then(({ data }) => { if (data) setCadastros(data as CacCadastro[]); });

    supabase.functions.invoke("run-migration", { body: { sql: MIGRATION_SQL } }).finally(carregar);

    // Atualiza automaticamente quando chega novo cadastro
    const channel = supabase.channel("cac_cadastros_laudos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cac_cadastros" }, carregar)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!cadOpen) return;
    const handler = (e: MouseEvent) => {
      if (cadRef.current && !cadRef.current.contains(e.target as Node)) setCadOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [cadOpen]);

  const selecionarCadastro = (c: CacCadastro) => {
    const tipoRaw = (c.tipo_sinarm || "").toUpperCase();

    // Mapeamento de tipo_sinarm â†’ laudoTipo, finalidade, categoria, sinarmPorte
    let novoLaudoTipo: "cr_cac" | "sinarm" = laudoTipo;
    let novaFinalidade: Finalidade[] = [];
    let novaCategoria: Categoria[] = [];
    let novoSinarmPorte = sinarmPorte;

    if (tipoRaw.includes("SINARM CAC")) {
      novoLaudoTipo    = "cr_cac";
      novaFinalidade   = ["aquisicao", "cr"];
      novaCategoria    = ["cac"];
      novoSinarmPorte  = false;
    } else if (tipoRaw.includes("SINARM PORTE")) {
      novoLaudoTipo    = "sinarm";
      novaFinalidade   = ["aquisicao", "porte"];
      novaCategoria    = ["defesa"];
      novoSinarmPorte  = true;
    } else if (tipoRaw.includes("SINARM POSSE")) {
      novoLaudoTipo    = "sinarm";
      novaFinalidade   = ["aquisicao"];
      novaCategoria    = ["defesa"];
      novoSinarmPorte  = false;
    }

    // Mapeia armas do cadastro â†’ campos do laudo
    const armasStr = (c.armas || "").toLowerCase();
    const temPistola    = armasStr.includes("pistola");
    const temRevolver   = armasStr.includes("rev");
    const temRifle      = armasStr.includes("rifle");
    const temEspingarda = armasStr.includes("espingarda");

    // CR/CAC: seta SINARM nas armas selecionadas
    const armasCrCac: Partial<LaudoForm> = novoLaudoTipo === "cr_cac" ? {
      pistola:    temPistola    ? "SINARM" : "",
      revolver:   temRevolver   ? "SINARM" : "",
      rifle:      temRifle      ? "SINARM" : "",
      espingarda: temEspingarda ? "SINARM" : "",
    } : {};

    // SINARM POSSE/PORTE: seleciona armas pré-definidas por tipo
    // (gx4 = pistola, rt85 = revólver, puma = rifle, boito = espingarda)
    const armasSinarmIds: ArmaSinarmId[] = novoLaudoTipo === "sinarm" ? ([
      temPistola    ? "gx4"   : null,
      temRevolver   ? "rt85"  : null,
      temRifle      ? "puma"  : null,
      temEspingarda ? "boito" : null,
    ].filter(Boolean) as ArmaSinarmId[]) : [];

    setForm(p => ({
      ...p,
      nome: c.nome.toUpperCase(),
      cpf: c.cpf ? maskCpf(c.cpf) : p.cpf,
      endereco: c.endereco ? c.endereco.toUpperCase() : p.endereco,
      endNumero: c.numero || p.endNumero,
      endCompl: c.complemento ? c.complemento.toUpperCase() : p.endCompl,
      endBairro: c.bairro ? c.bairro.toUpperCase() : p.endBairro,
      endCidade: c.cidade ? c.cidade.toUpperCase() : p.endCidade,
      endEstado: c.estado ? c.estado.toUpperCase() : p.endEstado,
      ...(novaFinalidade.length ? { finalidade: novaFinalidade } : {}),
      ...(novaCategoria.length  ? { categoria:  novaCategoria  } : {}),
      ...armasCrCac,
      ...(armasSinarmIds.length ? { armasSinarm: armasSinarmIds } : {}),
    }));

    if (novoLaudoTipo !== laudoTipo)     setLaudoTipo(novoLaudoTipo);
    if (novoSinarmPorte !== sinarmPorte) setSinarmPorte(novoSinarmPorte);

    setCadSearch("");
    setCadOpen(false);
    toast.success(`Dados de ${c.nome} preenchidos.`);
  };

  const cadFiltrados = cadSearch.trim()
    ? cadastros.filter(c => norm(c.nome).includes(norm(cadSearch)) || (c.cpf || "").includes(cadSearch))
    : cadastros;

  // Seleciona registro SINARM/SIGMA â€” sem auto-preencher notas
  const setArma = (key: "pistola" | "revolver" | "rifle" | "espingarda", val: SistReg) => {
    setForm(p => ({ ...p, [key]: val }));
  };

  const armaRows: Array<{ label: string; key: "pistola" | "revolver" | "rifle" | "espingarda" }> = [
    { label: "Pistola",    key: "pistola" },
    { label: "Revólver",   key: "revolver" },
    { label: "Rifle",      key: "rifle" },
    { label: "Espingarda", key: "espingarda" },
  ];

  // Silhueta: 60-100 (41 opções, grid 7Ã—6)
  const PONT_SILHUETA = Array.from({ length: 41 }, (_, i) => String(60 + i));
  // Multicolorido: 72-120 (49 opções, grid 7Ã—7)
  const PONT_COLORIDO = Array.from({ length: 49 }, (_, i) => String(72 + i));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-12 z-10">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
          <ClipboardList className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <h1 className="text-base sm:text-lg font-bold tracking-tight">Laudos</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Comprovante de Capacidade Técnica â€” Arma de Fogo
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
              {/* Tipo de Laudo â€” radio pill + Limpar */}
              <div className="flex items-center gap-2 text-xs font-medium">
                <button type="button"
                  onClick={() => { setForm(p => ({ ...EMPTY, numero: p.numero })); setSinarmPorte(false); toast.info("Formulário limpo."); }}
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
                {laudoTipo === "sinarm" && (
                  <div className="flex items-center gap-1.5 pl-1">
                    <Switch checked={sinarmPorte} onCheckedChange={setSinarmPorte} />
                    <span className="text-muted-foreground">Porte</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Seletor de cadastrado */}
            <div ref={cadRef} className="relative space-y-1">
              <Label className="text-xs text-muted-foreground">Preencher a partir de cadastro</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="h-9 text-sm pl-8"
                  placeholder="Buscar por nome ou CPF..."
                  value={cadSearch}
                  onFocus={() => setCadOpen(true)}
                  onChange={e => { setCadSearch(e.target.value); setCadOpen(true); }}
                />
              </div>
              {cadOpen && cadFiltrados.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-52 overflow-y-auto">
                  {cadFiltrados.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); selecionarCadastro(c); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex flex-col gap-0.5"
                    >
                      <span className="font-medium">{c.nome.toUpperCase()}</span>
                      {c.cpf && <span className="text-xs text-muted-foreground">{c.cpf}</span>}
                    </button>
                  ))}
                </div>
              )}
              {cadOpen && cadSearch.trim() && cadFiltrados.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md px-3 py-2 text-sm text-muted-foreground">
                  Nenhum cadastro encontrado.
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Nome Completo</Label>
                <Input className="h-9 text-sm uppercase" value={form.nome}
                  onChange={e => set("nome", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">N° Comprovante</Label>
                <Input className="h-9 text-sm"
                  value={form.numero}
                  onChange={e => set("numero", e.target.value)}
                  onBlur={e => {
                    const v = e.target.value.trim();
                    if (v) supabase.rpc("set_laudo_ultimo_numero", { p_numero: v })
                      .then(({ error }) => { if (error) console.error("[laudo] set_ultimo_numero:", error); });
                  }} />
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
              <div className="col-span-2 grid grid-cols-[1fr_70px] gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input className="h-9 text-sm uppercase" value={form.endCidade}
                    onChange={e => set("endCidade", e.target.value)} placeholder="EX: MANAUS" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">UF</Label>
                  <Input className="h-9 text-sm uppercase" value={form.endEstado}
                    onChange={e => set("endEstado", e.target.value)} placeholder="AM" maxLength={2} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Armas â€” conteúdo muda por tipo de laudo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-primary">
              {laudoTipo === "sinarm" ? "Dados da Arma de Fogo Utilizada" : "Armas de Fogo â€” SINARM / SIGMA"}
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
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-orange-400">
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
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-orange-400">
              Local da Prova Prática (Estande)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {([
              ["juliet", "Clube de Tiro Juliet Papa"],
              ["cta",    "CTA Iranduba"],
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
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-orange-400">
              Notas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Nota Teórica â€” sempre 20 */}
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
                {/* Pistola â€” Popover grade 72-120 */}
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
                      {/* Grade 7Ã—6 = 42 slots para 41 opções (60-100), sem rolagem */}
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
                {/* Revólver â€” Popover grade 72-120 sem rolagem */}
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
                {/* Rifle â€” toggle manual: marcado = 50 */}
                <div className="space-y-1">
                  <Label className="text-xs">Rifle</Label>
                  <button type="button"
                    onClick={() => set("notaRifle", form.notaRifle ? "" : "50")}
                    className={cn("h-9 px-3 w-full flex items-center justify-between rounded-md border text-sm transition-colors",
                      form.notaRifle
                        ? "bg-primary text-primary-foreground border-primary font-semibold"
                        : "border-border text-muted-foreground hover:border-primary/50")}>
                    <span>{form.notaRifle ? `50 âœ“` : "- (clique p/ marcar)"}</span>
                  </button>
                </div>
                {/* Espingarda â€” toggle manual: marcada = APTO */}
                <div className="space-y-1">
                  <Label className="text-xs">Espingarda</Label>
                  <button type="button"
                    onClick={() => set("notaEspingarda", form.notaEspingarda ? "" : "APTO")}
                    className={cn("h-9 px-3 w-full flex items-center justify-between rounded-md border text-sm transition-colors",
                      form.notaEspingarda
                        ? "bg-primary text-primary-foreground border-primary font-semibold"
                        : "border-border text-muted-foreground hover:border-primary/50")}>
                    <span>{form.notaEspingarda ? `APTO âœ“` : "- (clique p/ marcar)"}</span>
                  </button>
                </div>
              </div>
            </div>
            {/* Alvo Multicolorido â€” apenas SINARM Posse/Porte */}
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
                      {/* Grade 7Ã—7 = 49 opções (72-120), estilo calendário */}
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
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-orange-400">
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
              await gerarLaudoPDF(form, laudoTipo, sinarmPorte);
              toast.success("Laudo gerado com sucesso!");
              // Incrementa o número e limpa o formulário
              const proximoNumero = form.numero && /^\d+$/.test(form.numero.trim())
                ? String(parseInt(form.numero.trim()) + 1)
                : form.numero;
              setForm({ ...EMPTY, numero: proximoNumero });
              setSinarmPorte(false);
              if (proximoNumero) {
                supabase.rpc("set_laudo_ultimo_numero", { p_numero: proximoNumero })
                  .then(({ error }) => { if (error) console.error("[laudo] set_ultimo_numero:", error); });
              }
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

