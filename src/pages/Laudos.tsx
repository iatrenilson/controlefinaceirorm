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
  // Armas usadas
  usouPistola: boolean;    sistPistola: "SINARM" | "SIGMA" | "";
  usouRevolver: boolean;   sistRevolver: "SINARM" | "SIGMA" | "";
  usouRifle: boolean;      sistRifle: "SINARM" | "SIGMA" | "";
  usouEspingarda: boolean; sistEspingarda: "SINARM" | "SIGMA" | "";
  // Data declaração (campo do avaliado)
  dataDecl: string; // yyyy-MM-dd
  // Local de prova
  local: "juliet" | "texas" | "cta" | "";
  // Fundamentação
  finalidade: "aquisicao" | "porte" | "cr" | "";
  categoria: "defesa" | "institucional" | "cac" | "";
  // Notas
  notaTeorica: string;
  notaPistola: string; notaRevolver: string; notaRifle: string; notaEspingarda: string;
  // Conclusão
  conclusao: "apto" | "inapto" | "";
  // Data final (assinatura avaliador)
  dataFinal: string; // yyyy-MM-dd
}

const EMPTY: LaudoForm = {
  numero: "",
  nome: "", cpf: "", endereco: "",
  usouPistola: false,    sistPistola: "",
  usouRevolver: false,   sistRevolver: "",
  usouRifle: false,      sistRifle: "",
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
  if (!iso) return "___/___/______";
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

// ─── PDF Generator ──────────────────────────────────────────────────────────────
async function gerarLaudoPDF(f: LaudoForm) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

  const W = 210, ML = 12, MR = 12, CW = W - ML - MR;
  let y = 8;

  const bold   = (size: number) => { doc.setFont("helvetica", "bold");   doc.setFontSize(size); };
  const normal = (size: number) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); };
  const line   = () => { doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(ML, y, W - MR, y); y += 3; };
  const wrap   = (text: string, x: number, maxW: number, lh: number): number => {
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines, x, y, { maxWidth: maxW }); return y + lines.length * lh;
  };

  const chk  = (ok: boolean) => ok ? "(X)" : "(  )";
  const sq   = (ok: boolean) => ok ? "[X]" : "[  ]";

  // ── CABEÇALHO ──
  bold(8);
  doc.text("ANEXO II", W / 2, y, { align: "center" }); y += 5;

  bold(9);
  const title = `COMPROVANTE DE CAPACIDADE TÉCNICA PARA O MANUSEIO DE ARMA DE FOGO N°${f.numero ? f.numero : "______"}2026`;
  y = wrap(title, W / 2, CW, 4.5) + 1; // centered trick via splitTextToSize
  // Rewrite centered
  const tLines = doc.splitTextToSize(title, CW);
  y -= tLines.length * 4.5 + 1;
  doc.text(tLines, W / 2, y, { align: "center" }); y += tLines.length * 4.5 + 2;

  // Legal
  normal(7);
  const legal = "O comprovante de capacidade técnica de arma de fogo deverá ser expedido por instrutor de armamento e tiro credenciado pela Polícia Federal e deverá atestar, necessariamente: (a) conhecimento da conceituação e normas de segurança pertinentes à arma de fogo; (b) conhecimento básico dos componentes e partes da arma de fogo e (c) habilidade do uso da arma de fogo demonstrada, pelo interessado, em estande de tiro (artigo 4°, inciso III e artigo 12, inciso VI e § 3°, da Lei nº 10.826/03; e artigo 36 do Decreto nº 5.123/04).";
  const lLines = doc.splitTextToSize(legal, CW);
  doc.text(lLines, ML, y); y += lLines.length * 3.2 + 2;

  line();

  // ── DADOS DO AVALIADO ──
  bold(8); doc.text("DADOS DO AVALIADO", ML, y); y += 5;
  normal(8);
  doc.text(`NOME: ${f.nome.toUpperCase()}`, ML, y); y += 5;
  doc.text(`CPF: ${f.cpf}`, ML, y); y += 5;
  doc.text(`ENDEREÇO: ${f.endereco.toUpperCase()}`, ML, y); y += 5;
  line();

  // ── ARMAS DE FOGO ──
  bold(8); doc.text("ARMAS DE FOGO UTILIZADAS", ML, y); y += 5;
  normal(7.5);
  const armas = [
    { tipo: "PISTOLA",    marca: "TAUROS GX4",   calibre: "9 MM",    serie: "ADK 818094",  reg: "905970870", usado: f.usouPistola,    sist: f.sistPistola },
    { tipo: "REVOLVER",   marca: "TAURUS RT 85S", calibre: "38",     serie: "ACL 493291",  reg: "906589762", usado: f.usouRevolver,   sist: f.sistRevolver },
    { tipo: "RIFLE",      marca: "ROSSI",         calibre: "357 MAG", serie: "NWE 4872174", reg: "905938944", usado: f.usouRifle,     sist: f.sistRifle },
    { tipo: "ESPINGARDA", marca: "BOITO",         calibre: "12",      serie: "G11534022",   reg: "905938936", usado: f.usouEspingarda, sist: f.sistEspingarda },
  ];
  for (const a of armas) {
    doc.text(`${sq(a.usado)} TIPO: ${a.tipo}   MARCA: ${a.marca}   CALIBRE: ${a.calibre}`, ML, y); y += 3.8;
    doc.text(`    N° SÉRIE: ${a.serie}   REGISTRO Nº: ${a.reg}   ${chk(a.sist === "SINARM")} SINARM   ${chk(a.sist === "SIGMA")} SIGMA`, ML, y); y += 4.2;
  }
  line();

  // ── DECLARAÇÃO ──
  bold(8); doc.text("DECLARAÇÃO", ML, y); y += 5;
  normal(7.5);
  const nomeDecl = f.nome ? f.nome.toUpperCase() : "_________________________________________________";
  const declText = `${nomeDecl}, acima identificado, DECLARO, sob as penas da lei, que NÃO ME SUBMETI a testes para a aferição de capacidade técnica para o manuseio de armas de fogo nos últimos 30 dias.`;
  const dLines = doc.splitTextToSize(declText, CW);
  doc.text(dLines, ML, y); y += dLines.length * 3.5 + 3;
  doc.text(`Manaus/AM, ${fmtDate(f.dataDecl)}`, ML, y); y += 5;
  doc.text("ASSINATURA DO AVALIADO: _________________________________________________", ML, y); y += 5;
  line();

  // ── LOCAL DE PROVA ──
  bold(8); doc.text("LOCAL DE APLICAÇÃO PROVA PRATICA (ESTANDE)", ML, y); y += 5;
  normal(7.5);
  const locais = [
    { id: "juliet", nome: "Clube de Tiro Juliet Papa",            end: "R. Alm. Maximiano, 8 - Dom Pedro, Manaus/AM." },
    { id: "texas",  nome: "Clube de Tiro Texas Gun",              end: "Av. Compensa, 180B – Vila da Prata, Manaus/AM." },
    { id: "cta",    nome: "CTA INDOR Clube de Tiro do Amazonas",  end: "Av. Pedro Teixeira - Chapada, Manaus/AM." },
  ];
  for (const loc of locais) {
    doc.text(`${chk(f.local === loc.id)} NOME: ${loc.nome}`, ML, y); y += 3.5;
    doc.text(`    ENDEREÇO: ${loc.end}`, ML, y); y += 4;
  }
  line();

  // ── FUNDAMENTAÇÃO ──
  bold(8); doc.text("FUNDAMENTAÇÃO", ML, y); y += 5;
  normal(7.5);
  doc.text(`FINALIDADE: ${chk(f.finalidade === "aquisicao")} AQUISIÇÃO, REGISTRO OU TRANSFERÊNCIA   ${chk(f.finalidade === "porte")} PORTE   ${chk(f.finalidade === "cr")} CR`, ML, y); y += 5;
  doc.text(`CATEGORIA: ${chk(f.categoria === "defesa")} DEFESA PESSOAL   ${chk(f.categoria === "institucional")} INSTITUCIONAL   ${chk(f.categoria === "cac")} CAC`, ML, y); y += 5;
  line();

  // ── NOTAS ──
  normal(8);
  doc.text(`NOTA DA PROVA TEÓRICA: ${f.notaTeorica || "______"}`, ML, y); y += 5;
  doc.text(`PONTUAÇÃO NO ALVO SILHUETA:   PISTOLA: ${f.notaPistola || "___"}   REVOLVER: ${f.notaRevolver || "___"}   RIFLE: ${f.notaRifle || "___"}   ESPINGARDA: ${f.notaEspingarda || "___"}`, ML, y); y += 5;
  line();

  // ── CONCLUSÃO ──
  bold(9); doc.text("CONCLUSÃO", ML, y); y += 6;
  bold(12);
  doc.text(`${sq(f.conclusao === "apto")} APTO`, ML + 25, y);
  doc.text(`${sq(f.conclusao === "inapto")} INAPTO`, ML + 90, y);
  y += 8;
  line();

  // ── AVALIADOR ──
  bold(8); doc.text("AVALIADOR", ML, y); y += 5;
  normal(8);
  doc.text("NOME: William Bruno Toyoda Hitotuzi                      CPF: 733.633.592-68", ML, y); y += 5;
  doc.text("PORTARIA: DREX/SR/PF/AM - N° 01/2025, 14/11/2025         VALIDADE: 31/10/2029", ML, y); y += 8;
  doc.text(`Manaus/AM. ${fmtDate(f.dataFinal)}`, ML, y); y += 12;

  // Assinatura
  doc.line(W / 2 - 38, y, W / 2 + 38, y); y += 4;
  normal(7);
  doc.text("William Bruno Toyoda Hitotuzi", W / 2, y, { align: "center" }); y += 4;
  doc.text("IAT", W / 2, y, { align: "center" });

  // Download
  const blob = doc.output("blob");
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `Laudo CR - ${f.nome ? f.nome.split(" ")[0] : "Laudo"}.pdf`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── UI Helper ─────────────────────────────────────────────────────────────────
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

        {/* Armas utilizadas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">Armas de Fogo Utilizadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {armaRows.map(({ label, usouKey, sistKey }) => (
              <div key={label} className="flex flex-wrap items-center gap-2">
                <CheckBtn
                  checked={form[usouKey] as boolean}
                  onClick={() => set(usouKey, !form[usouKey])}
                  label={label}
                />
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

        {/* Data da Declaração */}
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

        {/* Local de prova */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">Local da Prova Prática (Estande)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { id: "juliet", label: "Clube de Tiro Juliet Papa — R. Alm. Maximiano, 8 - Dom Pedro" },
              { id: "texas",  label: "Clube de Tiro Texas Gun — Av. Compensa, 180B – Vila da Prata" },
              { id: "cta",    label: "CTA INDOR Clube de Tiro do Amazonas — Av. Pedro Teixeira - Chapada" },
            ].map(loc => (
              <RadioBtn
                key={loc.id}
                checked={form.local === loc.id}
                onClick={() => set("local", loc.id as LaudoForm["local"])}
                label={loc.label}
              />
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
                {([["Pistola", "notaPistola"], ["Revólver", "notaRevolver"], ["Rifle", "notaRifle"], ["Espingarda", "notaEspingarda"]] as const).map(([label, key]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input className="h-9 text-sm" placeholder="0" value={form[key]} onChange={e => set(key, e.target.value)} />
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

        {/* Data final */}
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
        <Button
          size="lg"
          className="w-full gap-2 h-11"
          onClick={async () => {
            if (!form.nome || !form.cpf) { toast.error("Preencha Nome e CPF do avaliado."); return; }
            if (!form.conclusao) { toast.error("Selecione APTO ou INAPTO."); return; }
            try {
              await gerarLaudoPDF(form);
              toast.success("Laudo gerado com sucesso!");
            } catch (e) {
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
