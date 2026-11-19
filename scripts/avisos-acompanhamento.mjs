// Aviso no celular quando muda o status de um processo do cliente na Polícia Federal (Sinarm CAC ou Portal PF).
// O Passarinho grava o status em processos_pf sempre que o escritório abre a lista de processos na conta gov do
// cliente; este script, rodado pelo GitHub a cada 15 minutos (.github/workflows/avisos-acompanhamento.yml), compara
// status com avisado_status e manda uma notificação para cada aparelho que ativou os avisos no link
// /acompanhamento/<id do cliente> (tabela push_acompanhamento). Só avisa mudança de status (o aviso diário de
// "conferido hoje" foi tirado). Rascunho (pedido ainda não enviado) não avisa. Processo que muda para Deferido
// também avisa o escritório (sino do site e celular do dono do cliente).
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
  const mudaram = pendentes.filter(p => p.cliente_id === cliente && !rascunho(p) && p.status);
  const url = `/acompanhamento/${cliente}`, tag = `acomp-${cliente}`;

  // Só avisa quando o status mudou. O aviso diário de "processo conferido hoje" foi tirado a pedido do usuário
  // (2026-11-19: "vai ficar só chateando o cliente").
  if (mudaram.length) {
    const aviso = { titulo: "Passarinho — atualização do seu processo", corpo: listar(mudaram) + ". Toque para ver.", url, tag };
    for (const a of aparelhos) if (await enviar(a, aviso)) { avisosMudanca++; await marcarHoje(a); }
  }
}

// Processo que MUDOU para Deferido (o usuário pediu): avisa o escritório — sino do site (tabela notifications) e celular
// (push_inscricoes com user_id, o mesmo do aviso de vencidos do admin) — para o dono do cliente em Clientes Armas.
// Só mudança de verdade: sem avisado_status anterior é a primeira leitura da lista (processo antigo), não avisa.
let deferidosAvisados = 0;
const deferidos = pendentes.filter(p => /^deferid/i.test(String(p.status || "").trim()) && (p.avisado_status || "") !== "" && !rascunho(p));
if (deferidos.length) {
  const ids = [...new Set(deferidos.map(p => p.cliente_id))];
  const clientes = await sb(`declaracao_clientes?select=id,nome,owner_id&id=in.(${ids.join(",")})`);
  const insAdmin = await sb("push_inscricoes?select=endpoint,p256dh,auth,user_id&user_id=not.is.null");
  for (const c of clientes) {
    if (!c.owner_id) continue;
    const lista = deferidos.filter(p => p.cliente_id === c.id).map(p => p.servico || "Processo").join(", ");
    const titulo = `✅ Processo deferido: ${c.nome}`;
    const mensagem = `${lista} de ${c.nome} foi DEFERIDO na Polícia Federal.`;
    if (!SIMULAR) {
      await sb("notifications", { method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ titulo, mensagem, created_by: c.owner_id, target_user_id: c.owner_id }) });
    }
    for (const a of insAdmin.filter(i => i.user_id === c.owner_id)) {
      if (SIMULAR) { enviados++; continue; }
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          JSON.stringify({ titulo, corpo: mensagem, url: "/declaracoes", tag: `deferido-${c.id}` }), { TTL: 24 * 3600, urgency: "normal" });
        enviados++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await sb(`push_inscricoes?endpoint=eq.${encodeURIComponent(a.endpoint)}`, { method: "DELETE" });
          removidas++;
        } else falhas++;
      }
    }
    deferidosAvisados++;
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
  ` | deferidos avisados ao escritório: ${deferidosAvisados} | inscrições removidas: ${removidas} | falhas: ${falhas}`);
if (falhas && !enviados) process.exit(1);
