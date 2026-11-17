// Aviso no celular quando muda o status de um processo do cliente na Polícia Federal (Sinarm CAC ou Portal PF).
// O Passarinho grava o status em processos_pf sempre que o escritório abre a lista de processos na conta gov do
// cliente; este script, rodado pelo GitHub a cada 15 minutos (.github/workflows/avisos-acompanhamento.yml), compara
// status com avisado_status e manda uma notificação para cada aparelho que ativou os avisos no link
// /acompanhamento/<id do cliente> (tabela push_acompanhamento). Rascunho (pedido ainda não enviado à PF) não avisa.
// O repositório é público: o log mostra só contagens, nunca nome de cliente.
import webpush from "web-push";

const SUPABASE_URL = "https://qubkmecpxbsdphtmwvvw.supabase.co";
const CHAVE = process.env.SUPABASE_SERVICE_KEY;
const VAPID_PUBLICA = process.env.VAPID_PUBLIC_KEY || "BF1ME-nzhytUwCwzTP4kuzugmd0CNfZJ46rWHBYICzg3EH8Id_8DhzXyyo3MLbQtmOEWfr-BeLqq72ixUxyX4Bo";
const SIMULAR = process.env.SIMULAR === "true"; // só conta, não envia nem marca como avisado
const VAPID_PRIVADA = String(process.env.VAPID_PRIVATE_KEY || "").trim().replace(/^["']+|["']+$/g, "").replace(/=+$/, "");
if (!CHAVE || !VAPID_PRIVADA) { console.error("Faltam os segredos SUPABASE_SERVICE_KEY / VAPID_PRIVATE_KEY"); process.exit(1); }
webpush.setVapidDetails("mailto:adm@passarinhoassessoriabelica.com.br", VAPID_PUBLICA, VAPID_PRIVADA);

async function sb(caminho, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status} em ${caminho.split("?")[0]}`);
  return r.status === 204 ? null : r.json();
}

const processos = await sb("processos_pf?select=id,cliente_id,servico,descricao,status,avisado_status");
const pendentes = processos.filter(p => (p.status || "") !== (p.avisado_status || ""));
if (!pendentes.length) { console.log("nenhum status novo"); process.exit(0); }

const inscricoes = await sb("push_acompanhamento?select=endpoint,p256dh,auth,cliente_id");
const rascunho = p => /rascunho/i.test(p.descricao || "");

// agrupa por cliente: uma notificação por cliente, com os processos que mudaram
const porCliente = new Map();
for (const p of pendentes) {
  if (rascunho(p) || !p.status) continue;
  if (!porCliente.has(p.cliente_id)) porCliente.set(p.cliente_id, []);
  porCliente.get(p.cliente_id).push(p);
}

let enviados = 0, removidas = 0, falhas = 0, clientesAvisados = 0;
for (const [cliente, lista] of porCliente) {
  const aparelhos = inscricoes.filter(i => i.cliente_id === cliente);
  if (!aparelhos.length) continue;
  const corpo = lista.length === 1
    ? `${lista[0].servico || "Seu processo"}: ${lista[0].status}. Toque para ver.`
    : lista.slice(0, 3).map(p => `${p.servico || "Processo"}: ${p.status}`).join(" · ") +
      (lista.length > 3 ? ` e mais ${lista.length - 3}` : "") + ". Toque para ver.";
  const aviso = { titulo: "Passarinho — atualização do seu processo", corpo, url: `/acompanhamento/${cliente}`, tag: `acomp-${cliente}` };
  let algum = false;
  for (const a of aparelhos) {
    if (SIMULAR) { enviados++; algum = true; continue; }
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        JSON.stringify(aviso), { TTL: 24 * 3600, urgency: "normal" });
      enviados++; algum = true;
    } catch (e) {
      // aparelho que desinstalou ou tirou a permissão: a inscrição não vale mais
      if (e.statusCode === 404 || e.statusCode === 410) {
        await sb(`push_acompanhamento?endpoint=eq.${encodeURIComponent(a.endpoint)}&cliente_id=eq.${cliente}`, { method: "DELETE" });
        removidas++;
      } else falhas++;
    }
  }
  if (algum) clientesAvisados++;
}

// marca como avisado (também rascunho e cliente sem aparelho inscrito: quem ativar depois não recebe coisa antiga)
if (!SIMULAR) {
  for (const p of pendentes) {
    await sb(`processos_pf?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ avisado_status: p.status }), headers: { Prefer: "return=minimal" } });
  }
}

console.log(`${SIMULAR ? "[simulação] " : ""}status novos: ${pendentes.length} | clientes com mudança: ${porCliente.size}` +
  ` | avisados: ${clientesAvisados} | enviados: ${enviados} | inscrições removidas: ${removidas} | falhas: ${falhas}`);
if (falhas && !enviados) process.exit(1);
