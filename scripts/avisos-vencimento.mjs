// Aviso diário de documento vencido da Carteira CAC no celular (notificação push), rodado pelo GitHub
// (.github/workflows/avisos-vencimento.yml) todo dia às 9h de Manaus.
// - Cliente que ativou os avisos na Carteira dele: recebe enquanto tiver documento vencido.
// - Admin que ativou no site: recebe a lista de todos os documentos vencidos.
// Regra igual à de src/lib/avisosCarteira.ts: vale a última data dd/mm/aaaa do campo de validade e o documento conta
// como vencido a partir do dia seguinte. O repositório é público: o log mostra só contagens, nunca nome de cliente.
import webpush from "web-push";

const SUPABASE_URL = "https://qubkmecpxbsdphtmwvvw.supabase.co";
const CHAVE = process.env.SUPABASE_SERVICE_KEY;
const VAPID_PUBLICA = process.env.VAPID_PUBLIC_KEY || "BF1ME-nzhytUwCwzTP4kuzugmd0CNfZJ46rWHBYICzg3EH8Id_8DhzXyyo3MLbQtmOEWfr-BeLqq72ixUxyX4Bo";
const SO_ADMIN = process.env.SO_ADMIN === "true";   // teste manual: só o celular do admin
const SIMULAR = process.env.SIMULAR === "true";     // só conta, não envia
if (!CHAVE || !process.env.VAPID_PRIVATE_KEY) { console.error("Faltam os segredos SUPABASE_SERVICE_KEY / VAPID_PRIVATE_KEY"); process.exit(1); }
webpush.setVapidDetails("mailto:adm@passarinhoassessoriabelica.com.br", VAPID_PUBLICA, process.env.VAPID_PRIVATE_KEY);

const ROTULO = { cr: "CR", craf: "CRAF da Arma", gt: "GT", cert: "Certificado" };

async function sb(caminho, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status} em ${caminho.split("?")[0]}`);
  return r.status === 204 ? null : r.json();
}

// "hoje" em Manaus (o GitHub roda em UTC)
const [ha, hm, hd] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(new Date()).split("-").map(Number);
const HOJE = Date.UTC(ha, hm - 1, hd);
function diasVencido(validade) {
  const ultima = (String(validade || "").match(/\d{2}\/\d{2}\/\d{4}/g) || []).pop();
  if (!ultima) return null;
  const [d, m, a] = ultima.split("/").map(Number);
  const dias = Math.round((HOJE - Date.UTC(a, m - 1, d)) / 86400000);
  return dias > 0 ? dias : null; // vencido a partir do dia seguinte à validade
}
const haDias = n => `há ${n} ${n === 1 ? "dia" : "dias"}`;

const docs = await sb("carteira_docs?select=tipo,data_validade,carteira_cliente_id,carteira_clientes(nome)&data_validade=neq.");
const vencidos = [];
for (const d of docs) {
  const dias = diasVencido(d.data_validade);
  if (dias) vencidos.push({ cliente: d.carteira_cliente_id, nome: d.carteira_clientes?.nome || "Cliente", rotulo: ROTULO[d.tipo] || String(d.tipo).toUpperCase(), dias });
}
vencidos.sort((a, b) => a.dias - b.dias);
const inscricoes = await sb("push_inscricoes?select=endpoint,p256dh,auth,carteira_cliente_id,user_id");

let enviados = 0, removidas = 0, falhas = 0;
// true se a notificação foi entregue ao serviço de push (na simulação, se seria enviada)
async function enviar(insc, aviso) {
  if (SIMULAR) { enviados++; return true; }
  try {
    await webpush.sendNotification({ endpoint: insc.endpoint, keys: { p256dh: insc.p256dh, auth: insc.auth } },
      JSON.stringify(aviso), { TTL: 12 * 3600, urgency: "normal" });
    enviados++;
    return true;
  } catch (e) {
    // aparelho que desinstalou ou tirou a permissão: a inscrição não vale mais
    if (e.statusCode === 404 || e.statusCode === 410) {
      await sb(`push_inscricoes?endpoint=eq.${encodeURIComponent(insc.endpoint)}`, { method: "DELETE" });
      removidas++;
    } else falhas++;
    return false;
  }
}

let clientesAvisados = 0, adminsAvisados = 0;
for (const insc of inscricoes) {
  if (insc.user_id) {
    if (!vencidos.length) continue;
    const lista = vencidos.slice(0, 4).map(v => `${v.rotulo} — ${v.nome} (${haDias(v.dias)})`).join("; ");
    const mais = vencidos.length > 4 ? ` e mais ${vencidos.length - 4}` : "";
    if (await enviar(insc, {
      titulo: `Carteira CAC: ${vencidos.length} ${vencidos.length === 1 ? "documento vencido" : "documentos vencidos"}`,
      corpo: lista + mais, url: "/carteira-digital", tag: "vencidos-admin",
    })) adminsAvisados++;
  } else if (!SO_ADMIN) {
    const meus = vencidos.filter(v => v.cliente === insc.carteira_cliente_id);
    if (!meus.length) continue;
    const corpo = meus.length === 1
      ? `Seu ${meus[0].rotulo} venceu ${haDias(meus[0].dias)}. Toque para ver e renovar com a Passarinho.`
      : `${meus.length} documentos vencidos: ${meus.map(v => `${v.rotulo} (${haDias(v.dias)})`).join(", ")}. Toque para renovar com a Passarinho.`;
    if (await enviar(insc, { titulo: "Passarinho — documento vencido", corpo, url: `/carteira/${insc.carteira_cliente_id}`, tag: "vencidos" }))
      clientesAvisados++;
  }
}

console.log(`${SIMULAR ? "[simulação] " : ""}documentos vencidos: ${vencidos.length} | aparelhos inscritos: ${inscricoes.length}` +
  ` | avisados: ${clientesAvisados} cliente(s), ${adminsAvisados} admin | enviados: ${enviados} | inscrições removidas: ${removidas} | falhas: ${falhas}`);
if (falhas && !enviados) process.exit(1);
