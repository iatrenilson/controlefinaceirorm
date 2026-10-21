import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { norm } from "@/lib/utils";
import { CADASTRO_GERAL_ATIVO } from "@/lib/constants";
import { Copy, Link, UserPlus, Search, Users, Pencil, Trash2, Check, X, FileDown, ClipboardPen, ClipboardList, ChevronLeft, ChevronRight, Upload, Share2, ToggleLeft, ToggleRight, PlusCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  colaborador_token?: string | null;
  emissao_sabado?: boolean | null;
}

const MIGRATION_SQL = `
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS tipo_sinarm TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS armas TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS psicologico_url TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS colaborador_token TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS emissao_sabado BOOLEAN;
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cac_cadastros' AND policyname='cac_cad_update') THEN
    CREATE POLICY "cac_cad_update" ON public.cac_cadastros FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cac_cadastros' AND policyname='cac_cad_delete') THEN
    CREATE POLICY "cac_cad_delete" ON public.cac_cadastros FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='colaboradores' AND policyname='colab_owner') THEN
    CREATE POLICY "colab_owner" ON public.colaboradores USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.get_colaborador_info(p_token TEXT) RETURNS TABLE(id UUID, nome TEXT, ativo BOOLEAN) SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $f$ BEGIN RETURN QUERY SELECT c.id, c.nome, c.ativo FROM colaboradores c WHERE c.token = p_token LIMIT 1; END; $f$;
CREATE OR REPLACE FUNCTION public.get_cac_cadastros_by_token(p_token TEXT) RETURNS TABLE(id UUID, nome TEXT, cpf TEXT, endereco TEXT, numero TEXT, complemento TEXT, bairro TEXT, cidade TEXT, estado TEXT, tipo_sinarm TEXT, armas TEXT, psicologico_url TEXT, created_at TIMESTAMPTZ, colaborador_token TEXT) SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $f$ BEGIN RETURN QUERY SELECT c.id, c.nome, c.cpf, c.endereco, c.numero, c.complemento, c.bairro, c.cidade, c.estado, c.tipo_sinarm, c.armas, c.psicologico_url, c.created_at, c.colaborador_token FROM cac_cadastros c WHERE c.colaborador_token = p_token ORDER BY c.created_at DESC; END; $f$;
CREATE OR REPLACE FUNCTION public.insert_cac_cadastro_by_token(p_token TEXT, p_nome TEXT, p_cpf TEXT, p_endereco TEXT, p_numero TEXT, p_complemento TEXT, p_bairro TEXT, p_cidade TEXT, p_estado TEXT, p_tipo_sinarm TEXT, p_armas TEXT, p_psicologico_url TEXT) RETURNS UUID SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $f$ DECLARE v_id UUID; BEGIN IF NOT EXISTS (SELECT 1 FROM colaboradores WHERE token = p_token AND ativo = true) THEN RAISE EXCEPTION 'Link invalido ou desativado'; END IF; INSERT INTO cac_cadastros (nome, cpf, endereco, numero, complemento, bairro, cidade, estado, tipo_sinarm, armas, psicologico_url, colaborador_token) VALUES (p_nome, p_cpf, p_endereco, p_numero, p_complemento, p_bairro, p_cidade, p_estado, p_tipo_sinarm, p_armas, p_psicologico_url, p_token) RETURNING id INTO v_id; RETURN v_id; END; $f$;
CREATE OR REPLACE FUNCTION public.update_cac_cadastro_by_token(p_token TEXT, p_id UUID, p_nome TEXT, p_cpf TEXT, p_endereco TEXT, p_numero TEXT, p_complemento TEXT, p_bairro TEXT, p_cidade TEXT, p_estado TEXT, p_tipo_sinarm TEXT, p_armas TEXT) RETURNS VOID SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $f$ BEGIN IF NOT EXISTS (SELECT 1 FROM colaboradores WHERE token = p_token AND ativo = true) THEN RAISE EXCEPTION 'Link invalido ou desativado'; END IF; UPDATE cac_cadastros SET nome = p_nome, cpf = p_cpf, endereco = p_endereco, numero = p_numero, complemento = p_complemento, bairro = p_bairro, cidade = p_cidade, estado = p_estado, tipo_sinarm = p_tipo_sinarm, armas = p_armas WHERE id = p_id AND colaborador_token = p_token; END; $f$;
CREATE OR REPLACE FUNCTION public.delete_cac_cadastro_by_token(p_token TEXT, p_id UUID) RETURNS VOID SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $f$ BEGIN IF NOT EXISTS (SELECT 1 FROM colaboradores WHERE token = p_token AND ativo = true) THEN RAISE EXCEPTION 'Link invalido ou desativado'; END IF; DELETE FROM cac_cadastros WHERE id = p_id AND colaborador_token = p_token; END; $f$;
GRANT EXECUTE ON FUNCTION public.get_colaborador_info(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cac_cadastros_by_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_cac_cadastro_by_token(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_cac_cadastro_by_token(TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_cac_cadastro_by_token(TEXT,UUID) TO anon, authenticated;
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

interface Colaborador { id: string; nome: string; token: string; ativo: boolean; created_at: string; }

// ── Lista de prova ────────────────────────────────────────────────────────
// Provas só às quartas. Para a quarta Q: o que foi cadastrado de sábado (Q-4) até terça (Q-1)
// sai para emissão na quarta; de quarta até sexta (Q+2), para emissão no sábado.
// Cadastro de sábado em diante já entra na lista da quarta seguinte.
// Isso é só o padrão: clicando em "Sábado" na lista, a escolha fica salva no cadastro (emissao_sabado).
const SERVICO_LISTA: Record<string, string> = { "SINARM CAC": "CR", "SINARM POSSE": "Posse", "SINARM PORTE": "Porte" };
const PARTICULAS = ["da", "de", "do", "das", "dos", "e"];

const somaDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// quarta da semana (domingo a sábado) que contém o dia
const quartaDaSemana = (d: Date) => somaDias(d, 3 - d.getDay());
const diaLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const diaMes = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

// "RICARDO DE MATOS CUNHA" → "Ricardo de Matos Cunha"
const nomeProprio = (nome: string) =>
  nome.trim().toLowerCase().split(/\s+/)
    .map((p, i) => i > 0 && PARTICULAS.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

const separar = (v: string | null) => (v || "").split(",").map(s => s.trim()).filter(Boolean);
const juntarE = (l: string[]) => l.length > 1 ? `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}` : l[0] || "";

// "CR Pistola", "Posse Pistola e Rifle"; com as quatro armas sai "CR completo"
const servicoDaLista = (c: CacCadastro) => {
  const armas = separar(c.armas);
  return [
    juntarE(separar(c.tipo_sinarm).map(t => SERVICO_LISTA[t] ?? t)),
    ARMAS_OPTS.every(a => armas.includes(a)) ? "completo" : juntarE(armas),
  ].filter(Boolean).join(" ");
};

function ListaProvaDialog({ open, onOpenChange, cadastros, colaboradores, onSabado }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cadastros: CacCadastro[];
  colaboradores: Colaborador[];
  onSabado: (id: string, sabado: boolean) => void;
}) {
  const [quarta, setQuarta] = useState(() => quartaDaSemana(new Date()));
  const [local, setLocal] = useState(() => { try { return localStorage.getItem("lista_prova_local") ?? "JULIET"; } catch { return "JULIET"; } });
  const [desmarcados, setDesmarcados] = useState<string[]>([]);
  const [editado, setEditado] = useState<string | null>(null);

  useEffect(() => { try { localStorage.setItem("lista_prova_local", local); } catch { /* sem storage */ } }, [local]);

  // sempre abre na semana atual, com a lista montada de novo
  useEffect(() => {
    if (!open) return;
    setQuarta(quartaDaSemana(new Date()));
    setDesmarcados([]);
    setEditado(null);
  }, [open]);

  const nomeColab = (c: CacCadastro) => colaboradores.find(x => x.token === c.colaborador_token)?.nome.trim() || "";

  const sabado = somaDias(quarta, -4), terca = somaDias(quarta, -1), sexta = somaDias(quarta, 2);
  const diaDo = (c: CacCadastro) => diaLocal(new Date(c.created_at));
  const daSemana = cadastros
    .filter(c => diaDo(c) >= diaLocal(sabado) && diaDo(c) <= diaLocal(sexta))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  // a escolha feita na lista vale mais que a regra da data
  const ehSabado = (c: CacCadastro) => c.emissao_sabado ?? diaDo(c) > diaLocal(terca);
  const incluidos = daSemana.filter(c => !desmarcados.includes(c.id));
  // no texto saem primeiro os de emissão na quarta, depois os do sábado
  const selecionados = [...incluidos.filter(c => !ehSabado(c)), ...incluidos.filter(ehSabado)];
  const qtdSabado = incluidos.filter(ehSabado).length;

  const gerado = [
    `📍 LISTA DE PROVA QUARTA${local.trim() ? ` NO ${local.trim()}` : ""} (${diaMes(quarta).replace("/", ".")}.${String(quarta.getFullYear()).slice(2)})`,
    ...selecionados.map((c, i) =>
      [`${i + 1}) ${nomeProprio(c.nome)}`, nomeColab(c) && `(${nomeColab(c)})`, servicoDaLista(c), ehSabado(c) && "[Emissão no sábado]"].filter(Boolean).join(" ")),
  ].join("\n\n");

  // o texto pode ser ajustado à mão; volta a ser montado quando muda semana, local ou clientes
  useEffect(() => { setEditado(null); }, [gerado]);
  const texto = editado ?? gerado;

  const mudarSemana = (n: number) => { setQuarta(q => somaDias(q, n)); setDesmarcados([]); };
  const alternar = (id: string) => setDesmarcados(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id]);
  const estaSemana = diaLocal(quarta) === diaLocal(quartaDaSemana(new Date()));

  const copiar = () => navigator.clipboard.writeText(texto).then(
    () => toast.success("Lista copiada! É só colar no WhatsApp."),
    () => toast.error("Não consegui copiar. Selecione o texto e copie."),
  );
  const podeCompartilhar = typeof navigator.share === "function" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Lista de Prova
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
            <Button variant="ghost" size="icon" onClick={() => mudarSemana(-7)} title="Semana anterior" className="h-8 w-8 shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0 text-center">
              <p className="text-sm font-semibold">Prova de quarta, {diaMes(quarta)}/{quarta.getFullYear()}</p>
              <p className="text-[11px] text-muted-foreground">
                Cadastros de {diaMes(sabado)} a {diaMes(sexta)}{estaSemana ? " · esta semana" : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => mudarSemana(7)} title="Próxima semana" className="h-8 w-8 shrink-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Local</Label>
            <Input value={local} onChange={e => setLocal(e.target.value.toUpperCase())} placeholder="EX: JULIET" className="h-8 text-sm" />
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs">
                Clientes da semana <span className="font-normal text-muted-foreground">· {incluidos.length - qtdSabado} na quarta · {qtdSabado} no sábado</span>
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">Clique em <b>Sábado</b> nos clientes que ficam para emissão no sábado.</p>
            </div>
            {daSemana.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 rounded-lg border border-dashed border-border">Nenhum cadastro nesta semana.</p>
            ) : daSemana.map(c => {
              const marcado = !desmarcados.includes(c.id);
              const sab = ehSabado(c);
              return (
                <div key={c.id} onClick={() => alternar(c.id)}
                  className={`flex items-center gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${marcado ? "border-primary/30 bg-primary/5" : "border-border/60 opacity-60"}`}>
                  <div style={checkboxStyle(marcado)}>
                    {marcado && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7L10 1" stroke="#0a0b0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{nomeProprio(c.nome)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[nomeColab(c), servicoDaLista(c), new Date(c.created_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {marcado && (
                    <button type="button" onClick={e => { e.stopPropagation(); onSabado(c.id, !sab); }}
                      title={sab ? "Emissão no sábado (clique para voltar para a quarta)" : "Marcar emissão no sábado"}
                      className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${sab ? "bg-sky-500 border-sky-500 text-white" : "border-border text-muted-foreground hover:border-sky-500/60 hover:text-sky-400"}`}>
                      {sab && <Check className="h-3 w-3" />}Sábado
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Texto da lista (dá para ajustar antes de copiar)</Label>
            <Textarea value={texto} onChange={e => setEditado(e.target.value)} rows={10} className="text-sm leading-relaxed" />
          </div>
        </div>
        <DialogFooter className="mt-2 flex gap-2">
          {podeCompartilhar && (
            <Button variant="outline" onClick={() => navigator.share({ text: texto }).catch(() => {})} className="gap-2">
              <Share2 className="h-4 w-4" />Compartilhar
            </Button>
          )}
          <Button onClick={copiar} disabled={!selecionados.length} className="flex-1 gap-2">
            <Copy className="h-4 w-4" />Copiar lista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CadastrosAdmin() {
  const [aba, setAba] = useState<"cadastros" | "colaboradores">("cadastros");
  const [cadastros, setCadastros] = useState<CacCadastro[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  // Colaboradores
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [novoColabNome, setNovoColabNome] = useState("");
  const [savingColab, setSavingColab] = useState(false);
  const [deletandoColab, setDeletandoColab] = useState<string | null>(null);
  const [editandoColab, setEditandoColab] = useState<string | null>(null);
  const [editandoColabNome, setEditandoColabNome] = useState("");
  const [filtroColab, setFiltroColab] = useState<{ token: string; nome: string } | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<CacCadastro | null>(null);
  const [editTipos, setEditTipos] = useState<string[]>([]);
  const [editArmas, setEditArmas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [deletandoTodos, setDeletandoTodos] = useState(false);

  const [listaOpen, setListaOpen] = useState(false);

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

  const carregarColaboradores = async () => {
    const { data } = await supabase.from("colaboradores").select("*").order("created_at", { ascending: false });
    if (data) setColaboradores(data as Colaborador[]);
  };

  const criarColaborador = async () => {
    if (!novoColabNome.trim()) { toast.error("Informe o nome do colaborador."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingColab(true);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase.from("colaboradores").insert({
      nome: novoColabNome.trim(),
      token,
      owner_user_id: user.id,
    });
    setSavingColab(false);
    if (error) { toast.error("Erro ao criar colaborador: " + error.message); return; }
    toast.success("Colaborador criado!");
    setNovoColabNome("");
    carregarColaboradores();
  };

  const toggleAtivoColab = async (c: Colaborador) => {
    const { error } = await supabase.from("colaboradores").update({ ativo: !c.ativo }).eq("id", c.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    carregarColaboradores();
  };

  const excluirColaborador = async (id: string) => {
    const { error } = await supabase.from("colaboradores").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Colaborador excluído.");
    setDeletandoColab(null);
    carregarColaboradores();
  };

  const salvarNomeColab = async (id: string) => {
    if (!editandoColabNome.trim()) { toast.error("Informe o nome."); return; }
    const { error } = await supabase.from("colaboradores").update({ nome: editandoColabNome.trim() }).eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Nome atualizado.");
    setEditandoColab(null);
    carregarColaboradores();
  };

  const copiarLinkColab = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/area/${token}`);
    toast.success("Link copiado!");
  };

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
    supabase.functions.invoke("run-migration", { body: { sql: MIGRATION_SQL } }).finally(() => { carregar(); carregarColaboradores(); });

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

  const toggleNovo = (list: string[], setList: (v: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

  const resetNovo = () => {
    setNovoNome(""); setNovoCpf(""); setNovoEndereco(""); setNovoNumero("");
    setNovoComplemento(""); setNovoBairro(""); setNovoCidade(""); setNovoEstado("");
    setNovoTipos([]); setNovoArmas([]);
    setNovoPsicoFile(null); setNovoPsicoUrl(null);
    setCacBusca(""); setCacDropOpen(false); setCacSelecionado(null);
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

  // Lista de Prova: marca/desmarca emissão no sábado e salva no cadastro
  const marcarSabado = async (id: string, sabado: boolean) => {
    setCadastros(l => l.map(c => c.id === id ? { ...c, emissao_sabado: sabado } : c));
    const { error } = await supabase.from("cac_cadastros").update({ emissao_sabado: sabado }).eq("id", id);
    if (error) { toast.error("Não consegui salvar: " + error.message); carregar(); }
  };

  const filtrados = cadastros
    .filter(c => !filtroColab || c.colaborador_token === filtroColab.token)
    .filter(c => !busca.trim() || norm(c.nome).includes(norm(busca)) || (c.cpf || "").includes(busca));

  const fmtData = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-12 z-10">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
          <Users className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <h1 className="text-base sm:text-lg font-bold tracking-tight">Cadastros</h1>
          </div>
          {aba === "cadastros" && (
            <>
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
                  <span className="hidden sm:inline">Excluir todos</span>
                </Button>
              )}
              <Button onClick={() => setListaOpen(true)} size="sm" variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Lista de Prova</span>
              </Button>
              <Button onClick={() => setNovoOpen(true)} size="sm" className="gap-2">
                <ClipboardPen className="h-4 w-4" />
                <span className="hidden sm:inline">Cadastro Manual</span>
              </Button>
              <Button onClick={copiarLink} size="sm" variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
                <Link className="h-4 w-4" />
                <span className="hidden sm:inline">Copiar link</span>
              </Button>
            </>
          )}
        </div>
        {/* Tabs */}
        <div className="flex border-t">
          <button
            onClick={() => setAba("cadastros")}
            className={`flex-1 text-xs font-medium py-2 px-4 transition-colors flex items-center justify-center gap-1.5 ${aba === "cadastros" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="h-3.5 w-3.5" />
            Cadastros ({cadastros.length})
          </button>
          <button
            onClick={() => setAba("colaboradores")}
            className={`flex-1 text-xs font-medium py-2 px-4 transition-colors flex items-center justify-center gap-1.5 ${aba === "colaboradores" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Share2 className="h-3.5 w-3.5" />
            Colaboradores ({colaboradores.length})
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 max-w-3xl mx-auto space-y-4">

      {aba === "colaboradores" ? (
        /* ── ABA COLABORADORES ─────────────────────────────────── */
        <div className="space-y-4">
          {/* Criar novo colaborador */}
          <Card>
            <CardContent className="py-4 px-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-primary" />
                Criar link para colaborador
              </p>
              <p className="text-xs text-muted-foreground">
                Cada colaborador recebe um link único. Ele acessa sem precisar de login e gerencia só os clientes dele.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do colaborador (ex: Maria, João)"
                  value={novoColabNome}
                  onChange={e => setNovoColabNome(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && criarColaborador()}
                  className="flex-1"
                />
                <Button onClick={criarColaborador} disabled={savingColab} className="shrink-0 gap-1.5">
                  <PlusCircle className="h-4 w-4" />
                  {savingColab ? "Criando..." : "Criar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de colaboradores */}
          {colaboradores.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Share2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum colaborador ainda.</p>
              <p className="text-xs mt-1">Crie um link acima para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {colaboradores.map(c => (
                <Card key={c.id} className={c.ativo ? "" : "opacity-60"}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setFiltroColab({ token: c.token, nome: c.nome }); setAba("cadastros"); }} title="Ver clientes deste colaborador">
                        {editandoColab === c.id ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              autoFocus
                              value={editandoColabNome}
                              onChange={e => setEditandoColabNome(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") salvarNomeColab(c.id); if (e.key === "Escape") setEditandoColab(null); }}
                              className="h-7 text-sm"
                            />
                            <button onClick={() => salvarNomeColab(c.id)} className="p-1 rounded text-green-500 hover:bg-green-500/10"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditandoColab(null)} className="p-1 rounded text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm hover:text-primary transition-colors">{c.nome}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${c.ativo ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}`}>
                              {c.ativo ? "Ativo" : "Inativo"}
                            </span>
                            <span className="text-[10px] text-muted-foreground hidden sm:inline">— clique para ver clientes</span>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                          {window.location.origin}/area/{c.token}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => copiarLinkColab(c.token)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-primary/40 text-primary text-xs font-medium hover:bg-primary/10 transition-colors"
                          title="Copiar link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Copiar</span>
                        </button>
                        <button
                          onClick={() => { setEditandoColab(c.id); setEditandoColabNome(c.nome); }}
                          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar nome"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleAtivoColab(c)}
                          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"
                          title={c.ativo ? "Desativar" : "Ativar"}
                        >
                          {c.ativo
                            ? <ToggleRight className="h-5 w-5 text-green-500" />
                            : <ToggleLeft className="h-5 w-5" />
                          }
                        </button>
                        {deletandoColab === c.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => excluirColaborador(c.id)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive text-white text-[10px] font-semibold hover:opacity-90">
                              <Check className="h-3 w-3" />Sim
                            </button>
                            <button onClick={() => setDeletandoColab(null)} className="flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-semibold hover:bg-accent">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletandoColab(c.id)}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Excluir colaborador"
                          >
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
        </div>
      ) : (
        /* ── ABA CADASTROS ─────────────────────────────────────── */
        <>

        {/* Link */}
        {CADASTRO_GERAL_ATIVO ? (
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
        ) : (
          <Card className="border-border/40 bg-muted/10">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <UserPlus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Link geral de cadastro <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 text-[10px] font-semibold">SUSPENSO</span></p>
                  <p className="text-sm font-mono text-muted-foreground/60 truncate line-through">{LINK_CADASTRO}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Use os links dos colaboradores (aba Colaboradores).</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtro por colaborador ativo */}
        {filtroColab && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-sm">
            <Users className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span className="flex-1 text-primary font-medium">Filtrando: <span className="font-bold">{filtroColab.nome}</span></span>
            <button onClick={() => setFiltroColab(null)} className="text-primary hover:opacity-70 transition-opacity">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

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
        </>
      )}
      </main>

      <ListaProvaDialog open={listaOpen} onOpenChange={setListaOpen} cadastros={cadastros} colaboradores={colaboradores} onSabado={marcarSabado} />

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
              <Label className="text-xs">Laudo Psicológico</Label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => psicoInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  {novoPsicoFile ? novoPsicoFile.name.slice(0, 24) + "…" : "Anexar PDF"}
                </button>
                {uploadingPsico && <span className="text-xs text-muted-foreground">Enviando…</span>}
                {novoPsicoUrl && !uploadingPsico && <span className="text-xs text-green-500">✓ Enviado</span>}
                {novoPsicoFile && !uploadingPsico && (
                  <button type="button" onClick={() => { setNovoPsicoFile(null); setNovoPsicoUrl(null); }}
                    className="text-xs text-destructive hover:underline">Remover</button>
                )}
              </div>
              <input ref={psicoInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleNovoPsico} />
            </div>
          </div>

          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => { handleNovoOpenChange(false); resetNovo(); }}>Cancelar</Button>
            <Button onClick={salvarNovo} disabled={novoSaving} className="flex-1">
              {novoSaving ? "Salvando..." : "Salvar Cadastro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de edição */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cadastro</DialogTitle>
          </DialogHeader>
          {editData && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome completo</Label>
                <Input value={editData.nome} onChange={e => setEditData({ ...editData, nome: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <Input value={editData.cpf || ""} onChange={e => setEditData({ ...editData, cpf: maskCpf(e.target.value) })} inputMode="numeric" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Endereço</Label>
                <Input value={editData.endereco || ""} onChange={e => setEditData({ ...editData, endereco: e.target.value.toUpperCase() })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nº</Label>
                  <Input value={editData.numero || ""} onChange={e => setEditData({ ...editData, numero: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Complemento</Label>
                  <Input value={editData.complemento || ""} onChange={e => setEditData({ ...editData, complemento: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input value={editData.bairro || ""} onChange={e => setEditData({ ...editData, bairro: e.target.value.toUpperCase() })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={editData.cidade || ""} onChange={e => setEditData({ ...editData, cidade: e.target.value.toUpperCase() })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Input value={editData.estado || ""} onChange={e => setEditData({ ...editData, estado: e.target.value.toUpperCase() })} maxLength={2} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Tipo de Serviço</Label>
                {TIPOS_SINARM.map(t => (
                  <label key={t} className="flex items-center gap-2.5 cursor-pointer">
                    <div style={checkboxStyle(editTipos.includes(t))} onClick={() => toggleEdit(editTipos, setEditTipos, t)}>
                      {editTipos.includes(t) && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7L10 1" stroke="#0a0b0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span className={`text-sm ${editTipos.includes(t) ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{t}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Armas</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ARMAS_OPTS.map(a => (
                    <label key={a} className="flex items-center gap-2.5 cursor-pointer">
                      <div style={checkboxStyle(editArmas.includes(a))} onClick={() => toggleEdit(editArmas, setEditArmas, a)}>
                        {editArmas.includes(a) && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7L10 1" stroke="#0a0b0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span className={`text-sm ${editArmas.includes(a) ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{a}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
