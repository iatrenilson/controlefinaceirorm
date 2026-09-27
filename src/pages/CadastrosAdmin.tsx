import { useState, useEffect } from "react";
import { Copy, Link, UserPlus, Search, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  created_at: string;
}

const LINK_CADASTRO = `${window.location.origin}/cadastro`;

export default function CadastrosAdmin() {
  const [cadastros, setCadastros] = useState<CacCadastro[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("cac_cadastros")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setCadastros(data as CacCadastro[]);
        setLoading(false);
      });
  }, []);

  const copiarLink = () => {
    navigator.clipboard.writeText(LINK_CADASTRO).then(() => {
      toast.success("Link copiado! Envie para o cliente preencher.");
    });
  };

  const filtrados = busca.trim()
    ? cadastros.filter(c =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (c.cpf || "").includes(busca)
      )
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
          <Button onClick={copiarLink} size="sm" variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
            <Link className="h-4 w-4" />
            Copiar link de cadastro
          </Button>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 max-w-3xl mx-auto space-y-4">

        {/* Link de cadastro */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <UserPlus className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Link para enviar ao cliente</p>
                <p className="text-sm font-mono text-primary truncate">{LINK_CADASTRO}</p>
              </div>
              <button
                onClick={copiarLink}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou CPF..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* Lista */}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {busca ? "Nenhum cadastro encontrado." : "Nenhum cadastro ainda."}
          </p>
        ) : (
          <div className="space-y-3">
            {filtrados.map(c => (
              <Card key={c.id} className="border-border/60">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
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
                    </div>
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">{fmtData(c.created_at)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
