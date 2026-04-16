import { useState, useRef } from "react";
import { FileText, Plus, Download, Paperclip, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Declaração de Inquérito ───────────────────────────────────────────────
interface FormData {
  nome: string;
  estadoCivil: string;
  dataNascimento: string;
  nomePai: string;
  nomeMae: string;
  endereco: string;
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
  rg: string;
  orgaoEmissor: string;
  dataExpedicao: string;
  cpf: string;
}

const EMPTY_FORM: FormData = {
  nome: "",
  estadoCivil: "Solteiro(a)",
  dataNascimento: "",
  nomePai: "",
  nomeMae: "",
  endereco: "",
  bairro: "",
  cep: "",
  cidade: "MANAUS",
  estado: "AM",
  rg: "",
  orgaoEmissor: "SSP-AM",
  dataExpedicao: "",
  cpf: "",
};

// ─── Declaração de Acervo ──────────────────────────────────────────────────
interface FormDataAcervo {
  nome: string;
  rg: string;
  orgaoEmissor: string;
  cpf: string;
  nomePai: string;
  nomeMae: string;
  cidade: string;
  estado: string;
}

const EMPTY_FORM_ACERVO: FormDataAcervo = {
  nome: "",
  rg: "",
  orgaoEmissor: "SSP-AM",
  cpf: "",
  nomePai: "",
  nomeMae: "",
  cidade: "Manaus",
  estado: "AM",
};

// ─── Declaração de Residência ──────────────────────────────────────────────
interface FormDataResidencia {
  // Quem assina (declarante)
  nomeDeclarante: string;
  rgDeclarante: string;
  orgaoDeclarante: string;
  cpfDeclarante: string;
  // Quem mora lá (declarado)
  nomeDeclarado: string;
  rgDeclarado: string;
  orgaoDeclarado: string;
  cpfDeclarado: string;
  nomePai: string;
  nomeMae: string;
  // Endereço
  endereco: string;
  cep: string;
  cidade: string;
  estado: string;
}

const EMPTY_FORM_RES: FormDataResidencia = {
  nomeDeclarante: "",
  rgDeclarante: "",
  orgaoDeclarante: "SSP-AM",
  cpfDeclarante: "",
  nomeDeclarado: "",
  rgDeclarado: "",
  orgaoDeclarado: "SSP-AM",
  cpfDeclarado: "",
  nomePai: "",
  nomeMae: "",
  endereco: "",
  cep: "",
  cidade: "Manaus",
  estado: "AM",
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatDate(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function dataExtenso(): string {
  const raw = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  return raw.replace(/\bde ([a-z])/, (_, l) => `de ${l.toUpperCase()}`);
}

function maskCpf(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length > 9) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  if (digits.length > 6) return digits.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
  if (digits.length > 3) return digits.replace(/(\d{3})(\d{1,3})/, "$1.$2");
  return digits;
}

function maskCep(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) return digits.replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2-$3");
  if (digits.length > 2) return digits.replace(/(\d{2})(\d{1,3})/, "$1.$2");
  return digits;
}

function buildAnexos(
  attachments: Array<{ dataUrl: string; label: string }>
): { html: string; pdfJsHead: string; initScript: string } {
  let html = "";
  const pdfRenderCalls: string[] = [];
  let hasPdf = false;
  let counter = 0;

  for (const { dataUrl, label } of attachments) {
    const isPdf = dataUrl.startsWith("data:application/pdf");
    if (isPdf) {
      hasPdf = true;
      const id = `pdf-attach-${++counter}`;
      // Store data URL in a hidden element to avoid huge inline JS strings
      html += `
  <div id="${id}-data" data-url="${encodeURIComponent(dataUrl)}" style="display:none;"></div>
  <div style="page-break-before:always;">
    <p style="font-family:Arial,sans-serif;font-size:10pt;color:#555;margin:0 0 8px 0;">${label}</p>
    <div id="${id}"></div>
  </div>`;
      pdfRenderCalls.push(`renderPdf('${id}-data','${id}')`);
    } else {
      html += `
  <div style="page-break-before:always;text-align:center;">
    <p style="font-family:Arial,sans-serif;font-size:10pt;color:#555;margin:0 0 8px 0;text-align:left;">${label}</p>
    <img src="${dataUrl}" style="max-width:100%;max-height:25cm;object-fit:contain;display:block;margin:0 auto;" />
  </div>`;
    }
  }

  const pdfJsHead = hasPdf
    ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script>`
    : "";

  const initScript = hasPdf
    ? `pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  async function renderPdf(dataId,containerId){
    const dataEl=document.getElementById(dataId);
    const dataUrl=decodeURIComponent(dataEl.getAttribute('data-url'));
    const pdf=await pdfjsLib.getDocument(dataUrl).promise;
    const container=document.getElementById(containerId);
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const vp=page.getViewport({scale:1.8});
      const canvas=document.createElement('canvas');
      canvas.width=vp.width;canvas.height=vp.height;
      canvas.style.cssText='max-width:100%;display:block;margin:0 auto 8px auto;';
      container.appendChild(canvas);
      await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    }
  }
  window.onload=async function(){
    try{await Promise.all([${pdfRenderCalls.map((c) => c).join(",")}]);}catch(e){console.error(e);}
    setTimeout(function(){window.print();},800);
  };`
    : `window.onload=function(){setTimeout(function(){window.print();},400);};`;

  return { html, pdfJsHead, initScript };
}

// ─── PDF: Inquérito Policial ───────────────────────────────────────────────
function gerarPDF(data: FormData) {
  const hoje = format(new Date(), "dd/MM/yyyy");
  const cidadeEstado = `${data.cidade.toUpperCase()}-${data.estado.toUpperCase()}`;
  const primeiroNome = data.nome.trim().split(/\s+/)[0] || "Declaração";

  const bairroStr = data.bairro ? ` - ${data.bairro},` : ",";
  const enderecoCompleto = `${data.endereco}${bairroStr} CEP ${data.cep}, ${data.cidade.toUpperCase()} - ${data.estado.toUpperCase()}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${primeiroNome} - Declaração de não estar respondendo a inquérito policial ou a processo criminal</title>
  <style>
    @page { size: A4 portrait; margin: 2.5cm 2cm 2cm 2cm; }
    html, body { margin:0;padding:0;font-family:"Times New Roman",Times,serif;font-size:12pt;color:#000;background:#fff;line-height:1.5; }
    h1 { text-align:center;font-size:14pt;font-weight:bold;text-transform:uppercase;margin-bottom:1.8em;line-height:1.5; }
    .body-text { text-indent:1.5cm;text-align:justify;line-height:1.6;margin-bottom:1.5em;font-size:12pt; }
    .art-label { font-style:italic;margin-bottom:0.2em;line-height:1.5; }
    .art-dash { font-style:italic;margin-bottom:0.5em;line-height:1.5; }
    .art-body { font-style:italic;text-align:justify;line-height:1.6;margin-bottom:1em; }
    .city-date { text-align:center;margin-top:2em;margin-bottom:3cm;font-size:12pt; }
    .sig-wrap { text-align:center; }
    .sig-line { display:block;width:10cm;margin:0 auto 0.4em auto;border-top:1px solid #000; }
    .sig-name { font-weight:bold;font-size:12pt;text-transform:uppercase;display:block; }
    .sig-cpf { font-size:12pt;display:block; }
    @media print { html,body{margin:0;padding:0;} .no-print{display:none!important;} }
  </style>
</head>
<body>
  <div class="no-print" style="background:#fffbe6;border:1px solid #f0c040;padding:10px 16px;margin-bottom:18px;font-family:sans-serif;font-size:11pt;border-radius:4px;">
    <strong>Antes de imprimir:</strong> Desmarque <b>"Cabeçalhos e rodapés"</b> no diálogo de impressão.
  </div>
  <h1>Declaração de Inexistência de Inquéritos Policiais ou<br>Processos Criminais</h1>
  <p class="body-text">
    Eu, <strong>${data.nome.toUpperCase()}</strong>, abaixo assinado, ${data.estadoCivil}, nascido em ${formatDate(data.dataNascimento)}, filho de
    ${data.nomePai.toUpperCase()} e ${data.nomeMae.toUpperCase()},
    residência no(a), ${enderecoCompleto}, RG
    nº ${data.rg}, ${data.orgaoEmissor.toUpperCase()}, expedido em ${formatDate(data.dataExpedicao)}
    declaro, sob as penas da lei, que não respondo a inquéritos policiais nem a processos criminais, e estou ciente
    de que, em caso de falsidade ideológica, ficarei sujeito às sanções prescritas no Código Penal e às demais
    cominações legais aplicáveis.
  </p>
  <p class="art-label">"Art. 299</p>
  <p class="art-dash">–</p>
  <p class="art-body">
    Omitir, em documento público ou particular, declaração que nele deveria constar, ou nele
    inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de
    prejudicar direito, criar obrigação ou alterar a verdade sobre o fato juridicamente relevante.
  </p>
  <p class="art-body">
    Pena: reclusão de 1 (um) a 5 (cinco) anos e multa, se o documento é público e reclusão de 1
    (um) a 3 (três) anos, se o documento é particular."
  </p>
  <p class="city-date">${cidadeEstado} ${hoje}.</p>
  <div class="sig-wrap">
    <span class="sig-line"></span>
    <span class="sig-name">${data.nome.toUpperCase()}</span>
    <span class="sig-cpf">${data.cpf}</span>
  </div>
  <div style="height:2cm;"></div>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

// ─── PDF: Segundo Endereço de Guarda de Acervo ────────────────────────────
function gerarPDFAcervo(data: FormDataAcervo) {
  const primeiroNome = data.nome.trim().split(/\s+/)[0] || "Declaração";
  const dataEscrita = dataExtenso();
  const cidadeEstado = `${data.cidade}-${data.estado.toUpperCase()}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${primeiroNome} - Declaração de Segundo Endereço de Guarda de Acervo</title>
  <style>
    @page { size:A4 portrait;margin:2.5cm 3cm 2cm 3cm; }
    html,body { margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12pt;color:#000;background:#fff;line-height:1.5; }
    h1 {
      text-align:center;
      font-size:14pt;
      font-weight:bold;
      text-decoration:underline;
      text-transform:uppercase;
      margin-top:0;
      margin-bottom:4em;
      line-height:1.4;
    }
    .body-text {
      text-align:justify;
      line-height:1.5;
      margin-bottom:2em;
      font-size:12pt;
    }
    .verdade {
      text-align:center;
      font-size:12pt;
      line-height:1.5;
      margin-top:0;
      margin-bottom:4cm;
    }
    .city-date {
      text-align:center;
      font-size:12pt;
      line-height:1.5;
      margin-top:0;
      margin-bottom:2.5cm;
    }
    .sig-wrap { text-align:center; }
    .sig-line {
      display:block;
      width:10cm;
      margin:0 auto 0.4em auto;
      border-top:1px solid #000;
    }
    .sig-name {
      font-weight:bold;
      font-size:12pt;
      text-transform:uppercase;
      display:block;
      text-align:center;
    }
    @media print { html,body{margin:0;padding:0;} .no-print{display:none!important;} }
  </style>
</head>
<body>
  <div class="no-print" style="background:#fffbe6;border:1px solid #f0c040;padding:10px 16px;margin-bottom:18px;font-family:sans-serif;font-size:11pt;border-radius:4px;">
    <strong>Antes de imprimir:</strong> Desmarque <b>"Cabeçalhos e rodapés"</b> no diálogo de impressão.
  </div>

  <h1>Declaração de Segundo Endereço de Guarda de Acervo</h1>

  <p class="body-text">
    Eu, <strong>${data.nome.toUpperCase()}</strong>, portador da cédula de <strong>identidade RG: nº
    ${data.rg} / ${data.orgaoEmissor.toUpperCase()}</strong>, CPF nº <strong>${data.cpf}</strong>,
    filho de <strong>${data.nomePai.toUpperCase()}</strong> e <strong>${data.nomeMae.toUpperCase()}</strong>,
    DECLARO que não possuo segundo endereço de guarda de acervo.
  </p>

  <p class="verdade">Por ser verdade, firmo o presente.</p>

  <p class="city-date">${dataEscrita} ${cidadeEstado}</p>

  <div class="sig-wrap">
    <span class="sig-line"></span>
    <span class="sig-name">${data.nome.toUpperCase()}</span>
  </div>

<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

// ─── PDF: Declaração de Residência ────────────────────────────────────────
function gerarPDFResidencia(
  data: FormDataResidencia,
  rgDataUrl: string | null,
  compDataUrl: string | null
) {
  const primeiroNome = data.nomeDeclarante.trim().split(/\s+/)[0] || "Declaração";
  const dataEscrita = dataExtenso();
  const endFormatado = `${data.endereco.toUpperCase()}, Cep: ${data.cep} – ${data.cidade.toUpperCase()}-${data.estado.toUpperCase()}`;

  const attachmentList: Array<{ dataUrl: string; label: string }> = [];
  if (rgDataUrl) attachmentList.push({ dataUrl: rgDataUrl, label: "Anexo: Documento de Identidade (RG)" });
  if (compDataUrl) attachmentList.push({ dataUrl: compDataUrl, label: "Anexo: Comprovante de Residência" });
  const { html: anexos, pdfJsHead, initScript } = buildAnexos(attachmentList);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${primeiroNome} - Declaração de Residência</title>
  ${pdfJsHead}
  <style>
    @page { size:A4 portrait;margin:2.5cm 3cm 2cm 3cm; }
    html,body { margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12pt;color:#000;background:#fff;line-height:1.5; }
    h1 { text-align:center;font-size:14pt;font-weight:bold;text-decoration:underline;text-transform:uppercase;margin-top:0;margin-bottom:4em;line-height:1.4; }
    .body-text { text-align:justify;line-height:1.5;margin-bottom:3em;font-size:12pt; }
    .declaro-ainda { text-align:justify;line-height:1.5;margin-bottom:1.5em;font-size:12pt; }
    .art-block { margin-left:2cm;margin-bottom:0; }
    .art-text { font-style:italic;text-align:justify;line-height:1.5;font-size:12pt;margin:0; }
    .pena-text { font-style:italic;text-align:justify;line-height:1.5;font-size:12pt;margin-top:0.8em;margin-bottom:0; }
    .city-date { text-align:left;margin-top:4cm;margin-bottom:3cm;font-size:12pt; }
    .sig-wrap { text-align:center; }
    .sig-dots { display:block;font-size:12pt;letter-spacing:1px;margin-bottom:0.3em; }
    .sig-name { font-weight:bold;font-size:12pt;text-transform:uppercase;display:block;text-align:center; }
    @media print { html,body{margin:0;padding:0;} .no-print{display:none!important;} }
  </style>
</head>
<body>
  <div class="no-print" style="background:#fffbe6;border:1px solid #f0c040;padding:10px 16px;margin-bottom:18px;font-family:sans-serif;font-size:11pt;border-radius:4px;">
    <strong>Antes de imprimir:</strong> Desmarque <b>"Cabeçalhos e rodapés"</b> no diálogo de impressão.
  </div>

  <h1>Declaração de Residência</h1>

  <p class="body-text">
    <strong>${data.nomeDeclarante.toUpperCase()}</strong>, RG nº <strong>${data.rgDeclarante}/${data.orgaoDeclarante.toUpperCase()}</strong>,
    CPF nº <strong>${data.cpfDeclarante}</strong>,
    <strong>DECLARO</strong> para fins de comprovação de residência, sob as penas da lei (art. 2°da lei 7.115/83)
    que o Sr.(a) <strong>${data.nomeDeclarado.toUpperCase()}</strong>, portador da cédula de identidade (RG)
    nº <strong>${data.rgDeclarado} - ${data.orgaoDeclarado.toUpperCase()}</strong>, CPF nº <strong>${data.cpfDeclarado}</strong>,
    filho de <strong>${data.nomePai.toUpperCase()}</strong> e <strong>${data.nomeMae.toUpperCase()}</strong>,
    é residente e domiciliada na <strong>${endFormatado}</strong>
  </p>

  <p class="declaro-ainda">
    Declaro ainda, está ciente de que a declaração falsa pode implicar na sanção
    penal prevista no art. 299 do código penal, <em>in verbis</em>:
  </p>

  <div class="art-block">
    <p class="art-text">
      Art. 299 – Omitir, em documento público ou particular, declaração
      que nela deveria constar, ou nele inserir ou fazer inserir declaração falsa ou
      diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação
      ou alterar a verdade sobre o fato juridicamente relevante.
    </p>
    <p class="pena-text">
      Pena: reclusão de 1 (um) a 5 (cinco) anos e multa, se o documento é público e
      reclusão de 1 (um) a 3 (três) anos, se o documento é particular.
    </p>
  </div>

  <p class="city-date">${data.cidade}, ${dataEscrita}.</p>

  <div class="sig-wrap">
    <span class="sig-dots">................................................................................</span>
    <span class="sig-name">${data.nomeDeclarante.toUpperCase()}</span>
  </div>

  ${anexos}

<script>${initScript}<\/script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function Declaracoes() {
  // Diálogo 1 — Inquérito Policial
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  // Diálogo 2 — Segundo Endereço de Acervo
  const [dialogAcervoOpen, setDialogAcervoOpen] = useState(false);
  const [formAcervo, setFormAcervo] = useState<FormDataAcervo>(EMPTY_FORM_ACERVO);

  // Diálogo 3 — Declaração de Residência
  const [dialogResOpen, setDialogResOpen] = useState(false);
  const [formRes, setFormRes] = useState<FormDataResidencia>(EMPTY_FORM_RES);
  const [rgDataUrl, setRgDataUrl] = useState<string | null>(null);
  const [rgNome, setRgNome] = useState<string>("");
  const [compDataUrl, setCompDataUrl] = useState<string | null>(null);
  const [compNome, setCompNome] = useState<string>("");
  const rgInputRef = useRef<HTMLInputElement>(null);
  const compInputRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const setA = (field: keyof FormDataAcervo, value: string) =>
    setFormAcervo((prev) => ({ ...prev, [field]: value }));

  const setR = (field: keyof FormDataResidencia, value: string) =>
    setFormRes((prev) => ({ ...prev, [field]: value }));

  const handleFileRead = (
    e: React.ChangeEvent<HTMLInputElement>,
    setUrl: (v: string | null) => void,
    setName: (v: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearRg = () => { setRgDataUrl(null); setRgNome(""); if (rgInputRef.current) rgInputRef.current.value = ""; };
  const clearComp = () => { setCompDataUrl(null); setCompNome(""); if (compInputRef.current) compInputRef.current.value = ""; };

  const handleGerar = () => {
    if (!form.nome || !form.dataNascimento || !form.rg) {
      alert("Preencha pelo menos Nome, Data de Nascimento e RG.");
      return;
    }
    gerarPDF(form);
  };

  const handleGerarAcervo = () => {
    if (!formAcervo.nome || !formAcervo.rg || !formAcervo.cpf) {
      alert("Preencha pelo menos Nome, RG e CPF.");
      return;
    }
    gerarPDFAcervo(formAcervo);
  };

  const handleGerarResidencia = () => {
    if (!formRes.nomeDeclarante || !formRes.nomeDeclarado || !formRes.endereco) {
      alert("Preencha pelo menos Nome do Declarante, Nome do Declarado e Endereço.");
      return;
    }
    gerarPDFResidencia(formRes, rgDataUrl, compDataUrl);
  };

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

        {/* Action card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Criar Nova Declaração
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => { setForm(EMPTY_FORM); setDialogOpen(true); }} className="gap-2 w-fit">
              <Plus className="h-4 w-4" />
              Declaração de Não Estar Respondendo a Inquérito Policial
            </Button>
            <Button variant="outline" onClick={() => { setFormAcervo(EMPTY_FORM_ACERVO); setDialogAcervoOpen(true); }} className="gap-2 w-fit">
              <Plus className="h-4 w-4" />
              Declaração de Segundo Endereço de Guarda de Acervo
            </Button>
            <Button variant="outline" onClick={() => { setFormRes(EMPTY_FORM_RES); clearRg(); clearComp(); setDialogResOpen(true); }} className="gap-2 w-fit">
              <Plus className="h-4 w-4" />
              Declaração de Residência
            </Button>
          </CardContent>
        </Card>
      </div>

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
            <div className="space-y-1">
              <Label className="text-xs">Nome Completo</Label>
              <Input className="h-9 text-sm uppercase" placeholder="Nome completo do declarante"
                value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Estado Civil</Label>
                <Select value={form.estadoCivil} onValueChange={(v) => set("estadoCivil", v)}>
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
                <Input className="h-9 text-sm" type="date"
                  value={form.dataNascimento} onChange={(e) => set("dataNascimento", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Pai</Label>
                <Input className="h-9 text-sm uppercase" placeholder="Nome do pai"
                  value={form.nomePai} onChange={(e) => set("nomePai", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome da Mãe</Label>
                <Input className="h-9 text-sm uppercase" placeholder="Nome da mãe"
                  value={form.nomeMae} onChange={(e) => set("nomeMae", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Endereço (Rua/Beco, número)</Label>
              <Input className="h-9 text-sm" placeholder="Ex: Beco São Francisco, 58"
                value={form.endereco}
                onChange={(e) => { const v = e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()); set("endereco", v); }} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input className="h-9 text-sm" placeholder="Bairro"
                  value={form.bairro}
                  onChange={(e) => { const v = e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()); set("bairro", v); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CEP</Label>
                <Input className="h-9 text-sm font-mono" placeholder="00.000-000"
                  value={form.cep} onChange={(e) => set("cep", maskCep(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input className="h-9 text-sm" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Número do RG</Label>
                <Input className="h-9 text-sm font-mono" placeholder="00000000"
                  value={form.rg} onChange={(e) => set("rg", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Órgão Emissor</Label>
                <Input className="h-9 text-sm uppercase" placeholder="SSP-AM"
                  value={form.orgaoEmissor} onChange={(e) => set("orgaoEmissor", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de Expedição</Label>
                <Input className="h-9 text-sm" type="date"
                  value={form.dataExpedicao} onChange={(e) => set("dataExpedicao", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF (para linha de assinatura)</Label>
              <Input className="h-9 text-sm font-mono" placeholder="000.000.000-00"
                value={form.cpf} onChange={(e) => set("cpf", maskCpf(e.target.value))} />
            </div>
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
              A data da declaração será preenchida automaticamente com a data de hoje ({format(new Date(), "dd/MM/yyyy")}).
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleGerar}>
              <Download className="h-3.5 w-3.5" />Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 2: Segundo Endereço de Acervo ── */}
      <Dialog open={dialogAcervoOpen} onOpenChange={setDialogAcervoOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Declaração de Segundo Endereço de Guarda de Acervo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nome Completo</Label>
              <Input className="h-9 text-sm uppercase" placeholder="Nome completo do declarante"
                value={formAcervo.nome} onChange={(e) => setA("nome", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Número do RG</Label>
                <Input className="h-9 text-sm font-mono" placeholder="00000000"
                  value={formAcervo.rg} onChange={(e) => setA("rg", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Órgão Emissor</Label>
                <Input className="h-9 text-sm uppercase" placeholder="SSP-AM"
                  value={formAcervo.orgaoEmissor} onChange={(e) => setA("orgaoEmissor", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF</Label>
              <Input className="h-9 text-sm font-mono" placeholder="000.000.000-00"
                value={formAcervo.cpf} onChange={(e) => setA("cpf", maskCpf(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Pai</Label>
                <Input className="h-9 text-sm uppercase" placeholder="Nome do pai"
                  value={formAcervo.nomePai} onChange={(e) => setA("nomePai", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome da Mãe</Label>
                <Input className="h-9 text-sm uppercase" placeholder="Nome da mãe"
                  value={formAcervo.nomeMae} onChange={(e) => setA("nomeMae", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input className="h-9 text-sm" value={formAcervo.cidade} onChange={(e) => setA("cidade", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado (sigla)</Label>
                <Input className="h-9 text-sm uppercase" placeholder="AM"
                  value={formAcervo.estado} onChange={(e) => setA("estado", e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
              Data gerada automaticamente por extenso ({dataExtenso()}).
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogAcervoOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleGerarAcervo}>
              <Download className="h-3.5 w-3.5" />Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 3: Declaração de Residência ── */}
      <Dialog open={dialogResOpen} onOpenChange={setDialogResOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Declaração de Residência
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Declarante */}
            <div>
              <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Declarante (quem assina)</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome Completo</Label>
                  <Input className="h-9 text-sm uppercase" placeholder="Nome de quem assina a declaração"
                    value={formRes.nomeDeclarante} onChange={(e) => setR("nomeDeclarante", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">RG</Label>
                    <Input className="h-9 text-sm font-mono" placeholder="00000000"
                      value={formRes.rgDeclarante} onChange={(e) => setR("rgDeclarante", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Órgão Emissor</Label>
                    <Input className="h-9 text-sm uppercase" placeholder="SSP-AM"
                      value={formRes.orgaoDeclarante} onChange={(e) => setR("orgaoDeclarante", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CPF</Label>
                    <Input className="h-9 text-sm font-mono" placeholder="000.000.000-00"
                      value={formRes.cpfDeclarante} onChange={(e) => setR("cpfDeclarante", maskCpf(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border/50" />

            {/* Declarado */}
            <div>
              <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Declarado (quem reside no endereço)</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome Completo</Label>
                  <Input className="h-9 text-sm uppercase" placeholder="Nome de quem reside no endereço"
                    value={formRes.nomeDeclarado} onChange={(e) => setR("nomeDeclarado", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">RG</Label>
                    <Input className="h-9 text-sm font-mono" placeholder="00000000"
                      value={formRes.rgDeclarado} onChange={(e) => setR("rgDeclarado", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Órgão Emissor</Label>
                    <Input className="h-9 text-sm uppercase" placeholder="SSP-AM"
                      value={formRes.orgaoDeclarado} onChange={(e) => setR("orgaoDeclarado", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CPF</Label>
                    <Input className="h-9 text-sm font-mono" placeholder="000.000.000-00"
                      value={formRes.cpfDeclarado} onChange={(e) => setR("cpfDeclarado", maskCpf(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do Pai</Label>
                    <Input className="h-9 text-sm uppercase" placeholder="Nome do pai"
                      value={formRes.nomePai} onChange={(e) => setR("nomePai", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nome da Mãe</Label>
                    <Input className="h-9 text-sm uppercase" placeholder="Nome da mãe"
                      value={formRes.nomeMae} onChange={(e) => setR("nomeMae", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border/50" />

            {/* Endereço */}
            <div>
              <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Endereço</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Endereço completo (Rua, número)</Label>
                  <Input className="h-9 text-sm" placeholder="Ex: Rua RM da Chisa, S/N"
                    value={formRes.endereco}
                    onChange={(e) => { const v = e.target.value.replace(/\b\w/g, (c) => c.toUpperCase()); setR("endereco", v); }} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">CEP</Label>
                    <Input className="h-9 text-sm font-mono" placeholder="00.000-000"
                      value={formRes.cep} onChange={(e) => setR("cep", maskCep(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cidade</Label>
                    <Input className="h-9 text-sm" value={formRes.cidade} onChange={(e) => setR("cidade", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estado</Label>
                    <Input className="h-9 text-sm uppercase" placeholder="AM"
                      value={formRes.estado} onChange={(e) => setR("estado", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border/50" />

            {/* Anexos */}
            <div>
              <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Anexos (opcional)</p>
              <div className="space-y-3">
                {/* RG */}
                <div className="space-y-1">
                  <Label className="text-xs">RG (imagem ou PDF)</Label>
                  {rgDataUrl ? (
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/30 text-sm">
                      <Paperclip className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="truncate flex-1 text-xs">{rgNome}</span>
                      <button onClick={clearRg} className="flex-shrink-0 text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={rgInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => handleFileRead(e, setRgDataUrl, setRgNome)}
                      />
                      <Button type="button" variant="outline" size="sm" className="h-9 text-xs gap-1.5 w-full justify-start"
                        onClick={() => rgInputRef.current?.click()}>
                        <Paperclip className="h-3.5 w-3.5" />
                        Anexar RG
                      </Button>
                    </div>
                  )}
                </div>

                {/* Comprovante */}
                <div className="space-y-1">
                  <Label className="text-xs">Comprovante de Residência (imagem ou PDF)</Label>
                  {compDataUrl ? (
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/30 text-sm">
                      <Paperclip className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="truncate flex-1 text-xs">{compNome}</span>
                      <button onClick={clearComp} className="flex-shrink-0 text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={compInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => handleFileRead(e, setCompDataUrl, setCompNome)}
                      />
                      <Button type="button" variant="outline" size="sm" className="h-9 text-xs gap-1.5 w-full justify-start"
                        onClick={() => compInputRef.current?.click()}>
                        <Paperclip className="h-3.5 w-3.5" />
                        Anexar Comprovante de Residência
                      </Button>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
                  Os anexos serão impressos em páginas separadas após a declaração. Data gerada automaticamente ({dataExtenso()}).
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogResOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleGerarResidencia}>
              <Download className="h-3.5 w-3.5" />Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
