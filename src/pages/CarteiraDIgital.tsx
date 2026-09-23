import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, ExternalLink, Wallet, Plus, Trash2, Upload, FileText, Pencil, X } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "carteira-docs";
const SUPABASE_URL = "https://qubkmecpxbsdphtmwvvw.supabase.co";

const TIPOS = [
  { key: "cr",   label: "CR",           desc: "Certificado de Registro" },
  { key: "craf", label: "CRAF da Arma", desc: "Certificado de Registro de Arma de Fogo" },
  { key: "gt",   label: "GT",           desc: "Guia de Tráfego" },
] as const;

type TipoKey = "cr" | "craf" | "gt";

interface CartDoc { id: string; tipo: TipoKey; arquivo_path: string; arquivo_nome: string; data_expedicao?: string; data_validade?: string; numero_serie?: string; }
interface CartCliente { id: string; nome: string; telefone?: string; cpf?: string; docs?: CartDoc[]; }

const MIGRATION_SQL = `
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.carteira_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL, telefone TEXT, cpf TEXT,
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE public.carteira_clientes ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_clientes' AND policyname='cc_sel') THEN CREATE POLICY "cc_sel" ON public.carteira_clientes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND owner_id=auth.uid())); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_clientes' AND policyname='cc_ins') THEN CREATE POLICY "cc_ins" ON public.carteira_clientes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND owner_id=auth.uid())); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_clientes' AND policyname='cc_upd') THEN CREATE POLICY "cc_upd" ON public.carteira_clientes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND owner_id=auth.uid())); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_clientes' AND policyname='cc_del') THEN CREATE POLICY "cc_del" ON public.carteira_clientes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND owner_id=auth.uid())); END IF;
  CREATE TABLE IF NOT EXISTS public.carteira_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carteira_cliente_id UUID REFERENCES public.carteira_clientes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, arquivo_path TEXT, arquivo_nome TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(carteira_cliente_id, tipo)
  );
  ALTER TABLE public.carteira_docs ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_docs' AND policyname='cd_sel') THEN CREATE POLICY "cd_sel" ON public.carteira_docs FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.carteira_clientes c WHERE c.id=carteira_cliente_id AND (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND c.owner_id=auth.uid())))); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_docs' AND policyname='cd_ins') THEN CREATE POLICY "cd_ins" ON public.carteira_docs FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.carteira_clientes c WHERE c.id=carteira_cliente_id AND (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND c.owner_id=auth.uid())))); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_docs' AND policyname='cd_upd') THEN CREATE POLICY "cd_upd" ON public.carteira_docs FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.carteira_clientes c WHERE c.id=carteira_cliente_id AND (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND c.owner_id=auth.uid())))); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carteira_docs' AND policyname='cd_del') THEN CREATE POLICY "cd_del" ON public.carteira_docs FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM public.carteira_clientes c WHERE c.id=carteira_cliente_id AND (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'moderator') AND c.owner_id=auth.uid())))); END IF;
  PERFORM pg_notify('pgrst','reload schema');
END $$;
CREATE OR REPLACE FUNCTION public.get_carteira_v2(p_id UUID) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$ DECLARE result JSON; BEGIN SELECT json_build_object('id',c.id,'nome',c.nome,'docs',COALESCE((SELECT json_agg(json_build_object('id',d.id,'tipo',d.tipo,'arquivo_path',d.arquivo_path,'arquivo_nome',d.arquivo_nome,'data_expedicao',d.data_expedicao,'data_validade',d.data_validade,'numero_serie',d.numero_serie) ORDER BY d.tipo,d.created_at) FROM public.carteira_docs d WHERE d.carteira_cliente_id=c.id),'[]'::json)) INTO result FROM public.carteira_clientes c WHERE c.id=p_id; RETURN result; END; $fn$;
GRANT EXECUTE ON FUNCTION public.get_carteira_v2(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_carteira_v2(UUID) TO authenticated;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('carteira-docs', 'carteira-docs', true, 52428800, NULL)
  ON CONFLICT (id) DO UPDATE SET public = true;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='carteira_docs_public_select') THEN
    CREATE POLICY "carteira_docs_public_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'carteira-docs');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='carteira_docs_auth_insert') THEN
    CREATE POLICY "carteira_docs_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'carteira-docs');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='carteira_docs_auth_update') THEN
    CREATE POLICY "carteira_docs_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'carteira-docs');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='carteira_docs_auth_delete') THEN
    CREATE POLICY "carteira_docs_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'carteira-docs');
  END IF;
END $$;
ALTER TABLE public.carteira_docs DROP CONSTRAINT IF EXISTS carteira_docs_carteira_cliente_id_tipo_key;
ALTER TABLE public.carteira_docs ADD COLUMN IF NOT EXISTS data_expedicao TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carteira_docs ADD COLUMN IF NOT EXISTS data_validade TEXT NOT NULL DEFAULT '';
ALTER TABLE public.carteira_docs ADD COLUMN IF NOT EXISTS numero_serie TEXT NOT NULL DEFAULT '';
`.trim();

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(); s.onerror = reject;
    document.head.appendChild(s);
  });
}

