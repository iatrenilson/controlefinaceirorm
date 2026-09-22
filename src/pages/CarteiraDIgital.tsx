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

interface CartDoc { tipo: TipoKey; arquivo_path: string; arquivo_nome: string; }
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
CREATE OR REPLACE FUNCTION public.get_carteira_v2(p_id UUID) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$ DECLARE result JSON; BEGIN SELECT json_build_object('id',c.id,'nome',c.nome,'docs',COALESCE((SELECT json_agg(json_build_object('tipo',d.tipo,'arquivo_path',d.arquivo_path,'arquivo_nome',d.arquivo_nome) ORDER BY d.tipo) FROM public.carteira_docs d WHERE d.carteira_cliente_id=c.id),'[]'::json)) INTO result FROM public.carteira_clientes c WHERE c.id=p_id; RETURN result; END; $fn$;
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
`.trim();

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
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
  const [docs, setDocs] = useState<Record<TipoKey, CartDoc | null>>({
    cr:   cliente?.docs?.find(d => d.tipo === "cr")   ?? null,
    craf: cliente?.docs?.find(d => d.tipo === "craf") ?? null,
    gt:   cliente?.docs?.find(d => d.tipo === "gt")   ?? null,
  });
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
    const path = `${cliente.id}/${tipo}.pdf`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error("Erro ao enviar arquivo: " + error.message); setUploading(null); return; }
    await supabase.from("carteira_docs").upsert({ carteira_cliente_id: cliente.id, tipo, arquivo_path: path, arquivo_nome: file.name }, { onConflict: "carteira_cliente_id,tipo" });
    setDocs(d => ({ ...d, [tipo]: { tipo, arquivo_path: path, arquivo_nome: file.name } }));
    setUploading(null);
    toast.success(`${tipo.toUpperCase()} enviado!`);
  };

  const handleRemoveDoc = async (tipo: TipoKey) => {
    if (!cliente?.id) return;
    await supabase.storage.from(BUCKET).remove([`${cliente.id}/${tipo}.pdf`]);
    await supabase.from("carteira_docs").delete().eq("carteira_cliente_id", cliente.id).eq("tipo", tipo);
    setDocs(d => ({ ...d, [tipo]: null }));
    toast.success(`${tipo.toUpperCase()} removido.`);
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
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documentos</p>
              {TIPOS.map(({ key, label, desc }) => {
                const doc = docs[key];
                return (
                  <div key={key} className="flex items-center justify-between gap-2 p-3 rounded-xl border bg-background/50 border-border">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className={`h-4 w-4 flex-shrink-0 ${doc ? "text-green-400" : "text-muted-foreground"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{doc ? doc.arquivo_nome : desc}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {doc && (
                        <a href={publicUrl(doc.arquivo_path)} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Ver">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {doc && (
                        <button onClick={() => handleRemoveDoc(key)} className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remover">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <input ref={refs[key]} type="file" accept="application/pdf,image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(key, f); e.target.value = ""; }} />
                      <button onClick={() => refs[key].current?.click()} disabled={uploading === key}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors disabled:opacity-50">
                        {uploading === key ? "..." : <><Upload className="h-3 w-3" />{doc ? "Trocar" : "Enviar"}</>}
                      </button>
                    </div>
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
      ? await supabase.from("carteira_docs").select("carteira_cliente_id, tipo, arquivo_path, arquivo_nome").in("carteira_cliente_id", ids)
      : { data: [] };
    setClientes(cs.map(c => ({ ...c, docs: (ds ?? []).filter(d => d.carteira_cliente_id === c.id) as CartDoc[] })));
    setLoading(false);
  };

  useEffect(() => {
    const FLAG = "carteira_migration_v3";
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
