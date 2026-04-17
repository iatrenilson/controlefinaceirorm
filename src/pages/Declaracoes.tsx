import { useState, useRef, useEffect } from "react";
import { FileText, Plus, Download, Paperclip, X, UserPlus, Users, Pencil, Trash2, ChevronDown, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Cliente ───────────────────────────────────────────────────────────────
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
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
  senhaGov: string;
}

type ClienteForm = Omit<Cliente, "id">;

const EMPTY_CLIENTE: ClienteForm = {
  nome: "", rg: "", orgaoEmissor: "SSP-AM", dataExpedicao: "",
  cpf: "", nomePai: "", nomeMae: "", estadoCivil: "Solteiro(a)",
  dataNascimento: "", endereco: "", numero: "", bairro: "", cep: "", cidade: "Manaus", estado: "AM",
  senhaGov: "",
};

// ─── Declaração de Inquérito ───────────────────────────────────────────────
interface FormData {
  nome: string; estadoCivil: string; dataNascimento: string;
  nomePai: string; nomeMae: string; endereco: string; numero: string; bairro: string;
  cep: string; cidade: string; estado: string; rg: string;
  orgaoEmissor: string; dataExpedicao: string; cpf: string;
}
const EMPTY_FORM: FormData = {
  nome: "", estadoCivil: "Solteiro(a)", dataNascimento: "", nomePai: "", nomeMae: "",
  endereco: "", numero: "", bairro: "", cep: "", cidade: "MANAUS", estado: "AM",
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

// ─── Declaração de Residência ──────────────────────────────────────────────
interface FormDataResidencia {
  nomeDeclarante: string; rgDeclarante: string; orgaoDeclarante: string; cpfDeclarante: string;
  nomeDeclarado: string; rgDeclarado: string; orgaoDeclarado: string; cpfDeclarado: string;
  nomePai: string; nomeMae: string; endereco: string; numero: string; cep: string; cidade: string; estado: string;
}
const EMPTY_FORM_RES: FormDataResidencia = {
  nomeDeclarante: "", rgDeclarante: "", orgaoDeclarante: "SSP-AM", cpfDeclarante: "",
  nomeDeclarado: "", rgDeclarado: "", orgaoDeclarado: "SSP-AM", cpfDeclarado: "",
  nomePai: "", nomeMae: "", endereco: "", numero: "", cep: "", cidade: "Manaus", estado: "AM",
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

// ─── Attachment builder ───────────────────────────────────────────────────
function buildAnexos(attachments: Array<{ dataUrl: string; label: string }>): {
  html: string; pdfJsHead: string; initScript: string;
} {
  let html = "";
  const pdfRenderCalls: string[] = [];
  let hasPdf = false;
  let counter = 0;
  for (const { dataUrl, label } of attachments) {
    const isPdf = dataUrl.startsWith("data:application/pdf");
    if (isPdf) {
      hasPdf = true;
      const id = `pdf-attach-${++counter}`;
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
    ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script>` : "";
  const initScript = hasPdf
    ? `pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  async function renderPdf(dataId,containerId){
    const el=document.getElementById(dataId);
    const url=decodeURIComponent(el.getAttribute('data-url'));
    const pdf=await pdfjsLib.getDocument(url).promise;
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
    try{await Promise.all([${pdfRenderCalls.join(",")}]);}catch(e){console.error(e);}
    setTimeout(function(){window.print();},800);
  };`
    : `window.onload=function(){setTimeout(function(){window.print();},400);};`;
  return { html, pdfJsHead, initScript };
}

// ─── PDF generators ───────────────────────────────────────────────────────
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

function gerarPDF(data: FormData) {
  const hoje = format(new Date(), "dd/MM/yyyy");
  const cidadeEstado = `${data.cidade.toUpperCase()} - ${data.estado.toUpperCase()}`;
  const primeiroNome = capitalize(data.nome.trim().split(/\s+/)[0] || "Declaração");
  const numStr = data.numero ? `, Nº ${data.numero}` : "";
  const bairroStr = data.bairro ? ` - ${data.bairro.toUpperCase()},` : ",";
  const enderecoCompleto = `${data.endereco}${numStr}${bairroStr} CEP ${data.cep}, ${data.cidade.toUpperCase()} - ${data.estado.toUpperCase()}`;
  const pai = data.nomePai?.trim() ? data.nomePai.toUpperCase() : "";
  const mae = data.nomeMae?.trim() ? data.nomeMae.toUpperCase() : "";
  const filhoDe = pai && mae ? `${pai} e ${mae}` : pai || mae;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
  <title>${primeiroNome} - Declaração de Inexistência de Inquéritos Policiais ou Processos Criminais</title>
  <style>
    @page{size:A4 portrait;margin:1cm 1cm 2cm 1cm;}
    html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12pt;color:#000;background:#fff;line-height:1.15;}
    h1{text-align:center;font-size:14pt;font-weight:bold;margin-top:0;margin-bottom:0.6em;line-height:1.15;}
    .body-text{text-align:justify;line-height:1.15;margin-top:0;margin-bottom:0.6em;font-size:12pt;}
    .art-text{text-align:justify;line-height:1.15;margin-top:0;margin-bottom:0.6em;font-size:12pt;}
    .validade{text-align:left;line-height:1.15;margin-top:0;margin-bottom:0;font-size:12pt;}
    .city-date{text-align:center;margin-top:1.5em;margin-bottom:4cm;font-size:12pt;}
    .sig-wrap{text-align:center;}
    .sig-line{display:block;width:8cm;margin:0 auto 0.4em auto;border-top:1px solid #000;}
    .sig-name{font-weight:normal;font-size:12pt;text-transform:uppercase;display:block;text-align:center;}
    .sig-cpf{font-size:12pt;display:block;text-align:center;}
    @media print{html,body{margin:0;padding:0;}}
  </style></head><body>
  <h1>DECLARAÇÃO DE INEXISTÊNCIA DE INQUÉRITOS POLICIAIS OU<br>PROCESSOS CRIMINAIS</h1>
  <p class="body-text">Eu, <strong>${data.nome.toUpperCase()}</strong>, abaixo assinado, ${data.estadoCivil}, nascido em ${formatDate(data.dataNascimento)}, filho de
    ${filhoDe}, residência no(a), ${enderecoCompleto}, RG
    nº ${data.rg}, expedido em ${formatDate(data.dataExpedicao)}, declaro, sob as penas da lei, que não respondo a inquéritos policiais nem a processos criminais, e estou ciente de que, em caso de falsidade ideológica, ficarei sujeito às sanções prescritas no Código Penal e às demais cominações legais aplicáveis.</p>
  <p class="art-text">Art. 299 - Omitir, em documento público ou particular, declaração que nele deveria constar, ou nele inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sobre o fato juridicamente relevante. Pena - reclusão de 1 (um) a 5 (cinco) anos e multa, se o documento é público e reclusão de 1 (um) a 3 (três) anos, se o documento é particular.</p>
  <p class="validade">Esta declaração tem validade de <strong>90</strong> dias.</p>
  <p class="city-date">${cidadeEstado}, ${hoje}</p>
  <div class="sig-wrap">
    <span class="sig-line"></span>
    <span class="sig-name">${data.nome.toUpperCase()}</span>
    <span class="sig-cpf">${data.cpf}</span>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script></body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

function gerarPDFAcervo(data: FormDataAcervo) {
  const primeiroNome = capitalize(data.nome.trim().split(/\s+/)[0] || "Declaração");
  const dataEscrita = dataExtenso();
  const cidadeEstado = `${data.cidade}-${data.estado.toUpperCase()}`;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
  <title>${primeiroNome} - Declaração de Segundo Endereço de Guarda de Acervo</title>
  <style>@page{size:A4 portrait;margin:2.5cm 3cm 2cm 3cm;}html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12pt;color:#000;background:#fff;line-height:1.5;}
  h1{text-align:center;font-size:14pt;font-weight:bold;text-decoration:underline;text-transform:uppercase;margin-top:0;margin-bottom:4em;line-height:1.4;}
  .body-text{text-align:justify;line-height:1.5;margin-bottom:2em;font-size:12pt;}
  .verdade{text-align:center;font-size:12pt;line-height:1.5;margin-top:0;margin-bottom:4cm;}
  .city-date{text-align:center;font-size:12pt;line-height:1.5;margin-top:0;margin-bottom:2.5cm;}
  .sig-wrap{text-align:center;}.sig-line{display:block;width:10cm;margin:0 auto 0.4em auto;border-top:1px solid #000;}
  .sig-name{font-weight:bold;font-size:12pt;text-transform:uppercase;display:block;text-align:center;}
  @media print{html,body{margin:0;padding:0;}}</style></head><body>
  <h1>Declaração de Segundo Endereço de Guarda de Acervo</h1>
  <p class="body-text">Eu, <strong>${data.nome.toUpperCase()}</strong>, portador da cédula de <strong>identidade RG: nº
    ${data.rg} / ${data.orgaoEmissor.toUpperCase()}</strong>, CPF nº <strong>${data.cpf}</strong>,
    filho de <strong>${data.nomePai.toUpperCase()}</strong> e <strong>${data.nomeMae.toUpperCase()}</strong>,
    DECLARO que não possuo segundo endereço de guarda de acervo.</p>
  <p class="verdade">Por ser verdade, firmo o presente.</p>
  <p class="city-date">${dataEscrita} ${cidadeEstado}</p>
  <div class="sig-wrap"><span class="sig-line"></span><span class="sig-name">${data.nome.toUpperCase()}</span></div>
  <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script></body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

function gerarPDFResidencia(data: FormDataResidencia, rgDataUrl: string | null, compDataUrl: string | null) {
  const primeiroNome = capitalize(data.nomeDeclarante.trim().split(/\s+/)[0] || "Declaração");
  const dataEscrita = dataExtenso();
  const numResStr = data.numero ? `, Nº ${data.numero}` : "";
  const endFormatado = `${data.endereco.toUpperCase()}${numResStr}, Cep: ${data.cep} – ${data.cidade.toUpperCase()}-${data.estado.toUpperCase()}`;
  const attachmentList: Array<{ dataUrl: string; label: string }> = [];
  if (rgDataUrl) attachmentList.push({ dataUrl: rgDataUrl, label: "Anexo: Documento de Identidade (RG)" });
  if (compDataUrl) attachmentList.push({ dataUrl: compDataUrl, label: "Anexo: Comprovante de Residência" });
  const { html: anexos, pdfJsHead, initScript } = buildAnexos(attachmentList);
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
  <title>${primeiroNome} - Declaração de Residência</title>
  ${pdfJsHead}
  <style>
    @page{size:A4 portrait;margin:2.5cm 3cm 2cm 3cm;}
    html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12pt;color:#000;background:#fff;line-height:1.5;}
    h1{text-align:center;font-size:14pt;font-weight:bold;text-decoration:underline;text-transform:uppercase;margin-top:0;margin-bottom:3.5em;line-height:1.4;}
    .body-text{text-align:justify;line-height:1.6;margin-top:0;margin-bottom:0.3em;font-size:12pt;}
    .declaro-ainda{text-align:left;line-height:1.5;margin-top:0;margin-bottom:2em;font-size:12pt;}
    .art-block{margin-bottom:0.8em;}
    .art-text{font-style:italic;text-align:justify;line-height:1.5;font-size:12pt;margin:0;text-indent:2cm;}
    .pena-text{font-style:italic;text-align:justify;line-height:1.5;font-size:12pt;margin:0.5em 0 0 0;text-indent:0;}
    .city-date{text-align:left;margin-top:3cm;margin-bottom:4cm;font-size:12pt;}
    .sig-wrap{text-align:center;}
    .sig-line{display:block;width:10cm;margin:0 auto 0.4em auto;border-top:1px solid #000;}
    .sig-name{font-weight:bold;font-size:12pt;text-transform:uppercase;display:block;text-align:center;}
    @media print{html,body{margin:0;padding:0;}}
  </style></head><body>
  <h1>Declaração de Residência</h1>
  <p class="body-text"><strong>${data.nomeDeclarante.toUpperCase()}</strong>, RG nº <strong>${data.rgDeclarante}/${data.orgaoDeclarante.toUpperCase()}</strong>,
    CPF nº <strong>${data.cpfDeclarante}</strong>, <strong>DECLARO</strong> para fins de comprovação de residência, sob as penas da lei (art. 2°da lei 7.115/83)
    que o Sr.(a) <strong>${data.nomeDeclarado.toUpperCase()}</strong>, portador da cédula de identidade (RG)
    nº <strong>${data.rgDeclarado} - ${data.orgaoDeclarado.toUpperCase()}</strong>, CPF nº <strong>${data.cpfDeclarado}</strong>,
    filho de <strong>${data.nomePai.toUpperCase()}</strong> e <strong>${data.nomeMae.toUpperCase()}</strong>,
    é residente e domiciliada na <strong>${endFormatado}</strong></p>
  <p class="declaro-ainda">Declaro ainda, está ciente de que a declaração falsa pode implicar na sanção penal prevista no art. 299 do código penal, <em>in verbis</em>:</p>
  <div class="art-block">
    <p class="art-text">Art. 299 – Omitir, em documento público ou particular, declaração que nela deveria constar, ou nele inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sobre o fato juridicamente relevante.</p>
  </div>
  <p class="pena-text">Pena: reclusão de 1 (um) a 5 (cinco) anos e multa, se o documento é público e reclusão de 1 (um) a 3 (três) anos, se o documento é particular.</p>
  <p class="city-date">${data.cidade}, ${dataEscrita}.</p>
  <div class="sig-wrap"><span class="sig-line"></span><span class="sig-name">${data.nomeDeclarante.toUpperCase()}</span></div>
  ${anexos}
  <script>${initScript}<\/script></body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
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

// ─── Componente principal ──────────────────────────────────────────────────
export default function Declaracoes() {
  // Clientes cadastrados
  const [clientes, setClientes] = useState<Cliente[]>(() => {
    try { return JSON.parse(localStorage.getItem("decl_clientes") || "[]"); }
    catch { return []; }
  });
  const [dialogClienteOpen, setDialogClienteOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formCliente, setFormCliente] = useState<ClienteForm>(EMPTY_CLIENTE);

  useEffect(() => {
    localStorage.setItem("decl_clientes", JSON.stringify(clientes));
  }, [clientes]);

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
  const salvarCliente = () => {
    if (!formCliente.nome) { alert("Preencha o Nome."); return; }
    if (editandoId) {
      setClientes(prev => prev.map(c => c.id === editandoId ? { id: editandoId, ...formCliente } : c));
    } else {
      setClientes(prev => [...prev, { id: Date.now().toString(), ...formCliente }]);
    }
    setDialogClienteOpen(false);
  };
  const excluirCliente = (id: string) => {
    if (!confirm("Excluir este cliente?")) return;
    setClientes(prev => prev.filter(c => c.id !== id));
  };

  // Diálogo 1 — Inquérito
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const set = (field: keyof FormData, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  // Diálogo 2 — Acervo
  const [dialogAcervoOpen, setDialogAcervoOpen] = useState(false);
  const [formAcervo, setFormAcervo] = useState<FormDataAcervo>(EMPTY_FORM_ACERVO);
  const setA = (field: keyof FormDataAcervo, value: string) => setFormAcervo(prev => ({ ...prev, [field]: value }));

  // Diálogo 3 — Residência
  const [dialogResOpen, setDialogResOpen] = useState(false);
  const [formRes, setFormRes] = useState<FormDataResidencia>(EMPTY_FORM_RES);
  const setR = (field: keyof FormDataResidencia, value: string) => setFormRes(prev => ({ ...prev, [field]: value }));
  const [rgDataUrl, setRgDataUrl] = useState<string | null>(null);
  const [rgNome, setRgNome] = useState("");
  const [compDataUrl, setCompDataUrl] = useState<string | null>(null);
  const [compNome, setCompNome] = useState("");
  const rgInputRef = useRef<HTMLInputElement>(null);
  const compInputRef = useRef<HTMLInputElement>(null);

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>, setUrl: (v: string | null) => void, setName: (v: string) => void) => {
    const file = e.target.files?.[0]; if (!file) return;
    setName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };
  const clearRg = () => { setRgDataUrl(null); setRgNome(""); if (rgInputRef.current) rgInputRef.current.value = ""; };
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
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />Clientes Cadastrados
              {clientes.length > 0 && (
                <span className="ml-1 text-xs font-normal bg-primary/10 text-primary rounded-full px-2 py-0.5">{clientes.length}</span>
              )}
            </CardTitle>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={abrirNovoCliente}>
              <UserPlus className="h-3.5 w-3.5" />Cadastrar Cliente
            </Button>
          </CardHeader>
          <CardContent>
            {clientes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum cliente cadastrado. Cadastre clientes para preencher declarações automaticamente.
              </p>
            ) : (
              <div className="divide-y divide-border/50">
                {clientes.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2.5 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate uppercase">{c.nome}</p>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {c.cpf && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">CPF: <span className="font-mono">{c.cpf}</span></span>
                            <CopyButton value={c.cpf} />
                          </div>
                        )}
                        {c.senhaGov && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Senha GOV: <span className="font-mono">{c.senhaGov}</span></span>
                            <CopyButton value={c.senhaGov} />
                          </div>
                        )}
                        {c.rg && (
                          <span className="text-xs text-muted-foreground">RG: <span className="font-mono">{c.rg}</span></span>
                        )}
                      </div>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Declarações */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />Criar Nova Declaração
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button variant="outline" onClick={() => { setForm(EMPTY_FORM); setDialogOpen(true); }} className="gap-2 w-fit">
              <Plus className="h-4 w-4" />Declaração de Não Estar Respondendo a Inquérito Policial
            </Button>
            <Button variant="outline" onClick={() => { setFormAcervo(EMPTY_FORM_ACERVO); setDialogAcervoOpen(true); }} className="gap-2 w-fit">
              <Plus className="h-4 w-4" />Declaração de Segundo Endereço de Guarda de Acervo
            </Button>
            <Button variant="outline" onClick={() => { setFormRes(EMPTY_FORM_RES); clearRg(); clearComp(); setDialogResOpen(true); }} className="gap-2 w-fit">
              <Plus className="h-4 w-4" />Declaração de Residência
            </Button>
          </CardContent>
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
              <Input className="h-9 text-sm uppercase" placeholder="Nome completo"
                value={formCliente.nome} onChange={e => setC("nome", e.target.value.toUpperCase())} />
            </div>
            {/* CPF + RG */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <Input className="h-9 text-sm font-mono" placeholder="000.000.000-00"
                  value={formCliente.cpf} onChange={e => setC("cpf", maskCpf(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">RG</Label>
                <Input className="h-9 text-sm font-mono" placeholder="0000000-0"
                  value={formCliente.rg} onChange={e => setC("rg", maskRg(e.target.value))} />
              </div>
            </div>
            {/* Órgão + Data Expedição */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Órgão Emissor RG</Label>
                <Input className="h-9 text-sm uppercase" placeholder="SSP-AM"
                  value={formCliente.orgaoEmissor} onChange={e => setC("orgaoEmissor", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de Expedição RG</Label>
                <Input className="h-9 text-sm" type="date"
                  value={formCliente.dataExpedicao} onChange={e => setC("dataExpedicao", e.target.value)} />
              </div>
            </div>
            {/* Estado Civil + Data Nascimento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Estado Civil</Label>
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
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de Nascimento</Label>
                <Input className="h-9 text-sm" type="date"
                  value={formCliente.dataNascimento} onChange={e => setC("dataNascimento", e.target.value)} />
              </div>
            </div>
            {/* Pais */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Pai</Label>
                <Input className="h-9 text-sm uppercase" placeholder="Nome do pai"
                  value={formCliente.nomePai} onChange={e => setC("nomePai", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome da Mãe</Label>
                <Input className="h-9 text-sm uppercase" placeholder="Nome da mãe"
                  value={formCliente.nomeMae} onChange={e => setC("nomeMae", e.target.value)} />
              </div>
            </div>
            {/* Endereço */}
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">Endereço (Rua/Beco)</Label>
                <Input className="h-9 text-sm" placeholder="Ex: Beco São Francisco"
                  value={formCliente.endereco} onChange={e => setC("endereco", titleCase(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº</Label>
                <Input className="h-9 text-sm" placeholder="58"
                  value={formCliente.numero} onChange={e => setC("numero", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input className="h-9 text-sm" placeholder="Bairro"
                  value={formCliente.bairro} onChange={e => setC("bairro", titleCase(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CEP</Label>
                <Input className="h-9 text-sm font-mono" placeholder="00.000-000"
                  value={formCliente.cep} onChange={e => setC("cep", maskCep(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input className="h-9 text-sm"
                  value={formCliente.cidade} onChange={e => setC("cidade", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado (sigla)</Label>
              <Input className="h-9 text-sm uppercase w-24" placeholder="AM"
                value={formCliente.estado} onChange={e => setC("estado", e.target.value)} />
            </div>

            {/* Senha GOV */}
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                Senha GOV.br
                <span className="text-[10px] font-normal text-muted-foreground">(salva localmente, não compartilhada)</span>
              </Label>
              <Input className="h-9 text-sm font-mono" placeholder="Senha de acesso gov.br"
                type="text"
                value={formCliente.senhaGov} onChange={e => setC("senhaGov", e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogClienteOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={salvarCliente}>
              <UserPlus className="h-3.5 w-3.5" />{editandoId ? "Salvar Alterações" : "Cadastrar"}
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
                nomePai: c.nomePai, nomeMae: c.nomeMae, endereco: c.endereco, numero: c.numero, bairro: c.bairro,
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input className="h-9 text-sm" value={form.bairro} onChange={e => set("bairro", titleCase(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CEP</Label>
                <Input className="h-9 text-sm font-mono" value={form.cep} onChange={e => set("cep", maskCep(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input className="h-9 text-sm" value={form.cidade} onChange={e => set("cidade", e.target.value)} />
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
              Data preenchida automaticamente: {format(new Date(), "dd/MM/yyyy")}.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
              if (!form.nome || !form.dataNascimento || !form.rg) { alert("Preencha Nome, Data de Nascimento e RG."); return; }
              gerarPDF(form);
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
              Declaração de Segundo Endereço de Guarda de Acervo
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
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
              if (!formAcervo.nome || !formAcervo.rg || !formAcervo.cpf) { alert("Preencha Nome, RG e CPF."); return; }
              gerarPDFAcervo(formAcervo);
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
                  setR("endereco", c.endereco); setR("numero", c.numero); setR("cep", c.cep);
                  setR("cidade", c.cidade); setR("estado", c.estado);
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
                        <Paperclip className="h-3.5 w-3.5" />Anexar RG
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
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
              if (!formRes.nomeDeclarante || !formRes.nomeDeclarado || !formRes.endereco) {
                alert("Preencha Declarante, Declarado e Endereço."); return;
              }
              gerarPDFResidencia(formRes, rgDataUrl, compDataUrl);
            }}><Download className="h-3.5 w-3.5" />Gerar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
