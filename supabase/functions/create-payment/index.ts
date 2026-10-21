import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Chaves novas do Supabase (sb_secret / sb_publishable). As antigas anon/service_role
// vazaram e foram desligadas; a antiga fica so de reserva se a nova nao existir.
function chaveNova(nova: string, antiga: string): string | undefined {
  try {
    const chaves = JSON.parse(Deno.env.get(nova) ?? "{}");
    if (chaves.default) return chaves.default;
  } catch { /* usa a antiga */ }
  return Deno.env.get(antiga);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      chaveNova("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!mpToken) {
      return new Response(JSON.stringify({ error: "MP token not configured" }), { status: 500, headers: corsHeaders });
    }

    // Create PIX payment directly (Checkout Transparente) — no MP login required
    const payment = {
      transaction_amount: 29.90,
      description: "RW Investimentos — Plano Mensal",
      payment_method_id: "pix",
      payer: {
        email: user.email,
      },
      external_reference: user.id,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `rw-${user.id}-${Date.now()}`,
      },
      body: JSON.stringify(payment),
    });

    if (!mpRes.ok) {
      const errBody = await mpRes.text();
      console.error("MP API error:", mpRes.status, errBody);
      return new Response(JSON.stringify({ error: "MP API error", detail: errBody }), { status: 500, headers: corsHeaders });
    }

    const data = await mpRes.json();
    const txData = data.point_of_interaction?.transaction_data;

    return new Response(JSON.stringify({
      ok: true,
      payment_id: data.id,
      qr_code: txData?.qr_code,           // PIX copia e cola
      qr_code_base64: txData?.qr_code_base64, // QR code image (base64 PNG)
      status: data.status,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("create-payment error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
