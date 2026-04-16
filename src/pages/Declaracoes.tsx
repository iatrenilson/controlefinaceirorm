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
  const cidadeEstado = `${data.cidade}-${data.estado}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Declaração de Inexistência de Inquéritos Policiais ou Processos Criminais</title>
  <style>
    @page { size: A4; margin: 3cm 2.5cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; color: #000; background: #fff; }
    .container { max-width: 100%; }
    h1 { text-align: center; font-size: 13pt; font-weight: bold; text-transform: uppercase; margin-bottom: 2em; line-height: 1.4; }
    .body-text { text-indent: 2cm; text-align: justify; line-height: 1.8; margin-bottom: 1.5em; font-size: 12pt; }
    .art { font-style: italic; text-align: justify; margin-bottom: 0.5em; line-height: 1.6; }
    .city-date { text-align: center; margin-top: 2em; margin-bottom: 3em; font-size: 12pt; }
    .signature { text-align: center; margin-top: 1em; }
    .signature-line { display: inline-block; width: 12cm; border-top: 1px solid #000; margin-bottom: 0.3em; }
    .signature-name { font-weight: bold; font-size: 12pt; text-transform: uppercase; }
    .signature-cpf { font-size: 12pt; }
    @media print {
      body { -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="container">
  <h1>Declaração de Inexistência de Inquéritos Policiais ou<br>Processos Criminais</h1>

  <p class="body-text">
    Eu, <strong>${data.nome.toUpperCase()}</strong>, abaixo assinado, ${data.estadoCivil}, nascido em ${formatDate(data.dataNascimento)}, filho de
    ${data.nomePai.toUpperCase()} e ${data.nomeMae.toUpperCase()}, residência no(a), ${data.endereco}
    ${data.bairro ? "- " + data.bairro + "," : ","} CEP ${data.cep}, ${data.cidade.toUpperCase()} - ${data.estado.toUpperCase()}, RG nº ${data.rg}, ${data.orgaoEmissor.toUpperCase()}, expedido em ${formatDate(data.dataExpedicao)}
    declaro, sob as penas da lei, que não respondo a inquéritos policiais nem a processos criminais, e estou ciente
    de que, em caso de falsidade ideológica, ficarei sujeito às sanções prescritas no Código Penal e às demais
    cominações legais aplicáveis.
  </p>

  <p class="art"><em>"Art. 299</em></p>
  <p class="art">–</p>
  <p class="art">
    <em>Omitir, em documento público ou particular, declaração que nele deveria constar, ou nele inserir ou
    fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar
    obrigação ou alterar a verdade sobre o fato juridicamente relevante.</em>
  </p>
  <br/>
  <p class="art">
    <em>Pena: reclusão de 1 (um) a 5 (cinco) anos e multa, se o documento é público e reclusão de 1 (um) a 3 (três)
    anos, se o documento é particular."</em>
  </p>

  <p class="city-date">${cidadeEstado} ${hoje}.</p>

  <div class="signature">
    <div style="margin-bottom:0.3em;"><span class="signature-line"></span></div>
    <div class="signature-name">${data.nome.toUpperCase()}</div>
    <div class="signature-cpf">${data.cpf}</div>
  </div>
</div>
<script>window.onload = function(){ window.print(); }</script>
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
                value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input className="h-9 text-sm" placeholder="Bairro"
                  value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CEP</Label>
                <Input className="h-9 text-sm" placeholder="00.000-000"
                  value={form.cep} onChange={(e) => set("cep", e.target.value)} />
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
                value={form.cpf} onChange={(e) => set("cpf", e.target.value)} />
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
