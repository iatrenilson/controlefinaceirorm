import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // GET: List clients created by this token
    if (req.method === "GET") {
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
        .select("id, user_id, ativo, nick")
        .eq("token", token)
        .single();

      if (linkError || !linkData || !linkData.ativo) {
        return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: clientes, error: clientesError } = await supabase
        .from("delay_clientes")
        .select("id, nome, casa, login, senha, fornecedor, tipo, banco_deposito, status, operacao, depositos, saques, custos, lucro, deposito_pendente, informacoes_adicionais, created_at")
        .eq("created_by_token", linkData.id)
        .order("created_at", { ascending: false });

      if (clientesError) {
        return new Response(JSON.stringify({ error: "Erro ao buscar clientes" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ clientes: clientes || [], nick: linkData.nick || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT: Edit a client created by this token
    if (req.method === "PUT") {
      const { token, client_id, nome, casa, login, senha, fornecedor, tipo, banco_deposito } = await req.json();

      if (!token || !client_id) {
        return new Response(JSON.stringify({ error: "Token e client_id são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: linkData, error: linkError } = await supabase
        .from("delay_share_links")
        .select("id, user_id, ativo")
        .eq("token", token)
        .single();

      if (linkError || !linkData || !linkData.ativo) {
        return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabase
        .from("delay_clientes")
        .select("id")
        .eq("id", client_id)
        .eq("created_by_token", linkData.id)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Você só pode editar clientes que você criou" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateData: Record<string, unknown> = {};
      if (nome !== undefined) updateData.nome = nome;
      if (casa !== undefined) updateData.casa = casa;
      if (login !== undefined) updateData.login = login;
      if (senha !== undefined) updateData.senha = senha;
      if (fornecedor !== undefined) updateData.fornecedor = fornecedor;
      if (tipo !== undefined) updateData.tipo = tipo;
      if (banco_deposito !== undefined) updateData.banco_deposito = banco_deposito;

      const { error: updateError } = await supabase
        .from("delay_clientes")
        .update(updateData)
        .eq("id", client_id);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Erro ao atualizar cliente" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Add a new client (deposit stored as pending, NOT auto-deducted)
    if (req.method === "POST") {
      const { token, nome, casa, login, senha, fornecedor, tipo, banco_deposito, valor_deposito, informacoes_adicionais } = await req.json();

      if (!token || !nome) {
        return new Response(JSON.stringify({ error: "Token e nome são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: linkData, error: linkError } = await supabase
        .from("delay_share_links")
        .select("id, user_id, ativo")
        .eq("token", token)
        .single();

      if (linkError || !linkData || !linkData.ativo) {
        return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const depositoVal = parseFloat(valor_deposito) || 0;
      const banco = banco_deposito || "santander";

      // Store deposit as PENDING — admin must approve before bank is deducted
      const { error: insertError } = await supabase.from("delay_clientes").insert({
        user_id: linkData.user_id,
        nome,
        casa: casa || "Bet365",
        login: login || null,
        senha: senha || null,
        fornecedor: fornecedor || null,
        tipo: tipo || "50/50",
        banco_deposito: banco,
        status: "ativo",
        operacao: "operando",
        depositos: 0,
        deposito_pendente: depositoVal,
        informacoes_adicionais: informacoes_adicionais || null,
        created_by_token: linkData.id,
      });

      if (insertError) {
        return new Response(JSON.stringify({ error: "Erro ao adicionar cliente" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
