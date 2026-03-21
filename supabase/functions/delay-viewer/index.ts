import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
      .select("id, user_id, ativo, nick, tipo")
      .eq("token", token)
      .in("tipo", ["visualizador", "visualizador_vodka"])
      .single();

    if (linkError || !linkData || !linkData.ativo) {
      return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isVodkaOnly = linkData.tipo === "visualizador_vodka";

    const { data: clientes, error: clientesError } = await supabase
      .from("delay_clientes")
      .select("id, nome, casa, login, senha, fornecedor, tipo, banco_deposito, status, operacao, depositos, saques, custos, lucro, deposito_pendente, informacoes_adicionais, created_at, updated_at, created_by_token")
      .eq("user_id", linkData.user_id)
      .order("created_at", { ascending: false });

    if (clientesError) {
      return new Response(JSON.stringify({ error: "Erro ao buscar clientes" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: transacoes, error: transacoesError } = await supabase
      .from("delay_transacoes")
      .select("id, cliente_id, tipo, lucro, data_transacao")
      .eq("user_id", linkData.user_id);

    if (transacoesError) {
      return new Response(JSON.stringify({ error: "Erro ao buscar transações" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allLinks } = await supabase
      .from("delay_share_links")
      .select("id, nick")
      .eq("user_id", linkData.user_id);

    const nickMap: Record<string, string> = {};
    if (allLinks) {
      for (const l of allLinks) {
        if (l.nick) nickMap[l.id] = l.nick;
      }
    }

    const clientesComNick = (clientes || [])
      .filter((c: any) => {
        const hasVodka = c.nome.toLowerCase().includes("vodka");
        return isVodkaOnly ? hasVodka : !hasVodka;
      })
      .map((c: any) => ({
        ...c,
        nick_criador: c.created_by_token ? (nickMap[c.created_by_token] || null) : "Admin",
      }));

    const allowedClientIds = new Set((clientesComNick || []).map((c: any) => c.id));
    const transacoesFiltradas = (transacoes || []).filter((t: any) => allowedClientIds.has(t.cliente_id));

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
