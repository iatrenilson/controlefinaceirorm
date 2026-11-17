// Aviso no celular quando muda o status de um processo do cliente na Polícia Federal (Sinarm CAC ou Portal PF).
// O Passarinho grava o status em processos_pf sempre que o escritório abre a lista de processos na conta gov do
// cliente; este script, rodado pelo GitHub a cada 15 minutos (.github/workflows/avisos-acompanhamento.yml), compara
// status com avisado_status e manda uma notificação para cada aparelho que ativou os avisos no link
// /acompanhamento/<id do cliente> (tabela push_acompanhamento). No dia em que o escritório consulta, também manda um
// aviso de "processo conferido hoje", no máximo um por dia e por aparelho. Rascunho (pedido ainda não enviado) não avisa.
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

const processos = await sb("processos_pf?select=id,cliente_id,servico,descricao,status,avisado_status,consultado_em");
const inscricoes = await sb("push_acompanhamento?select=endpoint,p256dh,auth,cliente_id,avisado_consulta_em");
const rascunho = p => /rascunho/i.test(p.descricao || "");
const pendentes = processos.filter(p => (p.status || "") !== (p.avisado_status || ""));

// dia em Manaus (o GitHub roda em UTC): "AAAA-MM-DD"
const diaManaus = d => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(new Date(d));
const HOJE = diaManaus(Date.now());

let enviados = 0, removidas = 0, falhas = 0, avisosMudanca = 0, avisosDiarios = 0;
// true se a notificação foi entregue ao serviço de push (na simulação, se seria enviada)
async function enviar(a, aviso) {
  if (SIMULAR) { enviados++; return true; }
  try {
    await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
      JSON.stringify(aviso), { TTL: 24 * 3600, urgency: "normal" });
    enviados++;
    return true;
  } catch (e) {
    // aparelho que desinstalou ou tirou a permissão: a inscrição não vale mais
    if (e.statusCode === 404 || e.statusCode === 410) {
      await sb(`push_acompanhamento?endpoint=eq.${encodeURIComponent(a.endpoint)}&cliente_id=eq.${a.cliente_id}`, { method: "DELETE" });
      removidas++;
    } else falhas++;
    return false;
  }
}
// aparelho já recebeu o aviso do dia (de consulta ou de mudança): não recebe outro aviso de consulta hoje
async function marcarHoje(a) {
  if (SIMULAR) return;
  await sb(`push_acompanhamento?endpoint=eq.${encodeURIComponent(a.endpoint)}&cliente_id=eq.${a.cliente_id}`,
    { method: "PATCH", body: JSON.stringify({ avisado_consulta_em: HOJE }), headers: { Prefer: "return=minimal" } });
}
const listar = lista => lista.slice(0, 3).map(p => `${p.servico || "Processo"}: ${p.status}`).join(" · ") +
  (lista.length > 3 ? ` e mais ${lista.length - 3}` : "");

for (const cliente of new Set(inscricoes.map(i => i.cliente_id))) {
  const aparelhos = inscricoes.filter(i => i.cliente_id === cliente);
  const dele = processos.filter(p => p.cliente_id === cliente && !rascunho(p) && p.status);
  const mudaram = pendentes.filter(p => p.cliente_id === cliente && !rascunho(p) && p.status);
  const url = `/acompanhamento/${cliente}`, tag = `acomp-${cliente}`;

  // 1) status mudou: avisa na hora (vale como o aviso do dia)
  if (mudaram.length) {
    const aviso = { titulo: "Passarinho — atualização do seu processo", corpo: listar(mudaram) + ". Toque para ver.", url, tag };
    for (const a of aparelhos) if (await enviar(a, aviso)) { avisosMudanca++; await marcarHoje(a); }
    continue;
  }
  // 2) o escritório consultou hoje e o aparelho ainda não recebeu aviso hoje: um aviso de "conferido hoje"
  const consultouHoje = dele.some(p => p.consultado_em && diaManaus(p.consultado_em) === HOJE);
  if (!consultouHoje) continue;
  const aviso = { titulo: "Passarinho — processo conferido hoje",
    corpo: `Conferimos hoje seu processo na Polícia Federal. ${listar(dele)}. Toque para ver.`, url, tag };
  for (const a of aparelhos) {
    if (a.avisado_consulta_em === HOJE) continue;
    if (await enviar(a, aviso)) { avisosDiarios++; await marcarHoje(a); }
  }
}

// marca o status como avisado (também rascunho e cliente sem aparelho inscrito: quem ativar depois não recebe coisa antiga)
if (!SIMULAR) {
  for (const p of pendentes) {
    await sb(`processos_pf?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ avisado_status: p.status }), headers: { Prefer: "return=minimal" } });
  }
}

console.log(`${SIMULAR ? "[simulação] " : ""}status novos: ${pendentes.length} | aparelhos inscritos: ${inscricoes.length}` +
  ` | avisos de mudança: ${avisosMudanca} | avisos de consulta do dia: ${avisosDiarios} | enviados: ${enviados}` +
  ` | inscrições removidas: ${removidas} | falhas: ${falhas}`);
if (falhas && !enviados) process.exit(1);
