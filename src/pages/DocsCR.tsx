import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileCheck2, FileX2, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DOCS_CR = [
  { id: "cap_tecnica",      label: "Comprovante de Capacidade Técnica",                            tag: "" },
  { id: "ant_federal",      label: "Certidão de Antecedente Criminal - Justiça Federal",            tag: "" },
  { id: "decl_inquerito",   label: "Declaração de não estar respondendo a inquérito policial",      tag: "DESPACHANTE" },
  { id: "doc_ident",        label: "Documento de Identificação Pessoal",                            tag: "" },
  { id: "laudo_psico",      label: "Laudo de Aptidão Psicológica",                                 tag: "" },
  { id: "comp_residencia",  label: "Comprovante de Residência Fixa",                               tag: "DESPACHANTE*" },
  { id: "comp_ocupacao",    label: "Comprovante de Ocupação Lícita",                               tag: "" },
  { id: "comp_2_end",       label: "Comprovante de 2º Endereço de Guarda do Acervo",               tag: "DESPACHANTE" },
  { id: "ant_estadual",     label: "Certidão de Antecedente Criminal - Justiça Estadual",          tag: "" },
  { id: "anexo_a",          label: "Anexo A / Declaração de Segurança do Acervo",                  tag: "CLUBE" },
  { id: "decl_habitualidade", label: "Declaração de Habitualidade na Forma da Norma Vigente",      tag: "CLUBE" },
  { id: "comp_filiacao",    label: "Comprovante de Filiação a Entidade de Tiro Desportivo",        tag: "CLUBE" },
  { id: "ant_militar",      label: "Certidão de Antecedente Criminal - Justiça Militar",           tag: "" },
  { id: "ant_eleitoral",    label: "Certidão de Antecedente Criminal - Justiça Eleitoral",         tag: "" },
] as const;

type DocCRTipo = typeof DOCS_CR[number]["id"];

interface DocCRItem {
  id: string;
  tipo: DocCRTipo;
  fileName: string;
  storagePath: string;
  fileUrl: string;
}

interface ClienteRow {
  id: string;
  nome: string;
}

export default function DocsCR() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [docsCliente, setDocsCliente] = useState<Map<string, DocCRItem[]>>(new Map());
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows } = await supabase
        .from("declaracao_clientes")
        .select("id, nome")
        .order("nome", { ascending: true });

      const lista: ClienteRow[] = (rows ?? []).map(r => ({ id: r.id, nome: r.nome ?? "" }));
      setClientes(lista);

      if (lista.length > 0) {
        const ids = lista.map(c => c.id);
        const { data: docRows } = await supabase
          .from("declaracao_docs_cr")
          .select("id, cliente_id, tipo, file_name, storage_path, file_url")
          .in("cliente_id", ids);

        const map = new Map<string, DocCRItem[]>();
        for (const r of (docRows ?? [])) {
          const item: DocCRItem = {
            id: r.id,
            tipo: r.tipo as DocCRTipo,
            fileName: r.file_name ?? "",
            storagePath: r.storage_path ?? "",
            fileUrl: r.file_url ?? "",
          };
          const arr = map.get(r.cliente_id) ?? [];
          arr.push(item);
          map.set(r.cliente_id, arr);
        }
        setDocsCliente(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const totalDocs = DOCS_CR.length;
  const completos = clientes.filter(c => (docsCliente.get(c.id) ?? []).length === totalDocs).length;
  const parciais = clientes.filter(c => {
    const n = (docsCliente.get(c.id) ?? []).length;
    return n > 0 && n < totalDocs;
  }).length;
  const sem = clientes.filter(c => (docsCliente.get(c.id) ?? []).length === 0).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Documentos CR</h1>
          <p className="text-sm text-muted-foreground">Controle dos 14 documentos por cliente</p>
        </div>
        <button
          onClick={fetchDados}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{completos}</p>
            <p className="text-xs text-muted-foreground">Completos</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{parciais}</p>
            <p className="text-xs text-muted-foreground">Parciais</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{sem}</p>
            <p className="text-xs text-muted-foreground">Sem docs</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Clientes</CardTitle>
            <span className="text-xs text-muted-foreground">({clientes.length})</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
          ) : clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum cliente cadastrado.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground min-w-[160px] sticky left-0 bg-muted/30">Cliente</th>
                      <th className="px-2 py-2 font-semibold text-center text-muted-foreground min-w-[40px]">OK</th>
                      {DOCS_CR.map((d, i) => (
                        <th key={d.id} className="px-1 py-2 text-center min-w-[28px]" title={d.label}>
                          <span className="text-[10px] text-muted-foreground font-bold">{i + 1}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map(c => {
                      const docs = docsCliente.get(c.id) ?? [];
                      const ok = docs.length;
                      const cor = ok === DOCS_CR.length ? "text-green-400" : ok > 0 ? "text-yellow-400" : "text-muted-foreground";
                      return (
                        <tr key={c.id} className="border-b border-border/20 hover:bg-muted/10">
                          <td className="px-3 py-2 font-semibold truncate max-w-[200px] sticky left-0 bg-card">{c.nome}</td>
                          <td className={`px-2 py-2 text-center font-bold ${cor}`}>{ok}/{DOCS_CR.length}</td>
                          {DOCS_CR.map(d => {
                            const item = docs.find(x => x.tipo === d.id);
                            return (
                              <td key={d.id} className="px-1 py-2 text-center">
                                {item
                                  ? <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" title={`${d.label} — ${item.fileName}`}><FileCheck2 className="h-3.5 w-3.5 text-green-400 mx-auto" /></a>
                                  : <FileX2 className="h-3.5 w-3.5 text-red-400/40 mx-auto" />}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 border-t border-border/20 bg-muted/10">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {DOCS_CR.map((d, i) => (
                    <span key={d.id} className="text-[10px] text-muted-foreground">
                      <span className="font-bold text-foreground">{i + 1}</span> — {d.label}
                      {d.tag ? <span className="text-amber-400/70 ml-1">({d.tag})</span> : ""}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
