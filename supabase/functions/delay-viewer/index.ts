import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Pragma": "no-cache",
  "Vary": "*",
  "Surrogate-Control": "no-store",
  "CDN-Cache-Control": "no-store",
};

async function fetchViewerData(supabase: any, token: string) {
  const { data: linkData, error: linkError } = await supabase
    .from("delay_share_links")
    .select("id, user_id, ativo, nick, tipo, token")
    .eq("token", token)
    .single();

  if (linkError || !linkData || !linkData.ativo) return null;

  const isFornecedor = linkData.tipo === null || linkData.tipo === "editor";
  const isVodkaOnly = linkData.tipo === "visualizador_vodka";
  const isIndividual = linkData.tipo === "visualizador_individual";

  const { data: clientes, error: clientesError } = await supabase
    .from("delay_clientes")
    .select("id, nome, casa, login, senha, fornecedor, tipo, banco_deposito, status, operacao, depositos, saques, custos, lucro, deposito_pendente, informacoes_adicionais, created_at, updated_at, created_by_token, operator_link_id")
    .eq("user_id", linkData.user_id)
    .order("created_at", { ascending: false });

  if (clientesError) return null;

  const isGlauber = (linkData.nick || "").toLowerCase().includes("glauber");

  const { data: transacoes, error: transacoesError } = await supabase
    .from("delay_transacoes")
    .select("id, cliente_id, tipo, valor, lucro, custo, dividir_lucro, data_transacao")
    .eq("user_id", linkData.user_id);

  if (transacoesError) return null;

  const { data: allLinks } = await supabase
    .from("delay_share_links")
    .select("id, nick")
    .eq("user_id", linkData.user_id);

  const nickMap: Record<string, string> = {};
  if (allLinks) {
    for (const l of allLinks) {
      if (l.nick && l.id) nickMap[l.id] = l.nick;
    }
  }

  let allowedTokens: Set<string> | null = null;
  if (isIndividual && linkData.nick) {
    const { data: nickLinks } = await supabase
      .from("delay_share_links")
      .select("id")
      .eq("user_id", linkData.user_id)
      .eq("nick", linkData.nick)
      .not("tipo", "in", '("visualizador","visualizador_vodka","visualizador_individual")');
    allowedTokens = new Set((nickLinks || []).map((l: any) => l.id));
    allowedTokens.add(linkData.id);
  }

  const clientesComNick = (clientes || [])
    .filter((c: any) => {
      if (!isFornecedor && c.status === "saque_pendente") return false;
      if (isFornecedor) {
        if (c.created_by_token === linkData.id) return true;
        if (linkData.nick) {
          if (c.created_by_token && nickMap[c.created_by_token] === linkData.nick) return true;
          if (c.fornecedor && c.fornecedor.toLowerCase().includes(linkData.nick.toLowerCase())) return true;
        }
        return false;
      }
      if (isVodkaOnly) return c.nome.toLowerCase().includes("vodka");
      if (isIndividual) {
        if (!allowedTokens) return false;
        if (c.created_by_token && allowedTokens.has(c.created_by_token)) return true;
        if (c.operator_link_id && allowedTokens.has(c.operator_link_id)) return true;
        return false;
      }
      return !c.nome.toLowerCase().includes("vodka");
    })
    .map((c: any) => {
      let lucro = c.lucro;
      if (isGlauber && c.saques > 0) {
        const bruto = c.saques - c.depositos;
        lucro = bruto < 0 ? bruto : bruto / 2;
      }
      return {
        ...c,
        lucro,
        nick_criador: c.created_by_token ? (nickMap[c.created_by_token] || null) : "Admin",
      };
    });

  const depositoMap: Record<string, number> = {};
  (clientes || []).forEach((c: any) => { depositoMap[c.id] = c.depositos || 0; });

  const allowedClientIds = new Set((clientesComNick || []).map((c: any) => c.id));
  const transacoesFiltradas = (transacoes || [])
    .filter((t: any) => allowedClientIds.has(t.cliente_id))
    .map((t: any) => {
      if (!isGlauber || t.tipo === "deposito") return t;
      const dep = depositoMap[t.cliente_id] || 0;
      const bruto = t.valor - dep;
      const lucroGlauber = bruto < 0 ? bruto : bruto / 2;
      return { ...t, lucro: lucroGlauber };
    });

  return {
    clientes: clientesComNick,
    transacoes: transacoesFiltradas,
    nick: linkData.nick || null,
    tipo: linkData.tipo === null ? "editor" : linkData.tipo,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (req.method === "POST") {
    try {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ error: "Token obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json().catch(() => ({}));

      // Se tem cliente_id: ação de marcar como queimada
      if (body.cliente_id) {
        const { data: ld, error: le } = await supabase
          .from("delay_share_links").select("id, user_id, ativo").eq("token", token).single();
        if (le || !ld || !ld.ativo) {
          return new Response(JSON.stringify({ error: "Link inválido" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const updatePayload: Record<string, any> = {
          status: "saque_pendente",
          operacao: "saque_pendente",
          updated_at: new Date().toISOString(),
        };
        if (typeof body.deposito_pendente === "number") updatePayload.deposito_pendente = body.deposito_pendente;
        if (typeof body.custos === "number") updatePayload.custos = body.custos;
        const { error: ue } = await supabase
          .from("delay_clientes")
          .update(updatePayload)
          .eq("id", body.cliente_id)
          .eq("user_id", ld.user_id);
        if (ue) throw ue;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sem cliente_id: busca de dados via POST (nunca cacheado pelo browser)
      const data = await fetchViewerData(supabase, token);
      if (!data) {
        return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // GET: mantido para compatibilidade com versões antigas do app
  if (req.method === "GET") {
    try {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ error: "Token obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await fetchViewerData(supabase, token);
      if (!data) {
        return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (_e) {
      return new Response(JSON.stringify({ error: "Erro interno" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Método não suportado" }), {
    status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
