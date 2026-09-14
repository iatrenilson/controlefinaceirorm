import { useState } from "react";
import { ClipboardList, Download, CalendarIcon } from "lucide-react";
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

// ─── Types ──────────────────────────────────────────────────────────────────────
type SistReg = "" | "SINARM" | "SIGMA";

type Finalidade = "aquisicao" | "porte" | "cr";
type Categoria  = "defesa" | "institucional" | "cac";

interface LaudoForm {
  numero: string;
  nome: string;
  cpf: string;
  endereco: string;
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
  conclusao: "" | "apto" | "inapto";
  dataFinal: string;
}

const EMPTY: LaudoForm = {
  numero: "", nome: "", cpf: "", endereco: "",
  pistola: "", revolver: "", rifle: "", espingarda: "",
  dataDecl: "", local: "",
  finalidade: [], categoria: [],
  notaTeorica: "20", notaPistola: "", notaRevolver: "", notaRifle: "", notaEspingarda: "",
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
async function gerarLaudoPDF(f: LaudoForm) {
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

  // ENDEREÇO
  B(9); doc.text("ENDEREÇO:", ML + 2, dy + 11);
  const endLblW = doc.getTextWidth("ENDEREÇO:");
  const endX = ML + 2 + endLblW + 2;
  const endVal = f.endereco.toUpperCase();
  N(9); doc.text(endVal, endX, dy + 11);

  y += dadosH + 0.8;

  // ════════════════════════════════════════════
  // ARMAS DE FOGO UTILIZADAS
  // ════════════════════════════════════════════
  const ARMAS = [
    { tipo: "PISTOLA",    serie: "ADK 818094",  marca: "TAUROS GX4",    reg: "905970870", cal: "9 MM",    sist: f.pistola },
    { tipo: "REVOLVER",   serie: "ACL 493291",  marca: "TAURUS RT 85S", reg: "906589762", cal: "38",      sist: f.revolver },
    { tipo: "RIFLE",      serie: "NWE 4872174", marca: "ROSSI",         reg: "905938944", cal: "357 MAG", sist: f.rifle },
    { tipo: "ESPINGARDA", serie: "G11534022",   marca: "BOITO",         reg: "905938936", cal: "12",      sist: f.espingarda },
  ];
  const aRowH = 10;
  const armasH = HDR + ARMAS.length * aRowH;
  section(y, armasH, "ARMAS DE FOGO UTILIZADAS");

  // Colunas: c1 a 65mm, c2 a 125mm
  const c1 = ML + 65, c2 = ML + 126;
  vl(c1, y + HDR, y + armasH);
  vl(c2, y + HDR, y + armasH);

  ARMAS.forEach((a, i) => {
    const ry = y + HDR + i * aRowH;
    // sem linha horizontal entre linhas de arma (igual ao original)

    // Col 1
    B(8.5); doc.text(`TIPO: ${a.tipo}`,      ML + 3, ry + 4);
    N(8);   doc.text(`Nº SÉRIE: ${a.serie}`, ML + 3, ry + 7.5);

    // Col 2
    B(8.5); doc.text(`MARCA: ${a.marca}`,       c1 + 3, ry + 4);
    N(8);   doc.text(`REGISTRO Nº: ${a.reg}`,    c1 + 3, ry + 7.5);

    // Col 3
    B(8.5); doc.text(`CALIBRE: ${a.cal}`,  c2 + 3, ry + 4);
    // SINARM / SIGMA
    N(8);
    let rx = c2 + 3;
    rx += renderPc(a.sist === "SINARM", rx, ry + 7.5);
    doc.text(" SINARM", rx, ry + 7.5);
    rx += doc.getTextWidth(" SINARM") + 2;
    rx += renderPc(a.sist === "SIGMA", rx, ry + 7.5);
    doc.text(" SIGMA", rx, ry + 7.5);
  });

  y += armasH + 0.8;

  // ════════════════════════════════════════════
  // DECLARAÇÃO
  // ════════════════════════════════════════════
  const declH = HDR + 28;
  section(y, declH, "DECLARAÇÃO");

  const decY = y + HDR + 1;

  // Texto corrido: "Eu [NOME] acima identificado, DECLARO..." + data
  const nomeDecl   = (f.nome || "___________________________________").toUpperCase();
  const suffix     = ` acima identificado, DECLARO, sob as penas da lei, que NÃO ME SUBMETI a testes para a aferição de capacidade técnica para o manuseio de armas de fogo nos últimos 30 dias. Manaus/AM, ${fmtDate(f.dataDecl)}`;

  // Mede o que foi usado na linha 1 por "Eu [NOME]"
  N(9); const euW   = doc.getTextWidth("Eu ");
  N(9); const nomeW = doc.getTextWidth(nomeDecl);
  const line1Avail  = CW - 4 - euW - nomeW;

  // Quebra o suffix: parte que cabe na linha 1 e resto
  N(9);
  const suffixParts = doc.splitTextToSize(suffix, line1Avail);
  const part1       = (suffixParts[0] as string) || "";
  const restText    = suffix.slice(part1.length).trim();
  const restLines   = restText ? doc.splitTextToSize(restText, CW - 4) : [];

  // Desenha linha 1
  let dx = ML + 2;
  N(9); doc.text("Eu ", dx, decY + 5);      dx += euW;
  N(9); doc.text(nomeDecl, dx, decY + 5);   dx += nomeW;
  N(9); doc.text(part1, dx, decY + 5);

  // Linhas seguintes
  if (restLines.length) {
    N(9); doc.text(restLines as string[], ML + 2, decY + 10.5);
  }

  // Linha de assinatura — canto direito, dentro da caixa
  const sigLineX = PW / 2 + 5;
  const sigLineW = ML + CW - sigLineX - 2;
  ul(sigLineX, decY + 21, sigLineW);
  N(9); doc.text("ASSINATURA DO AVALIADO", sigLineX + sigLineW / 2, decY + 25, { align: "center" });

  y += declH + 0.8;

  // ════════════════════════════════════════════
  // LOCAL DE APLICAÇÃO PROVA PRATICA
  // ════════════════════════════════════════════
  const LOCAIS = [
    { id: "juliet", nome: "Clube de Tiro Juliet Papa",           end: "R. Alm. Maximiano, 8 - Dom Pedro, Manaus/AM." },
    { id: "texas",  nome: "Clube de Tiro Texas Gun",             end: "Av. Compensa, 180B – Vila da Prata, Manaus/AM." },
    { id: "cta",    nome: "CTA INDOR Clube de Tiro do Amazonas", end: "Av. Pedro Teixeira - Chapada, Manaus/AM." },
  ];
  const lRowH = 9;
  const localH = HDR + LOCAIS.length * lRowH;
  section(y, localH, "LOCAL DE APLICAÇÃO PROVA PRATICA (ESTANDE)");

  LOCAIS.forEach((loc, i) => {
    const ly = y + HDR + i * lRowH;
    if (i > 0) hl(ly);
    sqBox(ML + 2.5, ly + 5, f.local === loc.id);
    B(9); doc.text(`NOME: ${loc.nome}`, ML + 8, ly + 4);
    N(9); doc.text(`ENDEREÇO: ${loc.end}`, ML + 8, ly + 7.8);
  });

  y += localH + 0.8;

  // ════════════════════════════════════════════
  // FUNDAMENTAÇÃO
  // ════════════════════════════════════════════
  const fundH = HDR + 21;
  section(y, fundH, "FUNDAMENTAÇÃO");

  const fndY = y + HDR + 1;

  // FINALIDADE — sem negrito, igual ao original
  N(9); doc.text("FINALIDADE:", ML + 2, fndY + 3.5);
  let fx = ML + 2 + doc.getTextWidth("FINALIDADE:") + 2;
  fx += renderPc(f.finalidade.includes("aquisicao"), fx, fndY + 3.5);
  doc.text(" AQUISIÇÃO, REGISTRO OU TRANSFERÊNCIA  ", fx, fndY + 3.5);
  fx += doc.getTextWidth(" AQUISIÇÃO, REGISTRO OU TRANSFERÊNCIA  ");
  fx += renderPc(f.finalidade.includes("porte"), fx, fndY + 3.5);
  doc.text(" PORTE  ", fx, fndY + 3.5);
  fx += doc.getTextWidth(" PORTE  ");
  fx += renderPc(f.finalidade.includes("cr"), fx, fndY + 3.5);
  doc.text(" CR", fx, fndY + 3.5);

  // CATEGORIA — sem negrito
  N(9); doc.text("CATEGORIA:", ML + 2, fndY + 8);
  fx = ML + 2 + doc.getTextWidth("CATEGORIA:") + 2;
  fx += renderPc(f.categoria.includes("defesa"), fx, fndY + 8);
  doc.text(" DEFESA PESSOAL  ", fx, fndY + 8);
  fx += doc.getTextWidth(" DEFESA PESSOAL  ");
  fx += renderPc(f.categoria.includes("institucional"), fx, fndY + 8);
  doc.text(" INSTITUCIONAL  ", fx, fndY + 8);
  fx += doc.getTextWidth(" INSTITUCIONAL  ");
  fx += renderPc(f.categoria.includes("cac"), fx, fndY + 8);
  doc.text(" CAC", fx, fndY + 8);

  // NOTA — label normal, valor em negrito
  N(9); doc.text("NOTA DA PROVA TEÓRICA:", ML + 2, fndY + 12.5);
  const notaX = ML + 2 + doc.getTextWidth("NOTA DA PROVA TEÓRICA:") + 2;
  B(9); doc.text(f.notaTeorica || "–", notaX, fndY + 12.5);

  // PONTUAÇÃO — label normal, valores em negrito
  N(9); doc.text("PONTUAÇÃO NO ALVO SILHUETA:", ML + 2, fndY + 17);
  let px = ML + 2 + doc.getTextWidth("PONTUAÇÃO NO ALVO SILHUETA:") + 2;
  const armas2 = [
    { lbl: "PISTOLA: ",    val: f.notaPistola    || "–" },
    { lbl: "  REVOLVER: ", val: f.notaRevolver   || "–" },
    { lbl: "  RIFLE: ",    val: f.notaRifle      || "–" },
    { lbl: "  ESPINGARDA: ", val: f.notaEspingarda || "–" },
  ];
  armas2.forEach(({ lbl, val }) => {
    N(9); doc.text(lbl, px, fndY + 17); px += doc.getTextWidth(lbl);
    B(9); doc.text(val, px, fndY + 17); px += doc.getTextWidth(val);
  });

  y += fundH + 0.8;

  // ════════════════════════════════════════════
  // CONCLUSÃO
  // ════════════════════════════════════════════
  const concH = HDR + 8;
  section(y, concH, "CONCLUSÃO");

  // Caixas menores, X centralizado, fonte normal (igual original)
  const bsz = 3.2;
  const ccY = y + HDR + 3.5;
  const bx1 = PW / 2 - 22, bx2 = PW / 2 + 8;

  // Desenha caixa e X centralizado manualmente
  const drawBox = (bx: number, marked: boolean) => {
    doc.setDrawColor(0); doc.setFillColor(255,255,255); doc.setLineWidth(0.25);
    doc.rect(bx, ccY - bsz + 0.3, bsz, bsz, "S");
    if (marked) {
      B(9); doc.setTextColor(0);
      doc.text("X", bx + bsz / 2, ccY - bsz / 2 + 1.1, { align: "center" });
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
  a.download = `Laudo CR - ${f.nome ? f.nome.split(" ")[0] : "Laudo"}.pdf`;
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
  const [dateOpen, setDateOpen] = useState(false);
  const set = <K extends keyof LaudoForm>(k: K, v: LaudoForm[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // Ao marcar rifle/espingarda → preenche nota automaticamente
  const setArma = (key: "pistola" | "revolver" | "rifle" | "espingarda", val: SistReg) => {
    setForm(p => ({
      ...p,
      [key]: val,
      ...(key === "rifle"      ? { notaRifle:      val ? "50"   : "" } : {}),
      ...(key === "espingarda" ? { notaEspingarda: val ? "APTO" : "" } : {}),
    }));
  };

  const armaRows: Array<{ label: string; key: "pistola" | "revolver" | "rifle" | "espingarda" }> = [
    { label: "Pistola",    key: "pistola" },
    { label: "Revólver",   key: "revolver" },
    { label: "Rifle",      key: "rifle" },
    { label: "Espingarda", key: "espingarda" },
  ];

  // Opções de pontuação 72-120
  const PONT_OPTIONS = Array.from({ length: 49 }, (_, i) => String(72 + i));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
          <ClipboardList className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
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
              {/* Tipo de Laudo */}
              <div className="flex rounded-md overflow-hidden border border-border text-xs font-medium">
                <button type="button"
                  onClick={() => setLaudoTipo("cr_cac")}
                  className={cn("px-3 py-1.5 transition-colors",
                    laudoTipo === "cr_cac"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted")}>
                  CR / CAC
                </button>
                <button type="button"
                  onClick={() => setLaudoTipo("sinarm")}
                  className={cn("px-3 py-1.5 border-l border-border transition-colors",
                    laudoTipo === "sinarm"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted")}>
                  SINARM Posse/Porte
                </button>
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
            <div className="space-y-1">
              <Label className="text-xs">Endereço</Label>
              <Input className="h-9 text-sm uppercase" value={form.endereco}
                onChange={e => set("endereco", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Armas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-primary">
              Armas de Fogo — SINARM / SIGMA
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                <CheckBtn checked={form.finalidade.includes("cr")}
                  onClick={() => set("finalidade", toggle(form.finalidade, "cr"))}
                  label="CR" />
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
                <CheckBtn checked={form.categoria.includes("cac")}
                  onClick={() => set("categoria", toggle(form.categoria, "cac"))}
                  label="CAC" />
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
                      {/* Grade 7×7 = 49 opções sem rolagem, estilo calendário */}
                      <div className="grid grid-cols-7 gap-0.5">
                        {PONT_OPTIONS.map(n => (
                          <button key={n} type="button"
                            onClick={() => { set("notaPistola", n); setPistOpen(false); }}
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
                        {PONT_OPTIONS.map(n => (
                          <button key={n} type="button"
                            onClick={() => { set("notaRevolver", n); setRevolOpen(false); }}
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
              await gerarLaudoPDF(form);
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
