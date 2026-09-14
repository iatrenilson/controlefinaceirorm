import { useState } from "react";
import { ClipboardList, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface LaudoForm {
  numero: string;
  nome: string;
  cpf: string;
  endereco: string;
  usouPistola: boolean;    sistPistola: "SINARM" | "SIGMA" | "";
  usouRevolver: boolean;   sistRevolver: "SINARM" | "SIGMA" | "";
  usouRifle: boolean;      sistRifle: "SINARM" | "SIGMA" | "";
  usouEspingarda: boolean; sistEspingarda: "SINARM" | "SIGMA" | "";
  dataDecl: string;
  local: "juliet" | "texas" | "cta" | "";
  finalidade: "aquisicao" | "porte" | "cr" | "";
  categoria: "defesa" | "institucional" | "cac" | "";
  notaTeorica: string;
  notaPistola: string; notaRevolver: string; notaRifle: string; notaEspingarda: string;
  conclusao: "apto" | "inapto" | "";
  dataFinal: string;
}

const EMPTY: LaudoForm = {
  numero: "",
  nome: "", cpf: "", endereco: "",
  usouPistola: false, sistPistola: "",
  usouRevolver: false, sistRevolver: "",
  usouRifle: false, sistRifle: "",
  usouEspingarda: false, sistEspingarda: "",
  dataDecl: "",
  local: "",
  finalidade: "", categoria: "",
  notaTeorica: "",
  notaPistola: "", notaRevolver: "", notaRifle: "", notaEspingarda: "",
  conclusao: "",
  dataFinal: "",
};

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

// ─── PDF Generator — Layout idêntico ao original ────────────────────────────
async function gerarLaudoPDF(f: LaudoForm) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

  const PW = 210, PH = 297;
  const ML = 10, MR = 10;
  const CW = PW - ML - MR; // 190mm

  doc.setDrawColor(0, 0, 0);

  // ── helpers ──
  const B  = (sz: number) => { doc.setFont("helvetica", "bold");   doc.setFontSize(sz); };
  const N  = (sz: number) => { doc.setFont("helvetica", "normal"); doc.setFontSize(sz); };
  const BI = (sz: number) => { doc.setFont("helvetica", "bolditalic"); doc.setFontSize(sz); };

  // Caixa com borda e cabeçalho cinza (header text centered bold)
  const sectionBox = (y: number, h: number) => {
    doc.setLineWidth(0.3);
    doc.rect(ML, y, CW, h);
  };
  // Linha separadora interna horizontal
  const hLine = (y: number, x1 = ML, x2 = ML + CW) => {
    doc.setLineWidth(0.2);
    doc.line(x1, y, x2, y);
  };
  // Linha underline para campo
  const underline = (x: number, y: number, w: number) => {
    doc.setLineWidth(0.2);
    doc.line(x, y, x + w, y);
  };
  // Checkbox quadrado pequeno
  const sq = (x: number, y: number, checked: boolean, sz = 3) => {
    doc.setLineWidth(0.25);
    doc.rect(x, y - sz + 0.5, sz, sz);
    if (checked) {
      B(8); doc.setTextColor(0);
      doc.text("X", x + sz / 2, y - 0.3, { align: "center" });
    }
  };
  // Checkbox com parênteses: ( ) ou (X)
  const pc = (x: number, y: number, checked: boolean) => {
    N(8); doc.setTextColor(0);
    doc.text(checked ? "(X)" : "(   )", x, y);
  };

  let y = ML; // cursor vertical

  // ══════════════════════════════════════════════════════
  // BLOCO 1 — TÍTULO + TEXTO LEGAL (com borda)
  // ══════════════════════════════════════════════════════
  const bloco1H = 30;
  sectionBox(y, bloco1H);

  // ANEXO II — canto superior direito dentro da caixa
  B(9); doc.setTextColor(0);
  doc.text("ANEXO II", ML + CW - 2, y + 4.5, { align: "right" });

  // Título principal centrado e negrito
  B(9);
  const numStr = f.numero ? f.numero : "______";
  doc.text(
    `COMPROVANTE DE CAPACIDADE TÉCNICA PARA O MANUSEIO DE ARMA DE FOGO N°${numStr}2026`,
    PW / 2, y + 4.5, { align: "center", maxWidth: CW - 30 }
  );

  // Texto legal em fonte pequena
  N(6.5);
  const legal = "O comprovante de capacidade técnica de arma de fogo deverá ser expedido por instrutor de armamento e tiro credenciado pela Polícia Federal e deverá atestar, necessariamente: (a) conhecimento da conceituação e normas de segurança pertinentes à arma de fogo; (b) conhecimento básico dos componentes e partes da arma de fogo e (c) habilidade do uso da arma de fogo demonstrada, pelo interessado, em estande de tiro (artigo 4°, inciso III e artigo 12, inciso VI e § 3°, da Lei nº 10.826/03; e artigo 36 do Decreto nº 5.123/04).";
  const legalLines = doc.splitTextToSize(legal, CW - 4);
  doc.text(legalLines, ML + 2, y + 9);

  y += bloco1H + 1;

  // ══════════════════════════════════════════════════════
  // BLOCO 2 — DADOS DO AVALIADO
  // ══════════════════════════════════════════════════════
  const bloco2H = 24;
  sectionBox(y, bloco2H);
  // Cabeçalho cinza com borda inferior
  doc.setFillColor(220, 220, 220);
  doc.rect(ML, y, CW, 6, "F");
  hLine(y + 6);
  B(9); doc.setTextColor(0);
  doc.text("DADOS DO AVALIADO", PW / 2, y + 4.3, { align: "center" });

  // Campos
  N(8.5); doc.setTextColor(0);
  const nomeVal = f.nome.toUpperCase();
  const cpfVal  = f.cpf;
  const endVal  = f.endereco.toUpperCase();

  // NOME
  doc.text("NOME:", ML + 2, y + 11);
  B(8.5); doc.text(nomeVal, ML + 14, y + 11);
  underline(ML + 13, y + 11.5, CW - 15);

  // CPF
  N(8.5);
  doc.text("CPF:", ML + 2, y + 16);
  B(8.5); doc.text(cpfVal, ML + 11, y + 16);
  underline(ML + 10, y + 16.5, CW - 12);

  // ENDEREÇO
  N(8.5);
  doc.text("ENDEREÇO:", ML + 2, y + 21);
  B(8.5); doc.text(endVal, ML + 22, y + 21);
  underline(ML + 21, y + 21.5, CW - 23);

  y += bloco2H + 1;

  // ══════════════════════════════════════════════════════
  // BLOCO 3 — ARMAS DE FOGO UTILIZADAS
  // ══════════════════════════════════════════════════════
  const armas = [
    { tipo: "PISTOLA",    serie: "ADK 818094",  marca: "TAUROS GX4",    reg: "905970870", calibre: "9 MM",    usou: f.usouPistola,    sist: f.sistPistola },
    { tipo: "REVOLVER",   serie: "ACL 493291",  marca: "TAURUS RT 85S", reg: "906589762", calibre: "38",      usou: f.usouRevolver,   sist: f.sistRevolver },
    { tipo: "RIFLE",      serie: "NWE 4872174", marca: "ROSSI",         reg: "905938944", calibre: "357 MAG", usou: f.usouRifle,     sist: f.sistRifle },
    { tipo: "ESPINGARDA", serie: "G11534022",   marca: "BOITO",         reg: "905938936", calibre: "12",      usou: f.usouEspingarda, sist: f.sistEspingarda },
  ];
  const armaRowH = 9;
  const bloco3H = 6 + armas.length * armaRowH + 1;
  sectionBox(y, bloco3H);
  doc.setFillColor(220, 220, 220);
  doc.rect(ML, y, CW, 6, "F");
  hLine(y + 6);
  B(9); doc.setTextColor(0);
  doc.text("ARMAS DE FOGO UTILIZADAS", PW / 2, y + 4.3, { align: "center" });

  // Linhas verticais separando colunas: col1=70, col2=120
  const c1 = ML + 68, c2 = ML + 118;
  doc.setLineWidth(0.2);
  doc.line(c1, y + 6, c1, y + bloco3H);
  doc.line(c2, y + 6, c2, y + bloco3H);

  armas.forEach((a, i) => {
    const ry = y + 6 + i * armaRowH;
    if (i > 0) hLine(ry);

    // Coluna 1 — TIPO + SÉRIE (com checkbox de uso)
    B(7.5); doc.setTextColor(0);
    // Checkbox de uso da arma (marcado com X se usou)
    sq(ML + 2, ry + 5.5, a.usou);
    doc.text(`TIPO: ${a.tipo}`, ML + 7, ry + 5);
    N(7); doc.text(`Nº SÉRIE: ${a.serie}`, ML + 7, ry + 8.3);

    // Coluna 2 — MARCA + REGISTRO
    B(7.5);
    doc.text(`MARCA: ${a.marca}`, c1 + 3, ry + 5);
    N(7); doc.text(`REGISTRO Nº: ${a.reg}`, c1 + 3, ry + 8.3);

    // Coluna 3 — CALIBRE + SINARM/SIGMA
    B(7.5);
    doc.text(`CALIBRE: ${a.calibre}`, c2 + 3, ry + 5);
    N(7);
    pc(c2 + 3, ry + 8.3, a.sist === "SINARM");
    doc.text(" SINARM  ", c2 + 9, ry + 8.3);
    pc(c2 + 28, ry + 8.3, a.sist === "SIGMA");
    doc.text(" SIGMA", c2 + 34, ry + 8.3);
  });

  y += bloco3H + 1;

  // ══════════════════════════════════════════════════════
  // BLOCO 4 — DECLARAÇÃO
  // ══════════════════════════════════════════════════════
  const bloco4H = 36;
  sectionBox(y, bloco4H);
  doc.setFillColor(220, 220, 220);
  doc.rect(ML, y, CW, 6, "F");
  hLine(y + 6);
  B(9); doc.setTextColor(0);
  doc.text("DECLARAÇÃO", PW / 2, y + 4.3, { align: "center" });

  N(8.5); doc.setTextColor(0);
  // Linha underline para o nome do avaliado
  underline(ML + 2, y + 12, 70);
  if (f.nome) { B(8.5); doc.text(f.nome.toUpperCase(), ML + 3, y + 11.5); }
  N(8.5);
  doc.text("acima identificado, DECLARO, sob as penas da lei, que NÃO ME SUBMETI a", ML + 75, y + 11.5);

  N(8.5);
  const declTxt = "testes para a aferição de capacidade técnica para o manuseio de armas de fogo nos últimos 30 dias.  Manaus/AM,";
  doc.text(declTxt, ML + 2, y + 16);
  // Data inline
  B(8.5);
  const dDecl = fmtDate(f.dataDecl);
  doc.text(dDecl, ML + 2 + doc.getTextWidth(declTxt) + 1, y + 16);

  // Linha de assinatura
  underline(ML + 40, y + 29, 110);
  N(8.5); doc.setTextColor(0);
  doc.text("ASSINATURA DO AVALIADO", PW / 2, y + 32.5, { align: "center" });

  y += bloco4H + 1;

  // ══════════════════════════════════════════════════════
  // BLOCO 5 — LOCAL DE APLICAÇÃO PROVA PRATICA
  // ══════════════════════════════════════════════════════
  const locais = [
    { id: "juliet", nome: "Clube de Tiro Juliet Papa",           end: "R. Alm. Maximiano, 8 - Dom Pedro, Manaus/AM." },
    { id: "texas",  nome: "Clube de Tiro Texas Gun",             end: "Av. Compensa, 180B – Vila da Prata, Manaus/AM." },
    { id: "cta",    nome: "CTA INDOR Clube de Tiro do Amazonas", end: "Av. Pedro Teixeira - Chapada, Manaus/AM." },
  ];
  const bloco5H = 6 + locais.length * 10 + 2;
  sectionBox(y, bloco5H);
  doc.setFillColor(220, 220, 220);
  doc.rect(ML, y, CW, 6, "F");
  hLine(y + 6);
  B(9); doc.setTextColor(0);
  doc.text("LOCAL DE APLICAÇÃO PROVA PRATICA (ESTANDE)", PW / 2, y + 4.3, { align: "center" });

  locais.forEach((loc, i) => {
    const ly = y + 6 + i * 10;
    if (i > 0) hLine(ly);
    sq(ML + 2, ly + 5.5, f.local === loc.id);
    B(8.5); doc.setTextColor(0);
    doc.text(`NOME: ${loc.nome}`, ML + 7, ly + 5);
    N(8); doc.text(`ENDEREÇO: ${loc.end}`, ML + 7, ly + 9);
  });

  y += bloco5H + 1;

  // ══════════════════════════════════════════════════════
  // BLOCO 6 — FUNDAMENTAÇÃO
  // ══════════════════════════════════════════════════════
  const bloco6H = 29;
  sectionBox(y, bloco6H);
  doc.setFillColor(220, 220, 220);
  doc.rect(ML, y, CW, 6, "F");
  hLine(y + 6);
  B(9); doc.setTextColor(0);
  doc.text("FUNDAMENTAÇÃO", PW / 2, y + 4.3, { align: "center" });

  N(8.5); doc.setTextColor(0);

  // FINALIDADE
  let fx = ML + 2;
  doc.text("FINALIDADE:", fx, y + 12); fx += 24;
  pc(fx, y + 12, f.finalidade === "aquisicao"); fx += 10;
  doc.text("AQUISIÇÃO, REGISTRO OU TRANSFERÊNCIA", fx, y + 12); fx += 75;
  pc(fx, y + 12, f.finalidade === "porte"); fx += 10;
  doc.text("PORTE", fx, y + 12); fx += 14;
  pc(fx, y + 12, f.finalidade === "cr"); fx += 10;
  doc.text("CR", fx, y + 12);

  // CATEGORIA
  fx = ML + 2;
  doc.text("CATEGORIA:", fx, y + 18); fx += 22;
  pc(fx, y + 18, f.categoria === "defesa"); fx += 10;
  doc.text("DEFESA PESSOAL", fx, y + 18); fx += 32;
  pc(fx, y + 18, f.categoria === "institucional"); fx += 10;
  doc.text("INSTITUCIONAL", fx, y + 18); fx += 30;
  pc(fx, y + 18, f.categoria === "cac"); fx += 10;
  doc.text("CAC", fx, y + 18);

  hLine(y + 20);

  // NOTA TEÓRICA
  doc.text(`NOTA DA PROVA TEÓRICA: ${f.notaTeorica || "_____"}`, ML + 2, y + 25);
  // PONTUAÇÃO
  doc.text(
    `PONTUAÇÃO NO ALVO SILHUETA:  PISTOLA: ${f.notaPistola || "___"}    REVOLVER: ${f.notaRevolver || "___"}    RIFLE: ${f.notaRifle || "___"}    ESPINGARDA: ${f.notaEspingarda || "___"}`,
    ML + 2, y + 27.5
  );

  y += bloco6H + 1;

  // ══════════════════════════════════════════════════════
  // BLOCO 7 — CONCLUSÃO
  // ══════════════════════════════════════════════════════
  const bloco7H = 17;
  sectionBox(y, bloco7H);
  doc.setFillColor(220, 220, 220);
  doc.rect(ML, y, CW, 6, "F");
  hLine(y + 6);
  B(9); doc.setTextColor(0);
  doc.text("CONCLUSÃO", PW / 2, y + 4.3, { align: "center" });

  // Caixas grandes APTO / INAPTO
  const bsz = 5;
  const cx1 = PW / 2 - 30, cx2 = PW / 2 + 10;
  const cy  = y + 12;

  doc.setLineWidth(0.4);
  doc.rect(cx1, cy - bsz + 0.5, bsz, bsz);
  if (f.conclusao === "apto") { B(10); doc.text("X", cx1 + bsz / 2, cy - 0.2, { align: "center" }); }

  doc.rect(cx2, cy - bsz + 0.5, bsz, bsz);
  if (f.conclusao === "inapto") { B(10); doc.text("X", cx2 + bsz / 2, cy - 0.2, { align: "center" }); }

  B(11); doc.setTextColor(0);
  doc.text("APTO",   cx1 + bsz + 2, cy);
  doc.text("INAPTO", cx2 + bsz + 2, cy);

  y += bloco7H + 1;

  // ══════════════════════════════════════════════════════
  // BLOCO 8 — AVALIADOR
  // ══════════════════════════════════════════════════════
  const bloco8H = 14;
  sectionBox(y, bloco8H);
  doc.setFillColor(220, 220, 220);
  doc.rect(ML, y, CW, 6, "F");
  hLine(y + 6);
  B(9); doc.setTextColor(0);
  doc.text("AVALIADOR", PW / 2, y + 4.3, { align: "center" });

  N(8.5); doc.setTextColor(0);
  doc.text("NOME: William Bruno Toyoda Hitotuzi", ML + 2, y + 10.5);
  doc.text("CPF: 733.633.592-68", ML + 100, y + 10.5);
  doc.text("PORTARIA: DREX/SR/PF/AM - N° 01/2025, 14/11/2025", ML + 2, y + 13.5);
  doc.text("VALIDADE: 31/10/2029", ML + 115, y + 13.5);

  y += bloco8H + 6;

  // ══════════════════════════════════════════════════════
  // DATA FINAL + ASSINATURA AVALIADOR
  // ══════════════════════════════════════════════════════
  N(9); doc.setTextColor(0);
  const dFinal = fmtDate(f.dataFinal);
  doc.text(`Manaus/AM. ${dFinal}`, ML + CW - 2, y, { align: "right" });

  y += 12;
  underline(PW / 2 - 40, y, 80);
  y += 4;
  B(8.5);
  doc.text("William Bruno Toyoda Hitotuzi", PW / 2, y, { align: "center" });
  y += 4;
  doc.text("IAT", PW / 2, y, { align: "center" });

  // Download
  const blob = doc.output("blob");
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `Laudo CR - ${f.nome ? f.nome.split(" ")[0] : "Laudo"}.pdf`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── UI Helpers ────────────────────────────────────────────────────────────────
function RadioBtn({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors ${checked ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
    >
      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${checked ? "border-primary-foreground" : "border-current"}`}>
        {checked && <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
      </span>
      {label}
    </button>
  );
}

function CheckBtn({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors ${checked ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
    >
      <span className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${checked ? "border-primary-foreground" : "border-current"}`}>
        {checked && <span className="text-[10px] leading-none font-bold">✓</span>}
      </span>
      {label}
    </button>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────
const Laudos = () => {
  const [form, setForm] = useState<LaudoForm>(EMPTY);
  const set = <K extends keyof LaudoForm>(k: K, v: LaudoForm[K]) => setForm(p => ({ ...p, [k]: v }));

  const armaRows = [
    { label: "Pistola",    usouKey: "usouPistola"    as const, sistKey: "sistPistola"    as const },
    { label: "Revólver",   usouKey: "usouRevolver"   as const, sistKey: "sistRevolver"   as const },
    { label: "Rifle",      usouKey: "usouRifle"      as const, sistKey: "sistRifle"      as const },
    { label: "Espingarda", usouKey: "usouEspingarda" as const, sistKey: "sistEspingarda" as const },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4">
          <ClipboardList className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">Laudos</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Comprovante de Capacidade Técnica — Arma de Fogo</p>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 max-w-2xl mx-auto space-y-5">

        {/* Dados do Avaliado */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">Dados do Avaliado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Nome Completo</Label>
                <Input className="h-9 text-sm uppercase" value={form.nome} onChange={e => set("nome", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">N° Comprovante</Label>
                <Input className="h-9 text-sm" placeholder="______" value={form.numero} onChange={e => set("numero", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <Input className="h-9 text-sm font-mono" placeholder="000.000.000-00" value={form.cpf} onChange={e => set("cpf", maskCpf(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Endereço</Label>
              <Input className="h-9 text-sm uppercase" value={form.endereco} onChange={e => set("endereco", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Armas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">Armas de Fogo Utilizadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {armaRows.map(({ label, usouKey, sistKey }) => (
              <div key={label} className="flex flex-wrap items-center gap-2">
                <CheckBtn checked={form[usouKey] as boolean} onClick={() => set(usouKey, !form[usouKey])} label={label} />
                {form[usouKey] && (
                  <div className="flex gap-2 ml-2">
                    <RadioBtn checked={form[sistKey] === "SINARM"} onClick={() => set(sistKey, "SINARM")} label="SINARM" />
                    <RadioBtn checked={form[sistKey] === "SIGMA"}  onClick={() => set(sistKey, "SIGMA")}  label="SIGMA"  />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Data Declaração */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">Data da Declaração (Avaliado)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input className="h-9 text-sm w-48" type="date" value={form.dataDecl} onChange={e => set("dataDecl", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Local */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">Local da Prova Prática</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { id: "juliet", label: "Clube de Tiro Juliet Papa" },
              { id: "texas",  label: "Clube de Tiro Texas Gun" },
              { id: "cta",    label: "CTA INDOR Clube de Tiro do Amazonas" },
            ].map(loc => (
              <RadioBtn key={loc.id} checked={form.local === loc.id}
                onClick={() => set("local", loc.id as LaudoForm["local"])} label={loc.label} />
            ))}
          </CardContent>
        </Card>

        {/* Fundamentação */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">Fundamentação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">FINALIDADE</p>
              <div className="flex flex-wrap gap-2">
                <RadioBtn checked={form.finalidade === "aquisicao"} onClick={() => set("finalidade", "aquisicao")} label="Aquisição / Registro / Transferência" />
                <RadioBtn checked={form.finalidade === "porte"}     onClick={() => set("finalidade", "porte")}     label="Porte" />
                <RadioBtn checked={form.finalidade === "cr"}        onClick={() => set("finalidade", "cr")}        label="CR" />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">CATEGORIA</p>
              <div className="flex flex-wrap gap-2">
                <RadioBtn checked={form.categoria === "defesa"}        onClick={() => set("categoria", "defesa")}        label="Defesa Pessoal" />
                <RadioBtn checked={form.categoria === "institucional"} onClick={() => set("categoria", "institucional")} label="Institucional" />
                <RadioBtn checked={form.categoria === "cac"}           onClick={() => set("categoria", "cac")}           label="CAC" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">Notas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nota Teórica</Label>
              <Input className="h-9 text-sm w-32" placeholder="0" value={form.notaTeorica} onChange={e => set("notaTeorica", e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">PONTUAÇÃO NO ALVO SILHUETA</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([["Pistola","notaPistola"],["Revólver","notaRevolver"],["Rifle","notaRifle"],["Espingarda","notaEspingarda"]] as const).map(([lb,k]) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{lb}</Label>
                    <Input className="h-9 text-sm" placeholder="0" value={form[k]} onChange={e => set(k, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conclusão */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">Conclusão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <RadioBtn checked={form.conclusao === "apto"}   onClick={() => set("conclusao", "apto")}   label="✅ APTO" />
              <RadioBtn checked={form.conclusao === "inapto"} onClick={() => set("conclusao", "inapto")} label="❌ INAPTO" />
            </div>
          </CardContent>
        </Card>

        {/* Data Avaliador */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">Data — Manaus/AM (Avaliador)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input className="h-9 text-sm w-48" type="date" value={form.dataFinal} onChange={e => set("dataFinal", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Botão Gerar PDF */}
        <Button size="lg" className="w-full gap-2 h-11"
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
