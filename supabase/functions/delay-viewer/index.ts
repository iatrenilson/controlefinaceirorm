import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: linkData, error: linkError } = await supabase
      .from("delay_share_links")
      .select("id, user_id, ativo, nick, tipo, token")
      .eq("token", token)
      .single();

    if (linkError || !linkData || !linkData.ativo) {
      return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFornecedor = linkData.tipo === null || linkData.tipo === "editor";
    const isVodkaOnly = linkData.tipo === "visualizador_vodka";
    const isIndividual = linkData.tipo === "visualizador_individual";

    const { data: clientes, error: clientesError } = await supabase
      .from("delay_clientes")
      .select("id, nome, casa, login, senha, fornecedor, tipo, banco_deposito, status, operacao, depositos, saques, custos, lucro, deposito_pendente, informacoes_adicionais, created_at, updated_at, created_by_token, operator_link_id")
      .eq("user_id", linkData.user_id)
      .order("created_at", { ascending: false });

    if (clientesError) {
      return new Response(JSON.stringify({ error: "Erro ao buscar clientes" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isGlauber = (linkData.nick || "").toLowerCase().includes("glauber");

    const { data: transacoes, error: transacoesError } = await supabase
      .from("delay_transacoes")
      .select("id, cliente_id, tipo, valor, lucro, custo, dividir_lucro, data_transacao")
      .eq("user_id", linkData.user_id);

    if (transacoesError) {
      return new Response(JSON.stringify({ error: "Erro ao buscar transações" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build nick map: id -> nick (created_by_token stores link id)
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

    // For individual links: find all link ids that belong to the same nick
    let allowedTokens: Set<string> | null = null;
    if (isIndividual && linkData.nick) {
      const { data: nickLinks } = await supabase
        .from("delay_share_links")
        .select("id")
        .eq("user_id", linkData.user_id)
        .eq("nick", linkData.nick)
        .not("tipo", "in", '("visualizador","visualizador_vodka","visualizador_individual")');
      allowedTokens = new Set((nickLinks || []).map((l: any) => l.id));
      // also include clients assigned directly to this individual viewer link
      allowedTokens.add(linkData.id);
    }

    const clientesComNick = (clientes || [])
      .filter((c: any) => {
        if (isFornecedor) {
          // 1. Directly assigned to this fornecedor link
          if (c.created_by_token === linkData.id) return true;
          if (linkData.nick) {
            // 2. Assigned to any link (operator or other) with the SAME nick
            if (c.created_by_token && nickMap[c.created_by_token] === linkData.nick) return true;
            // 3. Fallback: fornecedor text field contains the nick
            if (c.fornecedor && c.fornecedor.toLowerCase().includes(linkData.nick.toLowerCase())) return true;
          }
          return false;
        }
        if (isVodkaOnly) return c.nome.toLowerCase().includes("vodka");
        if (isIndividual) {
          if (!allowedTokens) return false;
          // Check created_by_token (old behavior) OR operator_link_id (new dedicated field)
          if (c.created_by_token && allowedTokens.has(c.created_by_token)) return true;
          if (c.operator_link_id && allowedTokens.has(c.operator_link_id)) return true;
          return false;
        }
        return !c.nome.toLowerCase().includes("vodka");
      })
      .map((c: any) => {
        // Para o link do Glauber: lucro = (saques - depositos) / 2, sem nenhum custo
        let lucro = c.lucro;
        if (isGlauber && c.saques > 0) {
          lucro = c.tipo === "50/50"
            ? (c.saques - c.depositos) / 2
            : (c.saques - c.depositos);
        }
        return {
          ...c,
          lucro,
          nick_criador: c.created_by_token ? (nickMap[c.created_by_token] || null) : "Admin",
        };
      });

    // Mapa de depósito por cliente (para calcular lucro Glauber por transação)
    const depositoMap: Record<string, number> = {};
    (clientes || []).forEach((c: any) => { depositoMap[c.id] = c.depositos || 0; });
    const tipoMap: Record<string, string> = {};
    (clientes || []).forEach((c: any) => { tipoMap[c.id] = c.tipo || "50/50"; });

    const allowedClientIds = new Set((clientesComNick || []).map((c: any) => c.id));
    const transacoesFiltradas = (transacoes || [])
      .filter((t: any) => allowedClientIds.has(t.cliente_id))
      .map((t: any) => {
        if (!isGlauber || t.tipo === "deposito") return t;
        // Para Glauber: lucro = (valor_saque - deposito) / 2 sem custo
        const dep = depositoMap[t.cliente_id] || 0;
        const lucroGlauber = tipoMap[t.cliente_id] === "50/50"
          ? (t.valor - dep) / 2
          : (t.valor - dep);
        return { ...t, lucro: lucroGlauber };
      });

    return new Response(JSON.stringify({
      clientes: clientesComNick,
      transacoes: transacoesFiltradas,
      nick: linkData.nick || null,
      tipo: linkData.tipo,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
