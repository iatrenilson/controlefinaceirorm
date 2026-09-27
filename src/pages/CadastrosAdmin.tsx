import { useState, useEffect } from "react";
import { Copy, Link, UserPlus, Search, Users, Pencil, Trash2, Check, X, FileDown } from "lucide-react";
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
  tipo_sinarm: string | null;
  armas: string | null;
  psicologico_url: string | null;
  created_at: string;
}

const MIGRATION_SQL = `
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS tipo_sinarm TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS armas TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS psicologico_url TEXT;
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

  const carregar = () =>
    supabase.from("cac_cadastros").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setCadastros(data as CacCadastro[]); setLoading(false); });

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

  const excluirTodos = async () => {
    const { error } = await supabase.from("cac_cadastros").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Todos os cadastros excluídos.");
    setDeletandoTodos(false);
    carregar();
  };

  const filtrados = busca.trim()
    ? cadastros.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.cpf || "").includes(busca))
    : cadastros;

  const fmtData = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
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
                      <p className="font-semibold text-sm truncate">{c.nome}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {c.cpf      && <span>CPF: {c.cpf}</span>}
                        {c.endereco && <span>{c.endereco}{c.numero ? `, Nº ${c.numero}` : ""}{c.complemento ? ` - ${c.complemento}` : ""}</span>}
                        {c.bairro   && <span>Bairro: {c.bairro}</span>}
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
                          const dlUrl = `${c.psicologico_url}?download=${encodeURIComponent(`${c.nome} - Psicológico.${ext}`)}`;
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
                <Input value={editData.nome} onChange={e => setEditData(p => p && ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <Input value={editData.cpf || ""} onChange={e => setEditData(p => p && ({ ...p, cpf: maskCpf(e.target.value) }))} placeholder="000.000.000-00" inputMode="numeric" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Endereço</Label>
                <Input value={editData.endereco || ""} onChange={e => setEditData(p => p && ({ ...p, endereco: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nº</Label>
                  <Input value={editData.numero || ""} onChange={e => setEditData(p => p && ({ ...p, numero: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Complemento</Label>
                  <Input value={editData.complemento || ""} onChange={e => setEditData(p => p && ({ ...p, complemento: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input value={editData.bairro || ""} onChange={e => setEditData(p => p && ({ ...p, bairro: e.target.value }))} />
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
