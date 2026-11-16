import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil, Check, X, StickyNote, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usuarioAtual } from "@/lib/usuarioAtual";

// Anotações manuais de nomes por assunto (CR, Autorização de Compra...). São PESSOAIS: cada usuário tem a sua,
// em app_config, chave "anotacoes_<id do usuário>". O banco (RLS) só deixa cada um ler e gravar a própria
interface Item { id: string; texto: string; feito: boolean; em: string }
interface Lista { id: string; nome: string; itens: Item[] }

const LISTAS_PADRAO = ["CR", "Autorização de Compra", "Renovação de CRAF", "GT", "Interessados"];
const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const listasIniciais = (): Lista[] => LISTAS_PADRAO.map(nome => ({ id: novoId(), nome, itens: [] }));

// Cada mudança é uma "receita" (função) aplicada por cima da versão mais nova do banco na hora de salvar,
// assim quem está com a tela desatualizada não apaga o que outra pessoa acabou de fazer
type Mudanca = (l: Lista) => Lista;

function CartaoLista({ lista, onMudar, onExcluir, onPegar, onMover }: {
  lista: Lista;
  onMudar: (m: Mudanca) => void;
  onExcluir: () => void;
  onPegar: (e: React.DragEvent) => void;      // começa a arrastar a lista pela alça
  onMover: (passo: -1 | 1) => void;           // setas (no celular não dá para arrastar)
}) {
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);   // id do item, ou "titulo"
  const [textoEdit, setTextoEdit] = useState("");
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);

  const adicionar = () => {
    const t = novo.trim();
    if (!t) return;
    const item: Item = { id: novoId(), texto: t, feito: false, em: new Date().toISOString() };
    onMudar(l => ({ ...l, itens: [...l.itens, item] }));
    setNovo("");
  };
  const mudarItem = (id: string, m: Partial<Item>) =>
    onMudar(l => ({ ...l, itens: l.itens.map(i => (i.id === id ? { ...i, ...m } : i)) }));
  const salvarEdicao = () => {
    const t = textoEdit.trim();
    if (t) {
      if (editando === "titulo") onMudar(l => ({ ...l, nome: t }));
      else if (editando) mudarItem(editando, { texto: t });
    }
    setEditando(null);
  };
  const teclaEdicao = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") salvarEdicao();
    if (e.key === "Escape") setEditando(null);
  };
  const pendentes = lista.itens.filter(i => !i.feito).length;

  return (
    <Card className="flex flex-col" data-cartao onDragEnd={() => window.dispatchEvent(new Event("anotacoes-soltou"))}>
      <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex items-center gap-2">
          {editando === "titulo" ? (
            <Input autoFocus className="h-8 text-sm font-semibold" value={textoEdit}
              onChange={e => setTextoEdit(e.target.value)} onKeyDown={teclaEdicao} onBlur={salvarEdicao} />
          ) : (
            <>
              <span draggable onDragStart={onPegar} title="Arraste para mudar a lista de lugar"
                className="-ml-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hidden sm:inline-flex">
                <GripVertical className="h-4 w-4" />
              </span>
              <button onClick={() => onMover(-1)} title="Mover para trás" className="p-0.5 rounded text-muted-foreground hover:bg-accent sm:hidden"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => onMover(1)} title="Mover para frente" className="p-0.5 rounded text-muted-foreground hover:bg-accent sm:hidden"><ChevronRight className="h-4 w-4" /></button>
              <h2 className="font-bold text-primary flex-1 truncate">{lista.nome}</h2>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {pendentes}{lista.itens.length !== pendentes ? ` de ${lista.itens.length}` : ""}
              </span>
              <button onClick={() => { setEditando("titulo"); setTextoEdit(lista.nome); }} title="Renomear"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
              {confirmarExcluir ? (
                <span className="flex items-center gap-1">
                  <button onClick={onExcluir} className="px-1.5 py-0.5 rounded bg-destructive text-white text-[10px] font-semibold">Excluir</button>
                  <button onClick={() => setConfirmarExcluir(false)} className="p-0.5 rounded hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
                </span>
              ) : (
                <button onClick={() => setConfirmarExcluir(true)} title="Excluir esta lista"
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Input className="h-9 text-sm" placeholder="Adicionar nome…" value={novo}
            onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") adicionar(); }} />
          <Button size="sm" className="h-9 px-3" onClick={adicionar} title="Adicionar"><Plus className="h-4 w-4" /></Button>
        </div>

        {lista.itens.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Nenhum nome ainda.</p>
        ) : (
          <ul className="space-y-1">
            {lista.itens.map(i => (
              <li key={i.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40">
                <button onClick={() => mudarItem(i.id, { feito: !i.feito })} title={i.feito ? "Desmarcar" : "Marcar como feito"}
                  className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${i.feito ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/50"}`}>
                  {i.feito && <Check className="h-3 w-3" />}
                </button>
                {editando === i.id ? (
                  <Input autoFocus className="h-7 text-sm" value={textoEdit}
                    onChange={e => setTextoEdit(e.target.value)} onKeyDown={teclaEdicao} onBlur={salvarEdicao} />
                ) : (
                  <>
                    <span className={`flex-1 text-sm break-words ${i.feito ? "line-through text-muted-foreground" : ""}`}>{i.texto}</span>
                    <button onClick={() => { setEditando(i.id); setTextoEdit(i.texto); }} title="Editar"
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => onMudar(l => ({ ...l, itens: l.itens.filter(x => x.id !== i.id) }))} title="Apagar"
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function Anotacoes() {
  const [listas, setListas] = useState<Lista[] | null>(null);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novaLista, setNovaLista] = useState("");
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const listasRef = useRef<Lista[] | null>(null);   // o que está na tela agora (para as gravações em fila)
  const chaveRef = useRef<string | null>(null);     // "anotacoes_<id do usuário logado>"
  const pendentes = useRef(0);                      // gravações ainda não terminadas
  const geracao = useRef(0);                        // sobe a cada mudança feita aqui
  // Arrastar uma lista (pela alça) e soltar sobre outra: ela passa a ocupar o lugar daquela
  const [arrastada, setArrastada] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const arrastandoRef = useRef(false);
  arrastandoRef.current = !!arrastada;

  const mostrar = (ls: Lista[]) => {
    if (JSON.stringify(ls) === JSON.stringify(listasRef.current)) return;   // nada mudou: não redesenha
    listasRef.current = ls;
    setListas(ls);
  };

  // Lê a versão do banco. Devolve null se der erro (aí NUNCA grava por cima, para não apagar nada)
  const lerBanco = async (): Promise<{ listas: Lista[] | null; em: string | null } | null> => {
    if (!chaveRef.current) {
      const u = await usuarioAtual();
      if (!u) return null;
      chaveRef.current = "anotacoes_" + u.id;
    }
    const { data, error } = await supabase.from("app_config" as any).select("valor, updated_at").eq("chave", chaveRef.current).maybeSingle();
    if (error) return null;
    const salvo = (data as any)?.valor?.listas as Lista[] | undefined;
    return { listas: salvo?.length ? salvo : null, em: (data as any)?.updated_at ?? null };
  };

  // Busca o que os outros usuários mudaram (ao abrir, a cada 8 s com a aba visível e ao voltar para a aba).
  // Não mexe na tela enquanto há gravação desta pessoa em andamento ou uma lista sendo arrastada
  useEffect(() => {
    let vivo = true;
    const atualizar = async (primeira = false) => {
      if (!primeira && (document.visibilityState !== "visible" || pendentes.current > 0 || arrastandoRef.current)) return;
      const g = geracao.current;
      const r = await lerBanco();
      if (!vivo) return;
      if (!r) {
        if (primeira) { setErroCarregar(true); toast.error("Não consegui carregar as anotações. Tentando de novo…"); }
        return;
      }
      // Se a pessoa mudou algo enquanto esta leitura viajava, ela já está velha: descarta
      if (pendentes.current > 0 || arrastandoRef.current || g !== geracao.current) return;
      setErroCarregar(false);
      if (r.listas) mostrar(r.listas);
      else if (!listasRef.current) mostrar(listasIniciais());
    };
    atualizar(true);
    const t = window.setInterval(() => atualizar(), 8000);
    const aoVoltar = () => { if (document.visibilityState === "visible") atualizar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      vivo = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, []);

  // Cada mudança aparece na hora na tela e entra numa fila. Na vez dela: lê a versão mais nova do banco,
  // aplica só esta mudança por cima e grava. Se outra pessoa gravou no meio tempo, tenta de novo.
  const gravar = (mudar: (ls: Lista[]) => Lista[]) => {
    if (!listasRef.current) return;
    const local = mudar(listasRef.current);
    listasRef.current = local;
    setListas(local);
    geracao.current++;
    pendentes.current++;
    setSalvando(true);
    fila.current = fila.current.then(async () => {
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        const r = await lerBanco();
        if (!r) throw new Error("sem conexão com o banco");
        if (!r.listas || !r.em) {
          // Ainda não existe nada salvo: grava o que está na tela (que já tem esta mudança)
          const { error } = await supabase.from("app_config" as any)
            .insert({ chave: chaveRef.current, valor: { listas: local }, updated_at: new Date().toISOString() });
          if (!error) return local;
          continue;   // alguém criou ao mesmo tempo: lê de novo
        }
        const final = mudar(r.listas);
        const { data, error } = await supabase.from("app_config" as any)
          .update({ valor: { listas: final }, updated_at: new Date().toISOString() })
          .eq("chave", chaveRef.current).eq("updated_at", r.em).select("chave");
        if (error) throw error;
        if ((data as any[])?.length) return final;   // gravou
        // 0 linhas: outra pessoa gravou entre a leitura e a gravação. Tenta de novo com a versão nova
      }
      throw new Error("muitas pessoas salvando ao mesmo tempo, tente de novo");
    }).then(
      (final) => { if (pendentes.current === 1 && final) mostrar(final as Lista[]); },
      (e: any) => toast.error("Não consegui salvar: " + (e?.message ?? e)),
    ).finally(() => {
      pendentes.current--;
      if (pendentes.current === 0) setSalvando(false);
    });
  };

  const criarLista = () => {
    const nome = novaLista.trim();
    if (!nome || !listas) return;
    const nova: Lista = { id: novoId(), nome, itens: [] };
    gravar(ls => [...ls, nova]);
    setNovaLista("");
  };

  // Põe a lista "id" no lugar onde está a lista "alvoId" (pelo id, não pela posição, que pode ter mudado)
  const moverPara = (id: string, alvoId: string | undefined) => {
    if (!alvoId || id === alvoId) return;
    gravar(ls => {
      const de = ls.findIndex(l => l.id === id);
      const para = ls.findIndex(l => l.id === alvoId);
      if (de < 0 || para < 0) return ls;
      const novas = [...ls];
      const [l] = novas.splice(de, 1);
      novas.splice(para, 0, l);
      return novas;
    });
  };

  useEffect(() => {
    const fim = () => { setArrastada(null); setSobre(null); };
    window.addEventListener("anotacoes-soltou", fim);
    return () => window.removeEventListener("anotacoes-soltou", fim);
  }, []);

  if (!listas) return <div className="p-4 text-sm text-muted-foreground">{erroCarregar ? "Não consegui carregar as anotações. Tentando de novo…" : "Carregando…"}</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-bold flex items-center gap-2"><StickyNote className="h-5 w-5 text-primary" />Anotações</h1>
          <p className="text-sm text-muted-foreground">Suas anotações, por assunto. Só você vê. {salvando ? "Salvando…" : "Tudo salvo."}</p>
        </div>
        <div className="flex gap-2">
          <Input className="h-9 text-sm w-48" placeholder="Nova lista…" value={novaLista}
            onChange={e => setNovaLista(e.target.value)} onKeyDown={e => { if (e.key === "Enter") criarLista(); }} />
          <Button size="sm" className="h-9 gap-1" onClick={criarLista}><Plus className="h-4 w-4" />Lista</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 items-start">
        {listas.map((l, idx) => (
          <div key={l.id}
            className={`rounded-lg transition-all ${arrastada === l.id ? "opacity-40" : ""} ${sobre === l.id && arrastada !== l.id ? "ring-2 ring-primary" : ""}`}
            onDragOver={e => { if (!arrastada) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (sobre !== l.id) setSobre(l.id); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(s => (s === l.id ? null : s)); }}
            onDrop={e => { if (!arrastada) return; e.preventDefault(); moverPara(arrastada, l.id); setArrastada(null); setSobre(null); }}>
            <CartaoLista lista={l}
              onMudar={m => gravar(ls => ls.map(x => (x.id === l.id ? m(x) : x)))}
              onExcluir={() => gravar(ls => ls.filter(x => x.id !== l.id))}
              onPegar={e => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", l.nome);
                const cartao = (e.currentTarget as HTMLElement).closest("[data-cartao]");
                if (cartao) e.dataTransfer.setDragImage(cartao, 20, 20);
                setArrastada(l.id);
              }}
              onMover={passo => moverPara(l.id, listas[idx + passo]?.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
