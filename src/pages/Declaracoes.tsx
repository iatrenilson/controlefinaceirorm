import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  nomePai: string; nomeMae: string; endereco: string; numero: string; bairro: string; cep: string; cidade: string; estado: string;
}
const EMPTY_FORM_RES: FormDataResidencia = {
  nomeDeclarante: "", rgDeclarante: "", orgaoDeclarante: "SSP-AM", cpfDeclarante: "",
  nomeDeclarado: "", rgDeclarado: "", orgaoDeclarado: "SSP-AM", cpfDeclarado: "",
  nomePai: "", nomeMae: "", endereco: "", numero: "", bairro: "", cep: "", cidade: "Manaus", estado: "AM",
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

// ─── Redimensiona imagem para caber em uma página A4 antes de imprimir ───
async function fitImageToPage(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image")) return dataUrl;
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX_W = 1003, MAX_H = 1299;
      const scale = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight, 1);
      if (scale >= 1) { resolve(dataUrl); return; }
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

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
  <div style="page-break-before:always;page-break-inside:avoid;text-align:center;">
    <p style="font-family:Arial,sans-serif;font-size:10pt;color:#555;margin:0 0 6px 0;text-align:left;">${label}</p>
    <img src="${dataUrl}" style="max-width:100%;max-height:22cm;object-fit:contain;display:block;margin:0 auto;" />
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
      const vp=page.getViewport({scale:1.5});
      const canvas=document.createElement('canvas');
      canvas.width=vp.width;canvas.height=vp.height;
      canvas.style.cssText='max-width:100%;max-height:22cm;width:auto;display:block;margin:0 auto 8px auto;';
      container.appendChild(canvas);
      await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    }
  }
  window.onload=async function(){
    try{await Promise.all([${pdfRenderCalls.join(",")}]);}catch(e){console.error(e);}
    setTimeout(function(){window.print();},1200);
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
  <title>Declaração de Inexistência de Inquéritos Policiais ou Processos Criminais - ${primeiroNome}</title>
  <style>
    @page{size:A4 portrait;margin:1cm 2cm 2cm 2cm;}
    html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12pt;color:#000;background:#fff;line-height:1.15;}
    h1{text-align:center;font-size:14pt;font-weight:bold;margin-top:0;margin-bottom:0.6em;line-height:1.15;}
    .body-text{text-align:justify;line-height:1.15;margin-top:0;margin-bottom:0.6em;font-size:12pt;}
    .art-text{text-align:justify;line-height:1.15;margin-top:0;margin-bottom:0.6em;font-size:12pt;}
    .validade{text-align:left;line-height:1.15;margin-top:0;margin-bottom:0;font-size:12pt;}
    .city-date{text-align:center;margin-top:1.5em;margin-bottom:4cm;font-size:12pt;}
    .sig-wrap{text-align:center;}
    .sig-line{display:block;width:8cm;margin:0 auto 0.4em auto;border-top:1px solid #000;}
    .sig-name{font-weight:bold;font-size:12pt;text-transform:uppercase;display:block;text-align:center;}
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
  <script>window.onload=function(){setTimeout(function(){window.print();window.close();},400);};<\/script></body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

function gerarPDFAcervo(data: FormDataAcervo) {
  const primeiroNome = capitalize(data.nome.trim().split(/\s+/)[0] || "Declaração");
  const cidadeEstado = `${data.cidade.toUpperCase()}-${data.estado.toUpperCase()}`;
  const dia = parseInt(format(new Date(), "d"));
  const mes = format(new Date(), "MMMM", { locale: ptBR }).toUpperCase();
  const ano = format(new Date(), "yyyy");
  const dataFormatada = `${cidadeEstado}, ${dia} de ${mes} de ${ano}`;
  const paiAcervo = data.nomePai?.trim() ? data.nomePai.toUpperCase() : "";
  const maeAcervo = data.nomeMae?.trim() ? data.nomeMae.toUpperCase() : "";
  const filhoDeAcervoHtml = paiAcervo && maeAcervo
    ? `<strong>${paiAcervo}</strong> e <strong>${maeAcervo}</strong>`
    : `<strong>${paiAcervo || maeAcervo}</strong>`;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
  <title>Declaração de Segundo Endereço de Guarda de Acervo - ${primeiroNome}</title>
  <style>@page{size:A4 portrait;margin:2.5cm 2cm 2cm 2cm;}html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12pt;color:#000;background:#fff;line-height:1.5;}
  h1{text-align:center;font-size:12pt;font-weight:bold;text-decoration:underline;text-transform:uppercase;margin-top:0;margin-bottom:3.5em;line-height:1.4;}
  .body-text{text-align:justify;line-height:1.5;margin-bottom:2em;font-size:12pt;}
  .verdade{text-align:center;font-size:12pt;line-height:1.5;margin-top:0;margin-bottom:5cm;}
  .city-date{text-align:center;font-size:12pt;line-height:1.5;margin-top:0;margin-bottom:4.5cm;}
  .sig-wrap{text-align:center;}.sig-line{display:block;width:10cm;margin:0 auto 0.4em auto;border-top:1px solid #000;}
  .sig-name{font-weight:bold;font-size:12pt;text-transform:uppercase;display:block;text-align:center;}
  .sig-cpf{font-size:12pt;font-weight:normal;display:block;text-align:center;}
  @media print{html,body{margin:0;padding:0;}}</style></head><body>
  <h1>Declaração de Segundo Endereço de Guarda de Acervo</h1>
  <p class="body-text">Eu, <strong>${data.nome.toUpperCase()}</strong>, portador da cédula de identidade
    RG nº ${data.rg} / ${data.orgaoEmissor.toUpperCase()}, CPF nº ${data.cpf},
    filho de ${filhoDeAcervoHtml},
    DECLARO que não possuo segundo endereço de guarda de acervo.</p>
  <p class="verdade">Por ser verdade, firmo o presente.</p>
  <p class="city-date">${dataFormatada}</p>
  <div class="sig-wrap"><span class="sig-line"></span><span class="sig-name">${data.nome.toUpperCase()}</span><span class="sig-cpf">${data.cpf}</span></div>
  <script>window.onload=function(){setTimeout(function(){window.print();window.close();},400);};<\/script></body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

async function gerarPDFResidencia(data: FormDataResidencia, rgDataUrl: string | null, compDataUrl: string | null) {
  const primeiroNome = capitalize(data.nomeDeclarado.trim().split(/\s+/)[0] || "Declaração");
  const dataEscrita = dataExtenso();
  const numResStr = data.numero ? `, Nº ${data.numero}` : "";
  const bairroResStr = data.bairro ? ` - ${data.bairro.toUpperCase()},` : ",";
  const endFormatado = `${data.endereco.toUpperCase()}${numResStr}${bairroResStr} Cep: ${data.cep} – ${data.cidade.toUpperCase()}-${data.estado.toUpperCase()}`;
  const attachmentList: Array<{ dataUrl: string; label: string }> = [];
  // Redimensiona imagens grandes para caber na página sem criar folha em branco
  if (rgDataUrl) attachmentList.push({ dataUrl: await fitImageToPage(rgDataUrl), label: "Anexo: Documento de Identidade (RG)" });
  if (compDataUrl) attachmentList.push({ dataUrl: await fitImageToPage(compDataUrl), label: "Anexo: Comprovante de Residência" });
  const { html: anexos, pdfJsHead, initScript } = buildAnexos(attachmentList);
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
  <title>Declaração de Residência - ${primeiroNome}</title>
  ${pdfJsHead}
  <style>
    @page{size:A4 portrait;margin:2.5cm 2cm 2cm 2cm;}
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
    .sig-cpf{font-size:12pt;font-weight:normal;display:block;text-align:center;}
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
  <div class="sig-wrap"><span class="sig-line"></span><span class="sig-name">${data.nomeDeclarante.toUpperCase()}</span><span class="sig-cpf">${data.cpfDeclarante}</span></div>
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
    bairro: (row.bairro as string) ?? "",
    cep: (row.cep as string) ?? "",
    cidade: (row.cidade as string) ?? "Manaus",
    estado: (row.estado as string) ?? "AM",
    senhaGov: (row.senha_gov as string) ?? "",
  };
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function Declaracoes() {
  const { toast } = useToast();

  // Clientes cadastrados
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [dialogClienteOpen, setDialogClienteOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formCliente, setFormCliente] = useState<ClienteForm>(EMPTY_CLIENTE);
  const [savingCliente, setSavingCliente] = useState(false);
  const [importando, setImportando] = useState(false);
  const [textoExtraido, setTextoExtraido] = useState<string>("");
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const parsearTexto = useCallback((text: string): Partial<ClienteForm> => {
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
      if (/\bFILIA[ÇC][AÃ]O\b/i.test(l)) {
        // Caso A: "FILIAÇÃO: PAI / MÃE" ou "FILIAÇÃO PAI MÃE" inline
        const afterFil = l.replace(/.*?\bFILIA[ÇC][AÃ]O\s*[:\-]?\s*/i,"").trim();
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
          for (let j = i+1; j < Math.min(i+10, linhas.length); j++) {
            const v = linhas[j].trim();
            if (!v) continue;
            // Para apenas em linhas claramente de outro campo (início da linha)
            if (/^(?:NACIONAL|CATEGOR|PRONTU|RENACH|REGISTRO|CPF|DOC\.?\s*IDENT|HABILI|VALIDADE|CAT\s*HAB|Nº\s*REG)/i.test(v)) break;
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) break; // linha só com data isolada
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

      // CEP
      if (!r.cep) {
        const m = l.match(/\b(\d{2}[\.\s]?\d{3}[\-\s]?\d{3})\b/);
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

  const handleImportarDocumento = useCallback(async (file: File) => {
    setImportando(true);
    try {
      let texto = "";

      if (file.type === "application/pdf") {
        // Extrai texto do PDF via PDF.js (CDN)
        const pdfjsLib = await new Promise<any>((res, rej) => {
          if ((window as any).pdfjsLib) { res((window as any).pdfjsLib); return; }
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          s.onload = () => {
            (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            res((window as any).pdfjsLib);
          };
          s.onerror = rej;
          document.head.appendChild(s);
        });
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          // Preserva quebras de linha usando posição Y dos itens
          let lastY: number | null = null;
          const linhasPage: string[] = [];
          let linhaAtual = "";
          for (const item of content.items as any[]) {
            const y = item.transform?.[5] ?? 0;
            if (lastY !== null && Math.abs(y - lastY) > 3) {
              if (linhaAtual.trim()) linhasPage.push(linhaAtual.trim());
              linhaAtual = item.str;
            } else {
              linhaAtual += (linhaAtual && item.str ? " " : "") + item.str;
            }
            lastY = y;
          }
          if (linhaAtual.trim()) linhasPage.push(linhaAtual.trim().replace(/\s+/g, " "));
          // Inverte porque PDF.js retorna de baixo para cima
          texto += linhasPage.reverse().join("\n") + "\n";
        }
      } else {
        // Imagem: usa Tesseract.js via CDN
        const Tesseract = await new Promise<any>((res, rej) => {
          if ((window as any).Tesseract) { res((window as any).Tesseract); return; }
          const s = document.createElement("script");
          s.src = "https://unpkg.com/tesseract.js@5/dist/tesseract.min.js";
          s.onload = () => res((window as any).Tesseract);
          s.onerror = rej;
          document.head.appendChild(s);
        });
        const worker = await Tesseract.createWorker("por");
        const { data } = await worker.recognize(file);
        texto = data.text;
        await worker.terminate();
      }

      setTextoExtraido(texto);
      const campos = parsearTexto(texto);
      const total = Object.keys(campos).length;
      if (total === 0) {
        setMostrarTexto(true);
        toast({ title: "Nenhum campo reconhecido", description: "Veja o texto extraído abaixo para verificar.", variant: "destructive" });
      } else {
        setFormCliente(prev => ({ ...prev, ...campos }));
        toast({ title: `${total} campo(s) preenchido(s) automaticamente!` });
      }
    } catch (e) {
      toast({ title: "Erro ao ler documento", description: "Verifique se o arquivo é válido.", variant: "destructive" });
    } finally {
      setImportando(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }, [parsearTexto, toast]);

  const saveClientesToCloud = useCallback(async (list: Cliente[]) => {
    await supabase.auth.updateUser({ data: { decl_clientes: list } });
  }, []);

  const fetchClientes = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const cloud: Cliente[] = user?.user_metadata?.decl_clientes ?? [];
      const local: Cliente[] = JSON.parse(localStorage.getItem("decl_clientes") || "[]");

      if (cloud.length > 0) {
        // Cloud tem dados: usa cloud (sincronizado entre dispositivos)
        setClientes(cloud);
        // Se local tem dados que não estão na cloud, mescla e salva
        if (local.length > 0) {
          const merged = [...cloud];
          for (const lc of local) {
            if (!cloud.find(c => c.cpf === lc.cpf && c.nome === lc.nome)) merged.push(lc);
          }
          if (merged.length > cloud.length) {
            await saveClientesToCloud(merged);
            setClientes(merged);
          }
          localStorage.removeItem("decl_clientes");
        }
      } else if (local.length > 0) {
        // Só tem no local: migra para cloud
        await saveClientesToCloud(local);
        localStorage.removeItem("decl_clientes");
        setClientes(local);
      } else {
        setClientes([]);
      }
    } catch {
      const local: Cliente[] = JSON.parse(localStorage.getItem("decl_clientes") || "[]");
      setClientes(local);
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
      bairro: formCliente.bairro,
      cep: formCliente.cep,
      cidade: formCliente.cidade,
      estado: formCliente.estado,
      senha_gov: formCliente.senhaGov,
      updated_at: new Date().toISOString(),
    };
    try {
      let novaLista: Cliente[];
      if (editandoId) {
        novaLista = clientes.map(c => c.id === editandoId ? { id: editandoId, ...formCliente } : c);
      } else {
        novaLista = [...clientes, { id: Date.now().toString(), ...formCliente }];
      }
      await saveClientesToCloud(novaLista);
      setClientes(novaLista);
      setDialogClienteOpen(false);
      toast({ title: editandoId ? "Cliente atualizado!" : "Cliente cadastrado!" });
    } catch (e: unknown) {
      toast({ title: "Erro ao salvar cliente", description: e instanceof Error ? e.message : "Erro desconhecido", variant: "destructive" });
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
            {loadingClientes ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Carregando clientes...</p>
            ) : clientes.length === 0 ? (
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
            {/* Importar Documento */}
            <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-primary/40 bg-primary/5">
              <input
                ref={importInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImportarDocumento(f); }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 text-xs border-primary/50 text-primary hover:bg-primary/10"
                disabled={importando}
                onClick={() => importInputRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5" />
                {importando ? "Lendo documento..." : "Importar Documento (PDF ou Imagem)"}
              </Button>
              <span className="text-[10px] text-muted-foreground">Preenche o cadastro automaticamente</span>
              {textoExtraido && (
                <button type="button" onClick={() => setMostrarTexto(v => !v)}
                  className="text-[10px] underline text-muted-foreground ml-auto">
                  {mostrarTexto ? "Ocultar texto lido" : "Ver texto extraído"}
                </button>
              )}
            </div>
            {mostrarTexto && textoExtraido && (
              <div className="rounded border border-border bg-muted/30 p-2">
                <p className="text-[10px] text-muted-foreground mb-1 font-semibold">Texto extraído pelo OCR (copie e envie para suporte):</p>
                <textarea
                  readOnly
                  className="w-full text-[10px] font-mono bg-transparent resize-none outline-none text-foreground"
                  rows={8}
                  value={textoExtraido}
                />
                <button type="button"
                  className="text-[10px] underline text-primary mt-1"
                  onClick={() => { navigator.clipboard.writeText(textoExtraido); toast({ title: "Texto copiado!" }); }}>
                  Copiar texto
                </button>
              </div>
            )}
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
                  setR("endereco", c.endereco); setR("numero", c.numero); setR("bairro", c.bairro);
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
                    <Label className="text-xs">Bairro</Label>
                    <Input className="h-9 text-sm" placeholder="Ex: Cidade Nova" value={formRes.bairro} onChange={e => setR("bairro", titleCase(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CEP</Label>
                    <Input className="h-9 text-sm font-mono" value={formRes.cep} onChange={e => setR("cep", maskCep(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