const MESES_BR: Record<string, string> = {
  janeiro: "01", fevereiro: "02", março: "03", abril: "04",
  maio: "05", junho: "06", julho: "07", agosto: "08",
  setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

async function extrairDatasDocPDF(file: File): Promise<{ exp: string; val: string; serie: string }> {
  try {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    const lib = (window as any).pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await lib.getDocument({ data: bytes }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map((item: any) => item.str).join(" ") + " ";
    }

    const norm = (d: string) => d.replace(/[\-\.]/g, "/");
    const txtToDate = (day: string, mon: string, yr: string) => {
      const m = MESES_BR[mon.toLowerCase()];
      return m ? `${day.padStart(2, "0")}/${m}/${yr}` : "";
    };

    let exp = "";
    let val = "";
    let serie = "";

    // Expedição — numérico
    const eNum = fullText.match(/(?:EXPEDI[CÇ][AÃ]O|EXPEDIDA\s+EM|DATA\s+DE\s+EXPEDI[CÇ]|EMISS[AÃ]O|EMITID)[^\d]{0,40}(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i);
    if (eNum) exp = norm(eNum[1]);
    else {
      const eTxt = fullText.match(/(?:EXPEDI[CÇ][AÃ]O|EXPEDIDA\s+EM|DATA\s+DE\s+EXPEDI[CÇ]|EMISS[AÃ]O|EMITID)[^\d]{0,60}(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
      if (eTxt) exp = txtToDate(eTxt[1], eTxt[2], eTxt[3]);
    }

    // Validade — detecta intervalo "DD/MM/YYYY [a|à] DD/MM/YYYY" primeiro (formato GT)
    const rangeMatch = fullText.match(/(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})\s+[aà]\s+(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i);
    if (rangeMatch) {
      val = norm(rangeMatch[2]); // só a data final
    } else {
      // Validade — data única com palavra-chave
      const VAL_REGEX = /(?:V[AÁ]LID[OA](?:\s+\w+){0,5}\s+AT[EÉ]|VALIDADE|VENCIMENTO|PRAZO\s+DE\s+VALID|TRANSPORTE\s+AT[EÉ])[^\d]{0,50}(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i;
      const vNum = fullText.match(VAL_REGEX);
      if (vNum) val = norm(vNum[1]);
      else {
        const VAL_TXT = /(?:V[AÁ]LID[OA](?:\s+\w+){0,5}\s+AT[EÉ]|VALIDADE|VENCIMENTO|PRAZO\s+DE\s+VALID|TRANSPORTE\s+AT[EÉ])[^\d]{0,70}(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i;
        const vTxt = fullText.match(VAL_TXT);
        if (vTxt) val = txtToDate(vTxt[1], vTxt[2], vTxt[3]);
      }
    }

    // Número de série da arma
    const seriePatterns = [
      /(?:N[UÚ]MERO\s+DE\s+S[EÉ]RIE|N[.ºo°]\s*DE\s+S[EÉ]RIE|S[EÉ]RIE)[:\s]+([A-Z]{0,3}\d{4,}[A-Z\d\-]*)/i,
      /(?:N[.ºo°]\s*DA\s+ARMA|ARMA\s+N[.ºo°])[:\s]+([A-Z]{0,3}\d{4,}[A-Z\d\-]*)/i,
      /(?:(?:CRAF|GT|GUIA|REGISTRO)\s*N[.ºo°]?)[:\s]+([A-Z]{0,3}\d{4,}[A-Z\d\-]*)/i,
    ];
    for (const pat of seriePatterns) {
      const m = fullText.match(pat);
      if (m) { serie = m[1].trim().replace(/\s+/g, ""); break; }
    }

    // Fallback: ordena datas cronologicamente — a mais antiga = expedição, a mais recente = validade
    if (!val) {
      const rawDates = [...new Set((fullText.match(/\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}/g) ?? []).map(norm))];
      const parsed = rawDates
        .map(s => { const [d, m, y] = s.split("/").map(Number); return { str: s, ts: new Date(y, m - 1, d).getTime() }; })
        .filter(x => !isNaN(x.ts))
        .sort((a, b) => a.ts - b.ts);
      if (!exp && parsed.length > 0) exp = parsed[0].str;
      const candidates = parsed.filter(x => x.str !== exp);
      if (candidates.length > 0) val = candidates[candidates.length - 1].str;
    }

    return { exp, val, serie };
  } catch {
    return { exp: "", val: "", serie: "" };
  }
}

function CopyLinkBtn({ clienteId }: { clienteId: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${import.meta.env.BASE_URL}carteira/${clienteId}`;
  const copy = () => {
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="flex items-center gap-1">
      <button onClick={copy} title="Copiar link" className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copiado!" : "Link"}
      </button>
      <a href={`${window.location.origin}${import.meta.env.BASE_URL}carteira/${clienteId}`} target="_blank" rel="noopener noreferrer"
        className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Abrir carteira">
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function DocItem({ doc, index, total, onRemove, onSaveDatas }: {
  doc: CartDoc; index: number; total: number;
  onRemove: (doc: CartDoc) => void;
  onSaveDatas: (doc: CartDoc, exp: string, val: string, serie: string) => void;
}) {
  const [val, setVal] = useState(doc.data_validade ?? "");
  const [serie, setSerie] = useState(doc.numero_serie ?? "");
  const dirty = val !== (doc.data_validade ?? "") || serie !== (doc.numero_serie ?? "");
  return (
    <div className="px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground truncate min-w-0 flex-1">{total > 1 ? `${index + 1}. ` : ""}{doc.arquivo_nome}</p>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <a href={publicUrl(doc.arquivo_path)} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Ver">
            <ExternalLink className="h-3 w-3" />
          </a>
          <button onClick={() => onRemove(doc)} className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remover">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground block mb-0.5">Validade</label>
          <input value={val} onChange={e => setVal(e.target.value)} placeholder="dd/mm/aaaa"
            className="w-full px-2 py-1 text-xs rounded border bg-background border-border focus:outline-none focus:ring-1 focus:ring-primary/30" />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground block mb-0.5">Nº Série</label>
          <input value={serie} onChange={e => setSerie(e.target.value)} placeholder="Ex: AB123456"
            className="w-full px-2 py-1 text-xs rounded border bg-background border-border focus:outline-none focus:ring-1 focus:ring-primary/30" />
        </div>
        <button onClick={() => onSaveDatas(doc, doc.data_expedicao ?? "", val, serie)} disabled={!dirty}
          className="mt-4 px-2 py-1 text-xs rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors disabled:opacity-30 flex-shrink-0">
          Salvar
        </button>
      </div>
    </div>
  );
}

interface DialogProps {
  cliente?: CartCliente | null;
  onClose: () => void;
  onSaved: () => void;
}

interface SinarmCliente { id: string; nome: string; cpf?: string; }

function ClienteDialog({ cliente, onClose, onSaved }: DialogProps) {
  const [nome, setNome] = useState(cliente?.nome ?? "");
  const [telefone, setTelefone] = useState(cliente?.telefone ?? "");
  const [cpf, setCpf] = useState(cliente?.cpf ?? "");
  const [docs, setDocs] = useState<CartDoc[]>(cliente?.docs ?? []);
  const [uploading, setUploading] = useState<TipoKey | null>(null);
  const [saving, setSaving] = useState(false);
  const refs = { cr: useRef<HTMLInputElement>(null), craf: useRef<HTMLInputElement>(null), gt: useRef<HTMLInputElement>(null) };

  // Sinarm CAC selector (only for new clients)
  const [sinarmList, setSinarmList] = useState<SinarmCliente[]>([]);
  const [sinarmBusca, setSinarmBusca] = useState("");
  const [sinarmOpen, setSinarmOpen] = useState(false);
  const sinarmRef = useRef<HTMLDivElement>(null);
  const isNew = !cliente?.id;

  useEffect(() => {
    if (!isNew) return;
    supabase.from("declaracao_clientes").select("id, nome, cpf").order("nome").then(({ data }) => {
      if (data) setSinarmList(data as SinarmCliente[]);
    });
  }, [isNew]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sinarmRef.current && !sinarmRef.current.contains(e.target as Node)) setSinarmOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sinarmFiltrados = sinarmBusca.trim()
    ? sinarmList.filter(c => c.nome.toLowerCase().includes(sinarmBusca.toLowerCase()) || (c.cpf ?? "").includes(sinarmBusca))
    : sinarmList;

  const selecionarSinarm = (c: SinarmCliente) => {
    setNome(c.nome);
    setCpf(c.cpf ?? "");
    setSinarmBusca(c.nome + (c.cpf ? ` · ${c.cpf}` : ""));
    setSinarmOpen(false);
  };

  const handleFile = async (tipo: TipoKey, file: File) => {
    if (!cliente?.id) { toast.error("Salve o cliente primeiro antes de enviar documentos."); return; }
    setUploading(tipo);
    const ext = file.name.split('.').pop() || 'pdf';
    const path = `${cliente.id}/${tipo}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (error) { toast.error("Erro ao enviar arquivo: " + error.message); setUploading(null); return; }

    let data_expedicao = "";
    let data_validade = "";
    let numero_serie = "";
    if (file.type === "application/pdf") {
      const datas = await extrairDatasDocPDF(file);
      data_expedicao = datas.exp;
      data_validade = datas.val;
      numero_serie = datas.serie;
    }

    const { data: newDoc } = await supabase.from("carteira_docs")
      .insert({ carteira_cliente_id: cliente.id, tipo, arquivo_path: path, arquivo_nome: file.name, data_expedicao, data_validade, numero_serie })
      .select().single();
    if (newDoc) setDocs(d => [...d, newDoc as CartDoc]);
    setUploading(null);
    const msg = data_validade
      ? `${tipo.toUpperCase()} enviado! Dados extraídos automaticamente.`
      : `${tipo.toUpperCase()} enviado! Preencha a validade manualmente.`;
    toast.success(msg);
  };

  const handleRemoveDoc = async (doc: CartDoc) => {
    if (!cliente?.id) return;
    await supabase.storage.from(BUCKET).remove([doc.arquivo_path]);
    await supabase.from("carteira_docs").delete().eq("id", doc.id);
    setDocs(d => d.filter(x => x.id !== doc.id));
    toast.success(`Documento removido.`);
  };

  const handleSaveDatas = async (doc: CartDoc, exp: string, val: string, serie: string) => {
    await supabase.from("carteira_docs").update({ data_expedicao: exp, data_validade: val, numero_serie: serie }).eq("id", doc.id);
    setDocs(d => d.map(x => x.id === doc.id ? { ...x, data_expedicao: exp, data_validade: val, numero_serie: serie } : x));
    toast.success("Salvo.");
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Informe o nome do cliente."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (cliente?.id) {
      await supabase.from("carteira_clientes").update({ nome: nome.trim(), telefone: telefone.trim() || null, cpf: cpf.trim() || null }).eq("id", cliente.id);
    } else {
      const { data, error } = await supabase.from("carteira_clientes").insert({ nome: nome.trim(), telefone: telefone.trim() || null, cpf: cpf.trim() || null, owner_id: user?.id }).select().single();
      if (error || !data) { toast.error("Erro ao salvar: " + error?.message); setSaving(false); return; }
      toast.success("Cliente cadastrado! Agora envie os documentos.");
      setSaving(false);
      onSaved();
      return;
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-base">{isNew ? "Novo Cliente" : "Editar Cliente"}</h2>
          <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Seleção Sinarm CAC */}
          {isNew && sinarmList.length > 0 && (
            <div ref={sinarmRef} className="relative">
              <label className="text-xs text-muted-foreground mb-1 block">Selecionar cliente cadastrado</label>
              <input
                value={sinarmBusca}
                onChange={e => { setSinarmBusca(e.target.value); setSinarmOpen(true); }}
                onFocus={() => setSinarmOpen(true)}
                placeholder="— Selecionar cliente cadastrado —"
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {sinarmOpen && sinarmFiltrados.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-52 overflow-y-auto">
                  {sinarmFiltrados.map(c => (
                    <button key={c.id} type="button" onMouseDown={() => selecionarSinarm(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors border-b border-border/50 last:border-0">
                      <span className="font-medium">{c.nome}</span>
                      {c.cpf && <span className="text-muted-foreground"> · {c.cpf}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dados */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome completo *</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João da Silva"
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background border-border focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
                <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(92) 99999-9999"
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background border-border focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">CPF</label>
                <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00"
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background border-border focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          </div>

          {/* Documentos — só mostra após salvar */}
          {!isNew && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documentos</p>
              {TIPOS.map(({ key, label, desc }) => {
                const tipoDocs = docs.filter(d => d.tipo === key);
                return (
                  <div key={key} className="rounded-xl border bg-background/50 border-border overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className={`h-4 w-4 flex-shrink-0 ${tipoDocs.length > 0 ? "text-green-400" : "text-muted-foreground"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{label}</p>
                          <p className="text-[10px] text-muted-foreground">{desc}</p>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <input ref={refs[key]} type="file" accept="application/pdf,image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(key, f); e.target.value = ""; }} />
                        <button onClick={() => refs[key].current?.click()} disabled={uploading === key}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors disabled:opacity-50">
                          {uploading === key ? "..." : <><Plus className="h-3 w-3" />Adicionar</>}
                        </button>
                      </div>
                    </div>
                    {tipoDocs.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/50 px-3 py-2">Nenhum arquivo enviado</p>
                    ) : (
                      <div className="divide-y divide-border/30">
                        {tipoDocs.map((doc, i) => (
                          <DocItem key={doc.id} doc={doc} index={i} total={tipoDocs.length} onRemove={handleRemoveDoc} onSaveDatas={handleSaveDatas} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isNew && (
            <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-3">
              💡 Após salvar, você poderá enviar os documentos (CR, CRAF da Arma, GT).
            </p>
          )}
        </div>
        <div className="p-5 pt-0 flex gap-2 justify-end border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors disabled:opacity-60">
            {saving ? "Salvando..." : isNew ? "Cadastrar" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CarteiraDIgital() {
  const [clientes, setClientes] = useState<CartCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [dialog, setDialog] = useState<CartCliente | null | "novo">(null);
  const [migrated, setMigrated] = useState(false);

  const load = async () => {
    const { data: cs } = await supabase.from("carteira_clientes").select("id, nome, telefone, cpf").order("nome");
    if (!cs) { setLoading(false); return; }
    const ids = cs.map(c => c.id);
    const { data: ds } = ids.length > 0
      ? await supabase.from("carteira_docs").select("id, carteira_cliente_id, tipo, arquivo_path, arquivo_nome, data_expedicao, data_validade, numero_serie").in("carteira_cliente_id", ids)
      : { data: [] };
    setClientes(cs.map(c => ({ ...c, docs: (ds ?? []).filter(d => d.carteira_cliente_id === c.id) as CartDoc[] })));
    setLoading(false);
  };

  useEffect(() => {
    const FLAG = "carteira_migration_v6";
    if (!localStorage.getItem(FLAG)) {
      supabase.functions.invoke("run-migration", { body: { sql: MIGRATION_SQL } })
        .then(() => { localStorage.setItem(FLAG, "1"); setMigrated(true); })
        .catch(() => setMigrated(true));
    } else {
      setMigrated(true);
    }
  }, []);

  useEffect(() => { if (migrated) load(); }, [migrated]);

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este cliente e todos os documentos?")) return;
    await supabase.from("carteira_clientes").delete().eq("id", id);
    setClientes(c => c.filter(x => x.id !== id));
    toast.success("Cliente removido.");
  };

  const filtrados = clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Carteira Digital</h1>
            <p className="text-xs text-muted-foreground">CR · CRAF da Arma · GT</p>
          </div>
        </div>
        <button onClick={() => setDialog("novo")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors flex-shrink-0">
          <Plus className="h-3.5 w-3.5" />Novo Cliente
        </button>
      </div>

      <input placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)}
        className="w-full mb-4 px-3 py-2 text-sm rounded-lg border bg-card border-border focus:outline-none focus:ring-2 focus:ring-primary/30" />

      {loading ? (
        <p className="text-muted-foreground text-sm text-center py-10">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhum cliente na Carteira Digital.</p>
          <p className="text-xs mt-1">Clique em "Novo Cliente" para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(c => {
            const docsOk = TIPOS.filter(t => c.docs?.some(d => d.tipo === t.key));
            return (
              <div key={c.id} className="p-3 rounded-xl border bg-card border-border hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{c.nome}</p>
                    {c.telefone && <p className="text-xs text-muted-foreground">{c.telefone}</p>}
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {TIPOS.map(t => {
                        const ok = c.docs?.some(d => d.tipo === t.key);
                        return (
                          <span key={t.key} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ok ? "text-green-400 bg-green-500/10 border-green-500/30" : "text-muted-foreground/50 bg-muted/20 border-muted/20"}`}>
                            {t.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <CopyLinkBtn clienteId={c.id} />
                    <button onClick={() => setDialog(c)} className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remover">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialog !== null && (
        <ClienteDialog
          cliente={dialog === "novo" ? null : dialog}
          onClose={() => setDialog(null)}
          onSaved={() => { load(); if (dialog === "novo") setDialog(null); }}
        />
      )}
    </div>
  );
}
