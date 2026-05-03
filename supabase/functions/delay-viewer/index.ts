import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // POST: marcar conta como queimada (saque_pendente)
  if (req.method === "POST") {
    try {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ error: "Token obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { linkData: ld, error: le } = await supabase
        .from("delay_share_links").select("id, user_id, ativo").eq("token", token).single()
        .then(r => ({ linkData: r.data, error: r.error }));
      if (le || !ld || !ld.ativo) {
        return new Response(JSON.stringify({ error: "Link inválido" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      const clienteId = body.cliente_id;
      if (!clienteId) {
        return new Response(JSON.stringify({ error: "cliente_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Campos extras opcionais para saque_fornecedor (valor e custo do saque)
      const updatePayload: Record<string, any> = {
        status: "saque_pendente",
        operacao: "saque_pendente",
        updated_at: new Date().toISOString(),
      };
      if (typeof body.deposito_pendente === "number") {
        updatePayload.deposito_pendente = body.deposito_pendente;
      }
      if (typeof body.custos === "number") {
        updatePayload.custos = body.custos;
      }
      const { error: ue } = await supabase
        .from("delay_clientes")
        .update(updatePayload)
        .eq("id", clienteId)
        .eq("user_id", ld.user_id);
      if (ue) throw ue;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
        // Contas queimadas (saque_pendente) só são ocultadas de links de visualização (não do editor/admin)
        if (!isFornecedor && c.status === "saque_pendente") return false;

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
          if (c.created_by_token && allowedTokens.has(c.created_by_token)) return true;
          if (c.operator_link_id && allowedTokens.has(c.operator_link_id)) return true;
          return false;
        }
        return !c.nome.toLowerCase().includes("vodka");
      })
      .map((c: any) => {
        // Para o link do Glauber: sem custo deduzido
        // Lucro positivo: (saques - depositos) / 2 (parte do Glauber)
        // RED (prejuizo): valor cheio sem dividir
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
        // Para Glauber: lucro positivo dividido por 2, RED cheio
        const dep = depositoMap[t.cliente_id] || 0;
        const bruto = t.valor - dep;
        const lucroGlauber = bruto < 0 ? bruto : bruto / 2;
        return { ...t, lucro: lucroGlauber };
      });

    return new Response(JSON.stringify({
      clientes: clientesComNick,
      transacoes: transacoesFiltradas,
      nick: linkData.nick || null,
      tipo: linkData.tipo === null ? "editor" : linkData.tipo,
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
