import { useState } from "react";
import { FileText, Plus, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

function formatDate(value: string) {
  // yyyy-mm-dd → dd/mm/yyyy
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function gerarPDF(data: FormData) {
  const hoje = format(new Date(), "dd/MM/yyyy");
  const cidadeEstado = `${data.cidade.toUpperCase()}-${data.estado.toUpperCase()}`;

  const bairroStr = data.bairro ? ` - ${data.bairro},` : ",";
  const enderecoCompleto = `${data.endereco}${bairroStr} CEP ${data.cep}, ${data.cidade.toUpperCase()} - ${data.estado.toUpperCase()}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Declaração</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 3cm 3cm 2.5cm 3cm;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      color: #000;
      background: #fff;
      line-height: 1.5;
    }
    h1 {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 1.8em;
      line-height: 1.5;
      letter-spacing: 0;
    }
    .body-text {
      text-indent: 1.5cm;
      text-align: justify;
      line-height: 1.6;
      margin-bottom: 1.5em;
      font-size: 12pt;
    }
    .art-label {
      font-style: italic;
      margin-bottom: 0.2em;
      line-height: 1.5;
    }
    .art-dash {
      font-style: italic;
      margin-bottom: 0.5em;
      line-height: 1.5;
    }
    .art-body {
      font-style: italic;
      text-align: justify;
      line-height: 1.6;
      margin-bottom: 1em;
    }
    .city-date {
      text-align: center;
      margin-top: 2em;
      margin-bottom: 7cm;
      font-size: 12pt;
    }
    .sig-wrap {
      text-align: center;
    }
    .sig-line {
      display: block;
      width: 10cm;
      margin: 0 auto 0.4em auto;
      border-top: 1px solid #000;
    }
    .sig-name {
      font-weight: bold;
      font-size: 12pt;
      text-transform: uppercase;
      display: block;
    }
    .sig-cpf {
      font-size: 12pt;
      display: block;
    }
    /* Remove browser headers/footers in print */
    @media print {
      html, body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Aviso (não imprime) -->
  <div class="no-print" style="background:#fffbe6;border:1px solid #f0c040;padding:10px 16px;margin-bottom:18px;font-family:sans-serif;font-size:11pt;border-radius:4px;">
    <strong>Antes de imprimir:</strong> No diálogo de impressão, desmarque a opção <b>"Cabeçalhos e rodapés"</b> (ou "Headers and footers") para que o documento fique limpo.
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

  <div style="height: 6cm;"></div>

<script>
  window.onload = function() {
    // Small delay to ensure fonts are loaded
    setTimeout(function(){ window.print(); }, 400);
  };
</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export default function Declaracoes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleGerar = () => {
    if (!form.nome || !form.dataNascimento || !form.rg) {
      alert("Preencha pelo menos Nome, Data de Nascimento e RG.");
      return;
    }
    gerarPDF(form);
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
          <CardContent>
            <Button
              onClick={() => { setForm(EMPTY_FORM); setDialogOpen(true); }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Declaração de Não Estar Respondendo a Inquérito Policial
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Declaração de Inexistência de Inquéritos Policiais ou Processos Criminais
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-1">
              <Label className="text-xs">Nome Completo</Label>
              <Input className="h-9 text-sm uppercase" placeholder="Nome completo do declarante"
                value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </div>

            {/* Estado Civil + Data Nascimento */}
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

            {/* Nome dos Pais */}
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

            {/* Endereço */}
            <div className="space-y-1">
              <Label className="text-xs">Endereço (Rua/Beco, número)</Label>
              <Input className="h-9 text-sm" placeholder="Ex: Beco São Francisco, 58"
                value={form.endereco}
                onChange={(e) => {
                  const v = e.target.value.replace(/\b\w/g, (c) => c.toUpperCase());
                  set("endereco", v);
                }} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input className="h-9 text-sm" placeholder="Bairro"
                  value={form.bairro}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\b\w/g, (c) => c.toUpperCase());
                    set("bairro", v);
                  }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CEP</Label>
                <Input className="h-9 text-sm font-mono" placeholder="00.000-000"
                  value={form.cep}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                    let masked = digits;
                    if (digits.length > 5) masked = digits.replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2-$3");
                    else if (digits.length > 2) masked = digits.replace(/(\d{2})(\d{1,3})/, "$1.$2");
                    set("cep", masked);
                  }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input className="h-9 text-sm"
                  value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
              </div>
            </div>

            {/* RG */}
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

            {/* CPF */}
            <div className="space-y-1">
              <Label className="text-xs">CPF (para linha de assinatura)</Label>
              <Input className="h-9 text-sm font-mono" placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                  let masked = digits;
                  if (digits.length > 9) masked = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
                  else if (digits.length > 6) masked = digits.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
                  else if (digits.length > 3) masked = digits.replace(/(\d{3})(\d{1,3})/, "$1.$2");
                  set("cpf", masked);
                }} />
            </div>

            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
              A data da declaração será preenchida automaticamente com a data de hoje ({format(new Date(), "dd/MM/yyyy")}).
              Todo o texto legal é gerado automaticamente conforme o modelo oficial.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleGerar}>
              <Download className="h-3.5 w-3.5" />
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
