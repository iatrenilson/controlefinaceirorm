import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, UserPlus, Search, Users, Check, X } from "lucide-react";

const TIPOS_SINARM = [
  "Registro de Arma",
  "Transferência",
  "Aquisição",
  "Renovação CR",
  "Autorização de Porte",
  "Outros",
];

const ARMAS_LISTA = [
  "Pistola",
  "Revólver",
  "Espingarda",
  "Rifle",
  "Carabina",
  "Outros",
];

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

interface Cliente {
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

interface FormState {
  nome: string;
  cpf: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  tipos: string[];
  armas: string[];
}

const formVazio = (): FormState => ({
  nome: "", cpf: "", endereco: "", numero: "", complemento: "",
  bairro: "", cidade: "", estado: "AM", tipos: [], armas: [],
});

export default function ColaboradorPortal() {
  const { token } = useParams<{ token: string }>();
  const [colaborador, setColaborador] = useState<{ nome: string; ativo: boolean } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState(false);

  const [novoOpen, setNovoOpen] = useState(false);
  const [form, setForm] = useState<FormState>(formVazio());

  const [editando, setEditando] = useState<Cliente | null>(null);
  const [editForm, setEditForm] = useState<FormState>(formVazio());

  const [deletandoId, setDeletandoId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    verificarToken();
  }, [token]);

  async function verificarToken() {
    setCarregando(true);
    const { data, error } = await supabase.rpc("get_colaborador_info", { p_token: token });
    if (error || !data || data.length === 0) {
      setColaborador(null);
      setCarregando(false);
      return;
    }
    const info = data[0] as { nome: string; ativo: boolean };
    setColaborador(info);
    if (info.ativo) await carregar();
    setCarregando(false);
  }

  async function carregar() {
    const { data, error } = await supabase.rpc("get_cac_cadastros_by_token", { p_token: token });
    if (!error && data) setClientes(data as Cliente[]);
  }

  function toggleTipo(t: string, lista: string[], setLista: (v: string[]) => void) {
    setLista(lista.includes(t) ? lista.filter(x => x !== t) : [...lista, t]);
  }

