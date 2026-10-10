import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { norm } from "@/lib/utils";
import { Copy, Link, UserPlus, Search, Users, Pencil, Trash2, Check, X, FileDown, ClipboardPen, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  psicologico_url: string | null;
  created_at: string;
}

const MIGRATION_SQL = `
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS tipo_sinarm TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS armas TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS psicologico_url TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS estado TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cac_cadastros' AND policyname='cac_cad_update') THEN
    CREATE POLICY "cac_cad_update" ON public.cac_cadastros FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cac_cadastros' AND policyname='cac_cad_delete') THEN
    CREATE POLICY "cac_cad_delete" ON public.cac_cadastros FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
  END IF;
END $$;
`.trim();

const LINK_CADASTRO = `${window.location.origin}/cadastro`;

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
};

const TIPOS_SINARM = ["SINARM CAC", "SINARM POSSE", "SINARM PORTE"];
const ARMAS_OPTS   = ["Pistola", "Revólver", "Rifle", "Espingarda"];

const GOLD = "#d4a730";

const checkboxStyle = (checked: boolean): React.CSSProperties => ({
  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
  border: `2px solid ${checked ? GOLD : "rgba(212,167,48,0.3)"}`,
  background: checked ? GOLD : "transparent",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all .15s", cursor: "pointer",
});

