import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil, Check, X, StickyNote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Anotações manuais de nomes por assunto (CR, Autorização de Compra...). Ficam no banco, em app_config (chave
// "anotacoes"), num documento só: mesma tabela dos dados do contratado, sem tabela nova
interface Item { id: string; texto: string; feito: boolean; em: string }
interface Lista { id: string; nome: string; itens: Item[] }

const CHAVE = "anotacoes";
const LISTAS_PADRAO = ["CR", "Autorização de Compra", "Renovação de CRAF", "GT", "Interessados"];
const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const listasIniciais = (): Lista[] => LISTAS_PADRAO.map(nome => ({ id: novoId(), nome, itens: [] }));

function CartaoLista({ lista, onMudar, onExcluir }: {
  lista: Lista;
  onMudar: (l: Lista) => void;
  onExcluir: () => void;
}) {
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);   // id do item, ou "titulo"
  const [textoEdit, setTextoEdit] = useState("");
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);

  const adicionar = () => {
    const t = novo.trim();
    if (!t) return;
    onMudar({ ...lista, itens: [...lista.itens, { id: novoId(), texto: t, feito: false, em: new Date().toISOString() }] });
    setNovo("");
  };
  const mudarItem = (id: string, m: Partial<Item>) =>
    onMudar({ ...lista, itens: lista.itens.map(i => (i.id === id ? { ...i, ...m } : i)) });
  const salvarEdicao = () => {
    const t = textoEdit.trim();
    if (t) {
      if (editando === "titulo") onMudar({ ...lista, nome: t });
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
    <Card className="flex flex-col">
      <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex items-center gap-2">
          {editando === "titulo" ? (
            <Input autoFocus className="h-8 text-sm font-semibold" value={textoEdit}
              onChange={e => setTextoEdit(e.target.value)} onKeyDown={teclaEdicao} onBlur={salvarEdicao} />
          ) : (
            <>
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
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(i.em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                    <button onClick={() => { setEditando(i.id); setTextoEdit(i.texto); }} title="Editar"
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => onMudar({ ...lista, itens: lista.itens.filter(x => x.id !== i.id) })} title="Apagar"
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
  const [salvando, setSalvando] = useState(false);
  const [novaLista, setNovaLista] = useState("");
  const fila = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    supabase.from("app_config" as any).select("valor").eq("chave", CHAVE).maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error("Não consegui carregar as anotações: " + error.message);
        const salvo = (data as any)?.valor?.listas as Lista[] | undefined;
        setListas(salvo?.length ? salvo : listasIniciais());
      });
  }, []);

  // Cada mudança grava o documento inteiro; as gravações vão em fila, na ordem em que foram feitas
  const gravar = (novas: Lista[]) => {
    setListas(novas);
    setSalvando(true);
    fila.current = fila.current.then(async () => {
      const { error } = await supabase.from("app_config" as any)
        .upsert({ chave: CHAVE, valor: { listas: novas }, updated_at: new Date().toISOString() });
      if (error) toast.error("Não consegui salvar: " + error.message);
    }).finally(() => setSalvando(false));
  };

  const criarLista = () => {
    const nome = novaLista.trim();
    if (!nome || !listas) return;
    gravar([...listas, { id: novoId(), nome, itens: [] }]);
    setNovaLista("");
  };

  if (!listas) return <div className="p-4 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-bold flex items-center gap-2"><StickyNote className="h-5 w-5 text-primary" />Anotações</h1>
          <p className="text-sm text-muted-foreground">Nomes anotados à mão, por assunto. {salvando ? "Salvando…" : "Tudo salvo."}</p>
        </div>
        <div className="flex gap-2">
          <Input className="h-9 text-sm w-48" placeholder="Nova lista…" value={novaLista}
            onChange={e => setNovaLista(e.target.value)} onKeyDown={e => { if (e.key === "Enter") criarLista(); }} />
          <Button size="sm" className="h-9 gap-1" onClick={criarLista}><Plus className="h-4 w-4" />Lista</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 items-start">
        {listas.map(l => (
          <CartaoLista key={l.id} lista={l}
            onMudar={nova => gravar(listas.map(x => (x.id === l.id ? nova : x)))}
            onExcluir={() => gravar(listas.filter(x => x.id !== l.id))} />
        ))}
      </div>
    </div>
  );
}