  async function salvarNovo() {
    if (!form.nome.trim()) { toast.error("Informe o nome."); return; }
    if (!form.endereco.trim()) { toast.error("Informe o endereço."); return; }
    if (!form.numero.trim()) { toast.error("Informe o número."); return; }
    if (!form.bairro.trim()) { toast.error("Informe o bairro."); return; }
    if (!form.cidade.trim()) { toast.error("Informe a cidade."); return; }
    if (!form.tipos.length) { toast.error("Selecione ao menos um Tipo de Serviço."); return; }
    if (!form.armas.length) { toast.error("Selecione ao menos uma Arma."); return; }
    setSaving(true);
    const { error } = await supabase.rpc("insert_cac_cadastro_by_token", {
      p_token: token,
      p_nome: form.nome.trim(),
      p_cpf: form.cpf.trim() || null,
      p_endereco: form.endereco.trim() || null,
      p_numero: form.numero.trim() || null,
      p_complemento: form.complemento.trim() || null,
      p_bairro: form.bairro.trim() || null,
      p_cidade: form.cidade.trim() || null,
      p_estado: form.estado.trim() || null,
      p_tipo_sinarm: form.tipos.join(", ") || null,
      p_armas: form.armas.join(", ") || null,
      p_psicologico_url: null,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Cliente cadastrado!");
    setForm(formVazio());
    setNovoOpen(false);
    carregar();
  }

  function abrirEdicao(c: Cliente) {
    setEditando(c);
    setEditForm({
      nome: c.nome || "",
      cpf: c.cpf || "",
      endereco: c.endereco || "",
      numero: c.numero || "",
      complemento: c.complemento || "",
      bairro: c.bairro || "",
      cidade: c.cidade || "",
      estado: c.estado || "AM",
      tipos: c.tipo_sinarm ? c.tipo_sinarm.split(", ").map(s => s.trim()).filter(Boolean) : [],
      armas: c.armas ? c.armas.split(", ").map(s => s.trim()).filter(Boolean) : [],
    });
  }

  async function salvarEdicao() {
    if (!editando) return;
    if (!editForm.nome.trim()) { toast.error("Informe o nome."); return; }
    setSaving(true);
    const { error } = await supabase.rpc("update_cac_cadastro_by_token", {
      p_token: token,
      p_id: editando.id,
      p_nome: editForm.nome.trim(),
      p_cpf: editForm.cpf.trim() || null,
      p_endereco: editForm.endereco.trim() || null,
      p_numero: editForm.numero.trim() || null,
      p_complemento: editForm.complemento.trim() || null,
      p_bairro: editForm.bairro.trim() || null,
      p_cidade: editForm.cidade.trim() || null,
      p_estado: editForm.estado.trim() || null,
      p_tipo_sinarm: editForm.tipos.join(", ") || null,
      p_armas: editForm.armas.join(", ") || null,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
    toast.success("Cliente atualizado!");
    setEditando(null);
    carregar();
  }

  async function excluir(id: string) {
    const { error } = await supabase.rpc("delete_cac_cadastro_by_token", { p_token: token, p_id: id });
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Cliente excluído.");
    setDeletandoId(null);
    carregar();
  }

  const clientesFiltrados = clientes.filter(c =>
    !busca || c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (c.cpf || "").includes(busca)
  );

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!colaborador) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-sm mx-4">
          <X className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">Link inválido</h2>
          <p className="text-muted-foreground text-sm">Este link não existe ou foi removido.</p>
        </Card>
      </div>
    );
  }

  if (!colaborador.ativo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-sm mx-4">
          <X className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">Link desativado</h2>
          <p className="text-muted-foreground text-sm">Este link foi desativado. Contate o administrador.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs text-muted-foreground">Portal do Colaborador</p>
          <h1 className="font-bold text-base leading-tight">{colaborador.nome}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{clientes.length} cliente{clientes.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Ações */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome ou CPF..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          <Button onClick={() => { setForm(formVazio()); setNovoOpen(true); }} className="shrink-0 gap-1.5">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Cliente</span>
          </Button>
        </div>

        {/* Lista */}
        {clientesFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {clientesFiltrados.map(c => (
              <Card key={c.id}>
                <CardContent className="p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{c.nome}</p>
                    {c.cpf && <p className="text-xs text-muted-foreground">{c.cpf}</p>}
                    {c.cidade && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[c.endereco, c.numero, c.bairro, c.cidade, c.estado].filter(Boolean).join(", ")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.tipo_sinarm && c.tipo_sinarm.split(", ").map(t => (
                        <span key={t} className="text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5">{t}</span>
                      ))}
                      {c.armas && c.armas.split(", ").map(a => (
                        <span key={a} className="text-[10px] bg-muted rounded px-1.5 py-0.5">{a}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => abrirEdicao(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletandoId(c.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal Novo */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <FormFields form={form} setForm={setForm} />
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={salvarNovo} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={!!editando} onOpenChange={v => { if (!v) setEditando(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <FormFields form={editForm} setForm={setEditForm} />
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação Exclusão */}
      <Dialog open={!!deletandoId} onOpenChange={v => { if (!v) setDeletandoId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este cliente?</p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeletandoId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deletandoId && excluir(deletandoId)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormFields({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const set = (k: keyof FormState, v: string) => setForm({ ...form, [k]: v });
  const toggle = (k: "tipos" | "armas", v: string) => {
    const lista = form[k] as string[];
    setForm({ ...form, [k]: lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v] });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Nome Completo *</Label>
        <Input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome completo" />
      </div>
      <div>
        <Label>CPF</Label>
        <Input value={form.cpf} onChange={e => set("cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 sm:col-span-1">
          <Label>Endereço *</Label>
          <Input value={form.endereco} onChange={e => set("endereco", e.target.value)} placeholder="Rua / Av." />
        </div>
        <div>
          <Label>Número *</Label>
          <Input value={form.numero} onChange={e => set("numero", e.target.value)} placeholder="Nº" />
        </div>
        <div>
          <Label>Complemento</Label>
          <Input value={form.complemento} onChange={e => set("complemento", e.target.value)} placeholder="Apto, Casa..." />
        </div>
        <div>
          <Label>Bairro *</Label>
          <Input value={form.bairro} onChange={e => set("bairro", e.target.value)} placeholder="Bairro" />
        </div>
        <div>
          <Label>Cidade *</Label>
          <Input value={form.cidade} onChange={e => set("cidade", e.target.value)} placeholder="Cidade" />
        </div>
        <div>
          <Label>Estado</Label>
          <Input value={form.estado} onChange={e => set("estado", e.target.value.toUpperCase().slice(0, 2))} placeholder="AM" maxLength={2} />
        </div>
      </div>
      <div>
        <Label>Tipo de Serviço *</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {TIPOS_SINARM.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => toggle("tipos", t)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${form.tipos.includes(t) ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"}`}
            >
              {form.tipos.includes(t) && <Check className="inline w-3 h-3 mr-0.5" />}
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Armas *</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {ARMAS_LISTA.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => toggle("armas", a)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${form.armas.includes(a) ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"}`}
            >
              {form.armas.includes(a) && <Check className="inline w-3 h-3 mr-0.5" />}
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
