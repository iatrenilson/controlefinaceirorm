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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    chaveNova("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
  if (!mpToken) {
    console.error("MP_ACCESS_TOKEN not set");
    return new Response(JSON.stringify({ error: "MP token missing" }), { status: 500, headers: corsHeaders });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    console.error("Failed to parse body:", e);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: corsHeaders });
  }

  console.log("MP Webhook body:", JSON.stringify(body));

  // Support both MP webhook formats:
  // { type: "payment", data: { id: "123" } }
  // query param: ?topic=payment&id=123
  const url = new URL(req.url);
  const topicParam = url.searchParams.get("topic");
  const idParam = url.searchParams.get("id");

  let paymentId: string | null = null;

  if (body?.type === "payment" && body?.data?.id) {
    paymentId = String(body.data.id);
  } else if (topicParam === "payment" && idParam) {
    paymentId = idParam;
  } else if (body?.data?.id) {
    paymentId = String(body.data.id);
  }

  if (!paymentId) {
    console.log("No payment ID found, ignoring notification:", JSON.stringify(body));
    return new Response(JSON.stringify({ ok: true, note: "no payment id" }), { headers: corsHeaders });
  }

  console.log("Fetching payment:", paymentId);

  // Fetch payment from MercadoPago
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  });

  if (!mpRes.ok) {
    const errText = await mpRes.text();
    console.error("MP API error:", mpRes.status, errText);
    return new Response(JSON.stringify({ error: `MP API error ${mpRes.status}`, detail: errText }), { status: 500, headers: corsHeaders });
  }

  const payment = await mpRes.json();
  console.log("Payment:", payment.id, "status:", payment.status, "external_reference:", payment.external_reference, "payer:", payment.payer?.email);

  if (payment.status !== "approved") {
    return new Response(JSON.stringify({ ok: true, status: payment.status }), { headers: corsHeaders });
  }

  // Get user ID — primary: external_reference, fallback: email lookup via DB
  let userId: string | null = payment.external_reference || null;

  if (!userId && payment.payer?.email) {
    const { data, error } = await supabase.rpc("get_user_id_by_email", { p_email: payment.payer.email });
    if (!error && data) userId = data;
    console.log("Email lookup result:", userId, error?.message);
  }

  if (!userId) {
    console.error("No user identified for payment", paymentId);
    return new Response(JSON.stringify({ ok: true, note: "user not found" }), { headers: corsHeaders });
  }

  // Extend from current expiry if still active, otherwise from now
  const { data: currentSub } = await supabase
    .from("subscriptions")
    .select("subscription_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  const currentExpiry = currentSub?.subscription_expires_at
    ? new Date(currentSub.subscription_expires_at)
    : null;

  const baseDate = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
  const expiresAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: subErr } = await supabase
    .from("subscriptions")
    .upsert({
      user_id: userId,
      plan_name: "mensal",
      subscription_expires_at: expiresAt,
    }, { onConflict: "user_id" });

  if (subErr) {
    console.error("Subscription upsert error:", JSON.stringify(subErr));
    return new Response(JSON.stringify({ error: subErr.message }), { status: 500, headers: corsHeaders });
  }

  console.log(`✅ Subscription activated: user=${userId} expires=${expiresAt}`);
  return new Response(JSON.stringify({ ok: true, activated: true, user_id: userId, expires_at: expiresAt }), { headers: corsHeaders });
});
