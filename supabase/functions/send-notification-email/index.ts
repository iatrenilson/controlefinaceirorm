import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem enviar e-mails" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { titulo, mensagem, target_user_id } = await req.json();

    if (!titulo || !mensagem) {
      return new Response(JSON.stringify({ error: "Título e mensagem são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get recipients
    let recipients: { email: string; nome: string | null }[] = [];

    if (target_user_id && target_user_id !== "todos") {
      const { data } = await supabase
        .from("profiles")
        .select("email, nome")
        .eq("user_id", target_user_id)
        .single();
      if (data?.email) {
        recipients.push({ email: data.email, nome: data.nome });
      }
    } else {
      const { data } = await supabase
        .from("profiles")
        .select("email, nome");
      recipients = (data || []).filter((p: any) => p.email);
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum destinatário com e-mail encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enqueue emails
    let enqueued = 0;
    for (const recipient of recipients) {
      const messageId = crypto.randomUUID();
      const unsubscribeToken = crypto.randomUUID();

      // Store unsubscribe token
      await supabase.from("email_unsubscribe_tokens").insert({
        token: unsubscribeToken,
        email: recipient.email,
      });

      const textContent = `${titulo}\n\n${mensagem}${recipient.nome ? `\n\nOlá, ${recipient.nome}!` : ""}\n\nEste e-mail foi enviado por RW Investimentos Financeiros.`;
      const payload = {
        message_id: messageId,
        idempotency_key: messageId,
        unsubscribe_token: unsubscribeToken,
        to: recipient.email,
        from: "financeiro@rwinvestimentos.com.br",
        sender_domain: "notify.rwinvestimentos.com.br",
        subject: titulo,
        purpose: "transactional",
        label: "admin_notification",
        queued_at: new Date().toISOString(),
        text: textContent,
        html: `
          <div style="font-family: 'Space Grotesk', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #1a9a6c; margin: 0;">RW Investimentos</h2>
            </div>
            <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; border-left: 4px solid #1a9a6c;">
              <h3 style="margin: 0 0 12px 0; color: #1a1a1a;">${titulo}</h3>
              <p style="margin: 0; color: #4a4a4a; line-height: 1.6; white-space: pre-wrap;">${mensagem}</p>
            </div>
            ${recipient.nome ? `<p style="margin-top: 16px; color: #888; font-size: 13px;">Olá, ${recipient.nome}!</p>` : ""}
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #aaa; font-size: 12px; text-align: center;">
              Este e-mail foi enviado por RW Investimentos Financeiros.
            </p>
          </div>
        `,
      };

      // Log pending
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "admin_notification",
        recipient_email: recipient.email,
        status: "pending",
      });

      const { error } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload,
      });

      if (!error) enqueued++;
    }

    return new Response(
      JSON.stringify({ success: true, enqueued, total: recipients.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