export default function CadastrosAdmin() {
  const [cadastros, setCadastros] = useState<CacCadastro[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<CacCadastro | null>(null);
  const [editTipos, setEditTipos] = useState<string[]>([]);
  const [editArmas, setEditArmas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [deletandoTodos, setDeletandoTodos] = useState(false);

  // Cadastro manual
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const backUrl = searchParams.get("back");
  const [novoOpen, setNovoOpen] = useState(() => searchParams.get("novo") === "1");

  const handleNovoOpenChange = (open: boolean) => {
    setNovoOpen(open);
    if (!open && backUrl) navigate(backUrl);
  };
  const [novoNome, setNovoNome] = useState("");
  const [novoCpf, setNovoCpf] = useState("");
  const [novoEndereco, setNovoEndereco] = useState("");
  const [novoNumero, setNovoNumero] = useState("");
  const [novoComplemento, setNovoComplemento] = useState("");
  const [novoBairro, setNovoBairro] = useState("");
  const [novoCidade, setNovoCidade] = useState("");
  const [novoEstado, setNovoEstado] = useState("");
  const [novoTipos, setNovoTipos] = useState<string[]>([]);
  const [novoArmas, setNovoArmas] = useState<string[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<"idle"|"ok"|"erro">("idle");
  const [ocrEndLoading, setOcrEndLoading] = useState(false);
  const [ocrEndStatus, setOcrEndStatus] = useState<"idle"|"ok"|"erro">("idle");
  const [novoPsicoFile, setNovoPsicoFile] = useState<File | null>(null);
  const [novoPsicoUrl, setNovoPsicoUrl] = useState<string | null>(null);
  const [uploadingPsico, setUploadingPsico] = useState(false);
  const [novoSaving, setNovoSaving] = useState(false);
  const psicoInputRef = useRef<HTMLInputElement>(null);

  // Busca cliente SINARM CAC
  const [cacClientes, setCacClientes] = useState<{id:string;nome:string;cpf:string|null;endereco:string|null;numero:string|null;complemento:string|null;bairro:string|null;cidade:string|null;estado:string|null}[]>([]);
  const [cacBusca, setCacBusca] = useState("");
  const [cacDropOpen, setCacDropOpen] = useState(false);
  const [cacSelecionado, setCacSelecionado] = useState<string | null>(null);
  const cacWrapRef = useRef<HTMLDivElement>(null);

  const carregar = () =>
    supabase.from("cac_cadastros").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setCadastros(data as CacCadastro[]); setLoading(false); });

  // Carrega clientes SINARM CAC ao abrir o dialog
  useEffect(() => {
    if (!novoOpen) { setCacBusca(""); setCacDropOpen(false); return; }
    supabase.from("declaracao_clientes")
      .select("id, nome, cpf, endereco, numero, complemento, bairro, cidade, estado")
      .order("nome")
      .then(({ data }) => { if (data) setCacClientes(data as typeof cacClientes); });
  }, [novoOpen]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cacWrapRef.current && !cacWrapRef.current.contains(e.target as Node))
        setCacDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    supabase.functions.invoke("run-migration", { body: { sql: MIGRATION_SQL } }).finally(carregar);

    const channel = supabase.channel("cac_cadastros_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "cac_cadastros" }, carregar)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const copiarLink = () => {
    navigator.clipboard.writeText(LINK_CADASTRO).then(() => {
      toast.success("Link copiado! Envie para o cliente preencher.");
    });
  };

  const abrirEdicao = (c: CacCadastro) => {
    setEditData({ ...c });
    setEditTipos(c.tipo_sinarm ? c.tipo_sinarm.split(", ").map(s => s.trim()) : []);
    setEditArmas(c.armas ? c.armas.split(", ").map(s => s.trim()) : []);
    setEditOpen(true);
  };

  const toggleEdit = (list: string[], setList: (v: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

  const salvarEdicao = async () => {
    if (!editData) return;
    setSaving(true);
    const { error } = await supabase.from("cac_cadastros").update({
      nome: editData.nome,
      cpf: editData.cpf || null,
      endereco: editData.endereco || null,
      numero: editData.numero || null,
      complemento: editData.complemento || null,
      bairro: editData.bairro || null,
      cidade: editData.cidade || null,
      estado: editData.estado || null,
      tipo_sinarm: editTipos.length ? editTipos.join(", ") : null,
      armas: editArmas.length ? editArmas.join(", ") : null,
    }).eq("id", editData.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Cadastro atualizado.");
    setEditOpen(false);
    carregar();
  };

  const excluir = async (id: string) => {
    const { error } = await supabase.from("cac_cadastros").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Cadastro excluído.");
    setDeletandoId(null);
    carregar();
  };

  const toggleNovo = (list: string[], setList: (v: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

  const carregarTesseract = async () => {
    if (!(window as any).Tesseract) {
      await new Promise<void>((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://unpkg.com/tesseract.js@4.1.1/dist/tesseract.min.js";
        s.onload = () => res(); s.onerror = rej;
        document.head.appendChild(s);
      });
    }
  };

  const fileParaImagem = async (file: File): Promise<Blob> => {
    if (!file.type.includes("pdf")) return file;
    if (!(window as any).pdfjsLib) {
      await new Promise<void>((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = () => {
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          res();
        };
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const pdf = await (window as any).pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
    return await new Promise<Blob>(res => canvas.toBlob(b => res(b!), "image/png"));
  };

  const extrairOCR = async (file: File) => {
    setOcrLoading(true); setOcrStatus("idle");
    try {
      await carregarTesseract();
      const img = await fileParaImagem(file);
      const { data: { text } } = await (window as any).Tesseract.recognize(img, "por");
      const t = text.toUpperCase().replace(/\r/g, "\n");

      // CPF — múltiplos formatos
      const cpfM = t.match(/\d{3}[\. ]?\d{3}[\. ]?\d{3}[-. ]?\d{2}/);
      const cpfRaw = cpfM ? cpfM[0].replace(/\D/g, "") : "";
      const cpf = cpfRaw.length === 11
        ? cpfRaw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "";

      // Nome — tenta com label, depois procura linha em maiúsculas que parece nome
      let nome = "";
      const nomeLabelM = t.match(/(?:NOME[:\s]+|^NOME\s*\n)([A-ZÀ-ÚÃÕÂÊÔÁÉÍÓÚÇ\s]{4,70}?)(?:\n|CPF|DATA|NASC)/m);
      if (nomeLabelM) {
        nome = nomeLabelM[1].trim().replace(/\s+/g, " ");
      } else {
        // Procura linha que parece um nome (2+ palavras, só letras/espaço, >6 chars)
        const linhas = t.split("\n").map(l => l.trim()).filter(Boolean);
        const bloqueios = /BRASIL|REPÚBLICA|HABILITAÇÃO|IDENTIDADE|SECRETARIA|CARTEIRA|NACIONAL|SEGURANÇA|PÚBLICA|MINISTÉRIO|CATEGORIA|VALIDADE|EMISSÃO|FILIAÇÃO|ÓRGÃO|EMISSOR|REGISTRO|MILITAR|FEDERAL|POLÍCIA|CIVIL|ESTADO|SERVIÇO|SOCIAL|NATURALIDADE|NASCIMENTO/;
        for (const linha of linhas) {
          if (linha.length >= 6 && /^[A-ZÀ-ÚÃÕÂÊÔÁÉÍÓÚÇ\s]+$/.test(linha) && !bloqueios.test(linha) && linha.split(/\s+/).length >= 2) {
            nome = linha; break;
          }
        }
      }

      if (cpf) setNovoCpf(cpf);
      if (nome) setNovoNome(nome);
      setOcrStatus("ok");
    } catch {
      setOcrStatus("erro");
    } finally {
      setOcrLoading(false);
    }
  };

  const extrairOCREndereco = async (file: File) => {
    setOcrEndLoading(true); setOcrEndStatus("idle");
    try {
      await carregarTesseract();
      const img = await fileParaImagem(file);
      const { data: { text } } = await (window as any).Tesseract.recognize(img, "por");
      const t = text.toUpperCase().replace(/\r/g, "\n");

      // Endereço — vários padrões
      let endereco = "", numero = "";
      const endPatterns = [
        /(?:ENDERE[CÇ]O|LOG[OA]RADOURO|DOMIC[IÍ]LIO)[:\s]+([^\n]{5,80})/,
        /(?:RUA|AV(?:ENIDA)?\.?|TRAV(?:ESSA)?\.?|ALAMEDA|ESTRADA|ROD(?:OVIA)?\.?)\s+([^\n]{4,70})/,
      ];
      for (const re of endPatterns) {
        const m = t.match(re);
        if (m) {
          const endStr = m[0].replace(/(?:ENDERE[CÇ]O|LOG[OA]RADOURO|DOMIC[IÍ]LIO)[:\s]+/, "").trim();
          const numM = endStr.match(/,\s*(?:N[°º.]?\s*)?(\d+)/);
          if (numM) {
            numero = numM[1];
            endereco = endStr.slice(0, endStr.indexOf(numM[0])).replace(/,\s*$/, "").trim();
          } else {
            const numSoloM = endStr.match(/\s(\d{1,6})(?:\s|$)/);
            if (numSoloM) {
              numero = numSoloM[1];
              endereco = endStr.slice(0, endStr.indexOf(numSoloM[0])).trim();
            } else { endereco = endStr; }
          }
          break;
        }
      }

      // Bairro
      const bairroM = t.match(/BAIRRO[:\s]+([A-ZÀ-ÚÃÕÂÊÔÁÉÍÓÚÇ\s\d\-]{2,50})(?:\n|CEP|CIDADE|MUNIC)/m);
      const bairroAlt = t.match(/BAIRRO[:\s]+([^\n]{2,40})/);
      const bairro = (bairroM ? bairroM[1] : bairroAlt ? bairroAlt[1] : "").trim().split(/\s{2,}/)[0];

      // Cidade / Município
      const cidadeM = t.match(/(?:MUNIC[IÍ]PIO|CIDADE)[:\s]+([A-ZÀ-ÚÃÕÂÊÔÁÉÍÓÚÇ\s]{2,50})(?:\n|UF|ESTADO|\s{2,}|\-)/m);
      const cidade = cidadeM ? cidadeM[1].trim().split(/\s{2,}/)[0] : "";

      // UF
      const ufM = t.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
      const estado = ufM ? ufM[1] : "";

      if (endereco) setNovoEndereco(endereco.toUpperCase());
      if (numero) setNovoNumero(numero);
      if (bairro) setNovoBairro(bairro.toUpperCase());
      if (cidade) setNovoCidade(cidade.toUpperCase());
      if (estado) setNovoEstado(estado);
      setOcrEndStatus("ok");
    } catch {
      setOcrEndStatus("erro");
    } finally {
      setOcrEndLoading(false);
    }
  };

  const resetNovo = () => {
    setNovoNome(""); setNovoCpf(""); setNovoEndereco(""); setNovoNumero("");
    setNovoComplemento(""); setNovoBairro(""); setNovoCidade(""); setNovoEstado("");
    setNovoTipos([]); setNovoArmas([]);
    setNovoPsicoFile(null); setNovoPsicoUrl(null);
    setCacBusca(""); setCacDropOpen(false); setCacSelecionado(null);
    setOcrLoading(false); setOcrStatus("idle");
    setOcrEndLoading(false); setOcrEndStatus("idle");
  };

  const handleNovoPsico = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop() || "pdf";
    setNovoPsicoFile(file);
    setNovoPsicoUrl(null);
    setUploadingPsico(true);
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("psicologicos").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("psicologicos").getPublicUrl(path);
      setNovoPsicoUrl(publicUrl);
    } else {
      toast.error("Erro ao enviar psicológico: " + error.message);
      setNovoPsicoFile(null);
    }
    setUploadingPsico(false);
  };

  const salvarNovo = async () => {
    if (!novoNome.trim())     { toast.error("Informe o nome completo."); return; }
    if (!novoCpf.trim())      { toast.error("Informe o CPF."); return; }
    if (!novoEndereco.trim()) { toast.error("Informe o endereço."); return; }
    if (!novoNumero.trim())   { toast.error("Informe o número."); return; }
    if (!novoBairro.trim())   { toast.error("Informe o bairro."); return; }
    if (!novoCidade.trim())   { toast.error("Informe a cidade."); return; }
    if (!novoTipos.length)    { toast.error("Selecione ao menos um Tipo de Serviço."); return; }
    if (!novoArmas.length)    { toast.error("Selecione ao menos uma Arma."); return; }
    if (uploadingPsico)       { toast.error("Aguarde o upload do psicológico."); return; }

    setNovoSaving(true);
    const { error } = await supabase.from("cac_cadastros").insert({
      nome: novoNome.trim(),
      cpf: novoCpf.trim() || null,
      endereco: novoEndereco.trim() || null,
      numero: novoNumero.trim() || null,
      complemento: novoComplemento.trim() || null,
      bairro: novoBairro.trim() || null,
      cidade: novoCidade.trim() || null,
      estado: novoEstado.trim() || null,
      tipo_sinarm: novoTipos.length ? novoTipos.join(", ") : null,
      armas: novoArmas.length ? novoArmas.join(", ") : null,
      psicologico_url: novoPsicoUrl || null,
    });
    setNovoSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Cadastro criado com sucesso.");
    resetNovo();
    handleNovoOpenChange(false);
    carregar();
  };

  const excluirTodos = async () => {
    const { error } = await supabase.from("cac_cadastros").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Todos os cadastros excluídos.");
    setDeletandoTodos(false);
    carregar();
  };

  const filtrados = busca.trim()
    ? cadastros.filter(c => norm(c.nome).includes(norm(busca)) || (c.cpf || "").includes(busca))
    : cadastros;

  const fmtData = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-12 z-10">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
          <Users className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <h1 className="text-base sm:text-lg font-bold tracking-tight">Cadastros</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Clientes cadastrados pelo link externo</p>
          </div>
          {deletandoTodos ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive font-medium">Excluir todos?</span>
              <Button size="sm" variant="destructive" onClick={excluirTodos} className="gap-1.5">
                <Check className="h-3.5 w-3.5" />Confirmar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDeletandoTodos(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setDeletandoTodos(true)} className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
              Excluir todos
            </Button>
          )}
          <Button onClick={() => setNovoOpen(true)} size="sm" className="gap-2">
            <ClipboardPen className="h-4 w-4" />
            Cadastro Manual
          </Button>
          <Button onClick={copiarLink} size="sm" variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
            <Link className="h-4 w-4" />
            Copiar link
          </Button>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 max-w-3xl mx-auto space-y-4">

        {/* Link */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <UserPlus className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Link para enviar ao cliente</p>
                <p className="text-sm font-mono text-primary truncate">{LINK_CADASTRO}</p>
              </div>
              <button onClick={copiarLink} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity">
                <Copy className="h-3.5 w-3.5" />Copiar
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input className="pl-9" placeholder="Buscar por nome ou CPF..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        {/* Lista */}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{busca ? "Nenhum cadastro encontrado." : "Nenhum cadastro ainda."}</p>
        ) : (
          <div className="space-y-3">
            {filtrados.map(c => (
              <Card key={c.id} className="border-border/60">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-semibold text-sm truncate">{c.nome.toUpperCase()}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {c.cpf      && <span>CPF: {c.cpf}</span>}
                        {c.endereco && <span>{c.endereco}{c.numero ? `, Nº ${c.numero}` : ""}{c.complemento ? ` - ${c.complemento}` : ""}</span>}
                        {c.bairro   && <span>Bairro: {c.bairro}</span>}
                        {(c.cidade || c.estado) && <span>{c.cidade}{c.cidade && c.estado ? " - " : ""}{c.estado}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {c.tipo_sinarm && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            {c.tipo_sinarm}
                          </span>
                        )}
                        {c.armas && c.armas.split(",").map(a => (
                          <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                            {a.trim()}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <p className="text-[10px] text-muted-foreground">{fmtData(c.created_at)}</p>
                        {c.psicologico_url && (() => {
                          const ext = c.psicologico_url.split(".").pop()?.split("?")[0] || "pdf";
                          const dlUrl = `${c.psicologico_url}?download=${encodeURIComponent(`${c.nome.toUpperCase()} - Psicológico.${ext}`)}`;
                          return (
                            <a href={dlUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                              <FileDown className="h-3 w-3" />Psicológico
                            </a>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button onClick={() => abrirEdicao(c)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {deletandoId === c.id ? (
                        <div className="flex flex-col items-end gap-1 mt-1">
                          <span className="text-[10px] text-destructive font-medium whitespace-nowrap">Excluir?</span>
                          <div className="flex gap-1">
                            <button onClick={() => excluir(c.id)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive text-white text-[10px] font-semibold hover:opacity-90 transition-opacity">
                              <Check className="h-3 w-3" />Sim
                            </button>
                            <button onClick={() => setDeletandoId(null)} className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[10px] font-semibold hover:bg-accent transition-colors">
                              <X className="h-3 w-3" />Não
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setDeletandoId(c.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Dialog de cadastro manual */}
      <Dialog open={novoOpen} onOpenChange={v => { handleNovoOpenChange(v); if (!v) resetNovo(); }}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPen className="h-4 w-4 text-primary" />
              Cadastro Manual
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* ── Buscar cliente SINARM CAC ── */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <Label className="text-xs text-primary font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Buscar cliente SINARM CAC
              </Label>
              <div className="relative" ref={cacWrapRef}>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={cacBusca}
                  onChange={e => { setCacBusca(e.target.value); setCacDropOpen(true); }}
                  onFocus={() => { if (cacBusca) setCacDropOpen(true); }}
                  placeholder="Nome ou CPF..."
                  className="pl-8 h-9 text-sm border-primary/30 focus-visible:ring-primary/30"
                />
                {cacDropOpen && cacBusca.trim() && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto">
                    {cacClientes
                      .filter(c => {
                        const cpfDigits = cacBusca.replace(/\D/g, "");
                        return norm(c.nome || "").includes(norm(cacBusca)) ||
                          (cpfDigits.length > 0 && (c.cpf || "").replace(/\D/g, "").includes(cpfDigits));
                      })
                      .slice(0, 8)
                      .map(c => (
                        <button key={c.id} type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-muted text-sm border-b border-border/50 last:border-0 transition-colors"
                          onMouseDown={e => {
                            e.preventDefault();
                            setNovoNome(c.nome || "");
                            setNovoCpf(maskCpf(c.cpf || ""));
                            setNovoEndereco((c.endereco || "").toUpperCase());
                            setNovoNumero(c.numero || "");
                            setNovoComplemento((c.complemento || "").toUpperCase());
                            setNovoBairro((c.bairro || "").toUpperCase());
                            setNovoCidade((c.cidade || "").toUpperCase());
                            setNovoEstado((c.estado || "").toUpperCase());
                            setCacSelecionado(c.nome);
                            setCacBusca("");
                            setCacDropOpen(false);
                          }}>
                          <div className="font-semibold truncate">{c.nome}</div>
                          <div className="text-xs text-muted-foreground">{c.cpf || "Sem CPF"}</div>
                        </button>
                      ))}
                    {cacClientes.filter(c => {
                      const cpfDigits = cacBusca.replace(/\D/g, "");
                      return norm(c.nome || "").includes(norm(cacBusca)) ||
                        (cpfDigits.length > 0 && (c.cpf || "").replace(/\D/g, "").includes(cpfDigits));
                    }).length === 0 && (
                      <div className="px-3 py-2.5 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Selecione para preencher automaticamente os dados abaixo</p>
              {cacSelecionado && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-primary">✓ {cacSelecionado}</span>
                  <button type="button" onClick={() => {
                    setNovoNome(""); setNovoCpf(""); setNovoEndereco("");
                    setNovoNumero(""); setNovoComplemento(""); setNovoBairro("");
                    setNovoCidade(""); setNovoEstado(""); setCacSelecionado(null);
                  }} className="text-xs text-destructive border border-destructive/30 rounded px-2 py-0.5 hover:bg-destructive/10">
                    ✕ Limpar
                  </button>
                </div>
              )}
            </div>

            {/* OCR uploads */}
            <div className="grid grid-cols-2 gap-2">
              {/* CNH / RG — extrai Nome e CPF */}
              <label className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors min-h-[80px]
                ${ocrLoading ? "border-primary/40 bg-primary/5" : ocrStatus === "ok" ? "border-green-500/50 bg-green-500/5" : ocrStatus === "erro" ? "border-destructive/40 bg-destructive/5" : "border-border/50 hover:border-primary/40 hover:bg-primary/5"}`}>
                <input type="file" accept="image/*,application/pdf" className="hidden" disabled={ocrLoading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) extrairOCR(f); e.target.value = ""; }} />
                {ocrLoading ? (
                  <><div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-primary text-center">Lendo...</span></>
                ) : ocrStatus === "ok" ? (
                  <><span className="text-base">✓</span><span className="text-[10px] text-green-500 font-medium text-center">Nome e CPF<br/>extraídos!</span></>
                ) : ocrStatus === "erro" ? (
                  <><span className="text-base">⚠</span><span className="text-[10px] text-destructive text-center">Não lido.<br/>Preencha manual.</span></>
                ) : (
                  <><Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground text-center"><strong>CNH / RG</strong><br/>Nome e CPF</span></>
                )}
              </label>

              {/* Comprovante de endereço — extrai Endereço */}
              <label className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors min-h-[80px]
                ${ocrEndLoading ? "border-primary/40 bg-primary/5" : ocrEndStatus === "ok" ? "border-green-500/50 bg-green-500/5" : ocrEndStatus === "erro" ? "border-destructive/40 bg-destructive/5" : "border-border/50 hover:border-primary/40 hover:bg-primary/5"}`}>
                <input type="file" accept="image/*,application/pdf" className="hidden" disabled={ocrEndLoading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) extrairOCREndereco(f); e.target.value = ""; }} />
                {ocrEndLoading ? (
                  <><div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-primary text-center">Lendo...</span></>
                ) : ocrEndStatus === "ok" ? (
                  <><span className="text-base">✓</span><span className="text-[10px] text-green-500 font-medium text-center">Endereço<br/>extraído!</span></>
                ) : ocrEndStatus === "erro" ? (
                  <><span className="text-base">⚠</span><span className="text-[10px] text-destructive text-center">Não lido.<br/>Preencha manual.</span></>
                ) : (
                  <><Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground text-center"><strong>Comp. Endereço</strong><br/>Rua, Bairro, Cidade</span></>
                )}
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground text-center -mt-1">Aceita foto (📷) ou PDF — preenche os campos automaticamente</p>

            {/* divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-border/40" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ou preencher manualmente</span>
              <div className="flex-1 border-t border-border/40" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nome completo {!novoNome.trim() && <span className="text-destructive">*</span>}</Label>
              <Input value={novoNome} onChange={e => setNovoNome(e.target.value.toUpperCase())} placeholder="EX: JOÃO DA SILVA" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF {!novoCpf.trim() && <span className="text-destructive">*</span>}</Label>
              <Input value={novoCpf} onChange={e => setNovoCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Endereço {!novoEndereco.trim() && <span className="text-destructive">*</span>}</Label>
              <Input value={novoEndereco} onChange={e => setNovoEndereco(e.target.value.toUpperCase())} placeholder="RUA, AV..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Nº {!novoNumero.trim() && <span className="text-destructive">*</span>}</Label>
                <Input value={novoNumero} onChange={e => setNovoNumero(e.target.value)} placeholder="123" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Complemento</Label>
                <Input value={novoComplemento} onChange={e => setNovoComplemento(e.target.value.toUpperCase())} placeholder="APTO, BLOCO..." />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bairro {!novoBairro.trim() && <span className="text-destructive">*</span>}</Label>
              <Input value={novoBairro} onChange={e => setNovoBairro(e.target.value.toUpperCase())} placeholder="EX: CENTRO" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Cidade {!novoCidade.trim() && <span className="text-destructive">*</span>}</Label>
                <Input value={novoCidade} onChange={e => setNovoCidade(e.target.value.toUpperCase())} placeholder="EX: MANAUS" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Input value={novoEstado} onChange={e => setNovoEstado(e.target.value.toUpperCase())} placeholder="EX: AM" maxLength={2} />
              </div>
            </div>

            {/* Tipo de Serviço */}
            <div className="space-y-2">
              <Label className="text-xs">Tipo de Serviço {!novoTipos.length && <span className="text-destructive">*</span>}</Label>
              {TIPOS_SINARM.map(t => (
                <label key={t} className="flex items-center gap-2.5 cursor-pointer">
                  <div style={checkboxStyle(novoTipos.includes(t))} onClick={() => toggleNovo(novoTipos, setNovoTipos, t)}>
                    {novoTipos.includes(t) && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7L10 1" stroke="#0a0b0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className={`text-sm ${novoTipos.includes(t) ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{t}</span>
                </label>
              ))}
            </div>

            {/* Armas */}
            <div className="space-y-2">
              <Label className="text-xs">Armas {!novoArmas.length && <span className="text-destructive">*</span>}</Label>
              <div className="grid grid-cols-2 gap-2">
                {ARMAS_OPTS.map(a => (
                  <label key={a} className="flex items-center gap-2.5 cursor-pointer">
                    <div style={checkboxStyle(novoArmas.includes(a))} onClick={() => toggleNovo(novoArmas, setNovoArmas, a)}>
                      {novoArmas.includes(a) && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7L10 1" stroke="#0a0b0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span className={`text-sm ${novoArmas.includes(a) ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{a}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Psicológico */}
            <div className="space-y-2">
              <Label className="text-xs">Psicológico (opcional)</Label>
              <input ref={psicoInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleNovoPsico} />
              <button type="button" onClick={() => psicoInputRef.current?.click()}
                className={`w-full flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed transition-colors ${novoPsicoUrl ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/40"}`}>
                {uploadingPsico ? (
                  <>
                    <Upload className="h-6 w-6 text-primary animate-pulse" />
                    <span className="text-xs text-primary font-semibold">Enviando...</span>
                  </>
                ) : novoPsicoUrl ? (
                  <>
                    <Check className="h-6 w-6 text-primary" />
                    <span className="text-xs text-foreground font-semibold">{novoPsicoFile?.name}</span>
                    <span className="text-[10px] text-muted-foreground">Clique para trocar</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Clique para selecionar PDF ou imagem</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => { handleNovoOpenChange(false); resetNovo(); }}>Cancelar</Button>
            <Button onClick={salvarNovo} disabled={novoSaving || uploadingPsico} className="gap-2">
              <Check className="h-3.5 w-3.5" />
              {novoSaving ? "Salvando..." : "Salvar Cadastro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de edição */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cadastro</DialogTitle>
          </DialogHeader>
          {editData && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome completo *</Label>
                <Input value={editData.nome} onChange={e => setEditData(p => p && ({ ...p, nome: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <Input value={editData.cpf || ""} onChange={e => setEditData(p => p && ({ ...p, cpf: maskCpf(e.target.value) }))} placeholder="000.000.000-00" inputMode="numeric" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Endereço</Label>
                <Input value={editData.endereco || ""} onChange={e => setEditData(p => p && ({ ...p, endereco: e.target.value.toUpperCase() }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nº</Label>
                  <Input value={editData.numero || ""} onChange={e => setEditData(p => p && ({ ...p, numero: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Complemento</Label>
                  <Input value={editData.complemento || ""} onChange={e => setEditData(p => p && ({ ...p, complemento: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input value={editData.bairro || ""} onChange={e => setEditData(p => p && ({ ...p, bairro: e.target.value.toUpperCase() }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={editData.cidade || ""} onChange={e => setEditData(p => p && ({ ...p, cidade: e.target.value.toUpperCase() }))} placeholder="EX: MANAUS" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Input value={editData.estado || ""} onChange={e => setEditData(p => p && ({ ...p, estado: e.target.value.toUpperCase() }))} placeholder="EX: AM" maxLength={2} />
                </div>
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                <Label className="text-xs">Tipo de Serviço</Label>
                {TIPOS_SINARM.map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editTipos.includes(t)} onChange={() => toggleEdit(editTipos, setEditTipos, t)} className="accent-primary" />
                    <span className="text-sm">{t}</span>
                  </label>
                ))}
              </div>

              {/* Armas */}
              <div className="space-y-2">
                <Label className="text-xs">Armas</Label>
                <div className="grid grid-cols-2 gap-1">
                  {ARMAS_OPTS.map(a => (
                    <label key={a} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editArmas.includes(a)} onChange={() => toggleEdit(editArmas, setEditArmas, a)} className="accent-primary" />
                      <span className="text-sm">{a}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

