import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, ExternalLink, Wallet } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  doc:      "Doc. CR",
  docaut:   "Doc. Aut.",
  deferido: "CR defer.",
  analise:  "CR Analise",
  autor:    "Aut. Analise",
  craf:     "Craf. Analise",
  completo: "Concluído",
};

const STATUS_COLORS: Record<string, string> = {
  doc:      "text-blue-300 bg-blue-500/10 border-blue-400/40",
  docaut:   "text-blue-200 bg-blue-400/10 border-blue-300/40",
  deferido: "text-red-300 bg-red-500/10 border-red-400/40",
  analise:  "text-green-300 bg-green-500/10 border-green-400/40",
  autor:    "text-yellow-300 bg-yellow-500/10 border-yellow-400/40",
  craf:     "text-purple-300 bg-purple-500/10 border-purple-400/40",
  completo: "text-emerald-300 bg-emerald-500/10 border-emerald-400/40",
};

interface Cliente { id: string; nome: string; status?: string; dataEntradaProcesso?: string; }

function CopyLinkBtn({ clienteId }: { clienteId: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${import.meta.env.BASE_URL}carteira/${clienteId}`;
  const copy = () => {
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="flex items-center gap-1">
      <button onClick={copy} title="Copiar link da carteira"
        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copiado!" : "Copiar link"}
      </button>
      <a href={link} target="_blank" rel="noopener noreferrer" title="Abrir carteira"
        className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

export default function CarteiraDIgital() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    // Cria a função pública get_carteira_cliente se ainda não existir
    const FLAG = "carteira_fn_v1";
    if (!localStorage.getItem(FLAG)) {
      supabase.functions.invoke("run-migration", {
        body: {
          sql: `
CREATE OR REPLACE FUNCTION public.get_carteira_cliente(p_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'id', id, 'nome', nome, 'status', status,
    'dataEntradaProcesso', "dataEntradaProcesso",
    'dataDeferimento', "dataDeferimento",
    'cidade', cidade, 'estado', estado
  ) INTO result FROM public.declaracao_clientes WHERE id = p_id;
  RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_carteira_cliente(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_carteira_cliente(UUID) TO authenticated;
          `.trim()
        }
      }).then(() => localStorage.setItem(FLAG, "1")).catch(() => {});
    }

    supabase.from("declaracao_clientes")
      .select("id, nome, status, dataEntradaProcesso")
      .order("nome")
      .then(({ data }) => { setClientes(data ?? []); setLoading(false); });
  }, []);

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Wallet className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Carteira Digital</h1>
          <p className="text-sm text-muted-foreground">Compartilhe o link da carteira com seus clientes</p>
        </div>
      </div>

      <input
        placeholder="Buscar cliente..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        className="w-full mb-4 px-3 py-2 text-sm rounded-lg border bg-card border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
      />

      {loading ? (
        <p className="text-muted-foreground text-sm text-center py-8">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">Nenhum cliente encontrado.</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map(c => {
            const status = c.status ?? "doc";
            const corClass = STATUS_COLORS[status] ?? STATUS_COLORS.doc;
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-card border-border hover:border-primary/30 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{c.nome}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold mt-1 ${corClass}`}>
                    {STATUS_LABELS[status] ?? status}
                  </span>
                </div>
                <CopyLinkBtn clienteId={c.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
