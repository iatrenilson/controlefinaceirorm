// Aviso no celular quando muda o status de um processo do cliente na Polícia Federal (Sinarm CAC ou Portal PF).
// O Passarinho grava o status em processos_pf sempre que o escritório abre a lista de processos na conta gov do
// cliente; este script, rodado pelo GitHub a cada 15 minutos (.github/workflows/avisos-acompanhamento.yml), compara
// status com avisado_status e manda uma notificação para cada aparelho que ativou os avisos no link
// /acompanhamento/<id do cliente> (tabela push_acompanhamento). Avisa mudança de status e, quando nada mudou, que o
// escritório acompanhou o processo (a cada consulta, no máximo 1 a cada 6 horas). Rascunho (pedido ainda não enviado)
// não avisa. Processo que muda para Deferido também avisa o escritório (sino do site e celular do dono do cliente).
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
  // resposta vazia (204, ou 201 do POST com "return=minimal"): antes o r.json() quebrava aqui e o robô parava ANTES de
  // marcar o status como avisado, repetindo o aviso de deferido a cada rodada (2026-11-22)
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

const processos = await sb("processos_pf?select=id,cliente_id,servico,descricao,status,avisado_status,consultado_em,status_mudou_em");
const inscricoes = await sb("push_acompanhamento?select=endpoint,p256dh,auth,cliente_id,avisado_consulta_em,avisado_consulta_ts,aviso_pendente,aviso_enviado_em,aviso_reenvios");
const rascunho = p => /rascunho/i.test(p.descricao || "");
const pendentes = processos.filter(p => (p.status || "") !== (p.avisado_status || ""));

// dia em Manaus (o GitHub roda em UTC): "AAAA-MM-DD"
const diaManaus = d => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(new Date(d));
const HOJE = diaManaus(Date.now());

let enviados = 0, removidas = 0, falhas = 0, avisosMudanca = 0, avisosDiarios = 0, reenvios = 0;
const REENVIOS_MAX = 3, INTERVALO_REENVIO = 20 * 3600 * 1000; // 1 vez por dia (folga para o atraso do GitHub)
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
// guarda o aviso no aparelho até o cliente abrir (marcar_aviso_aberto, chamado pela notificação ou ao abrir a carteira)
async function guardarPendente(a, aviso, novo) {
  if (SIMULAR) return;
  await sb(`push_acompanhamento?endpoint=eq.${encodeURIComponent(a.endpoint)}&cliente_id=eq.${a.cliente_id}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify(novo
      ? { aviso_pendente: aviso, aviso_enviado_em: new Date().toISOString(), aviso_reenvios: 0 }
      : { aviso_enviado_em: new Date().toISOString(), aviso_reenvios: (a.aviso_reenvios || 0) + 1 }),
  });
}
// "Guia de Tráfego (GT) (5): deferido ✅ · Concessão do CR: em análise na PF" — nome curto, agrupado e contado
// (as funções nomeServico/situacao ficam logo abaixo; são declarações de função, valem no arquivo inteiro)
const listar = lista => {
  const grupos = new Map();
  for (const p of lista) { const k = nomeServico(p.servico) + "|" + situacao(p.status); grupos.set(k, (grupos.get(k) || 0) + 1); }
  const itens = [...grupos.entries()].map(([k, n]) => { const [s, st] = k.split("|"); return `${s}${n > 1 ? ` (${n})` : ""}: ${st}`; });
  return itens.slice(0, 3).join(" · ") + (itens.length > 3 ? ` e mais ${itens.length - 3}` : "");
};

// Nome do serviço e situação como o cliente entende (iguais à mensagem do WhatsApp, src/components/BotaoAcompanhamento.tsx)
const semAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function nomeServico(servico) {
  const s = semAcento(servico);
  if (/guia de trafego/.test(s)) return "Guia de Tráfego (GT)";
  if (/apostilamento/.test(s)) return "Apostilamento do CR";
  if (/renovacao.*craf/.test(s)) return "Renovação do CRAF";
  if (/registrar arma|craf/.test(s)) return "Registro da arma (CRAF)";
  if (/aquisicao|autoriza/.test(s)) return "Autorização de compra de arma";
  if (/concessao|certificado de registro|registro para pessoa fisica/.test(s)) return "Concessão do CR";
  return servico || "Processo";
}
function situacao(status) {
  const s = semAcento(status);
  if (/^indeferid/.test(s)) return "indeferido (vamos te orientar)";
  if (/^deferid/.test(s)) return "deferido ✅";
  if (/analise/.test(s)) return "em análise na PF";
  if (/iniciado|fila/.test(s)) return "enviado, aguardando análise";
  if (/pagamento/.test(s)) return "aguardando pagamento da GRU";
  if (/documenta|exigencia|pendenc/.test(s)) return "aguardando documentação (já estamos cuidando)";
  if (/restitu|devolv/.test(s)) return "devolvido para correção (já estamos cuidando)";
  return String(status || "").toLowerCase();
}
// Aviso de consulta (o usuário pediu, 2026-11-22: "toda vez que eu consultar um processo, notificar o cliente que seu
// processo foi acompanhado pelo escritório", com mensagem elaborada e informativa). No máximo 1 a cada 6 horas por
// aparelho: a extensão regrava a lista a cada 10 minutos enquanto ela fica aberta.
const INTERVALO_CONSULTA = 6 * 3600 * 1000;
let avisosConsulta = 0;
function avisoDeConsulta(dele, url, tag) {
  const DOIS_DIAS = 2 * 86400000;
  const deferido = p => /^deferid/i.test(String(p.status || "").trim());
  const comDeferido = new Set(dele.filter(deferido).map(p => nomeServico(p.servico)));
  // processo já deferido há tempo não entra (só o deferido nos últimos 2 dias); indeferido antigo de serviço já deferido também não
  const andamento = dele
    .filter(p => !deferido(p) || (p.status_mudou_em && Date.now() - new Date(p.status_mudou_em).getTime() < DOIS_DIAS))
    .filter(p => !(/^indeferid/i.test(String(p.status || "").trim()) && comDeferido.has(nomeServico(p.servico))));
  const grupos = new Map();
  for (const p of andamento) {
    const chave = nomeServico(p.servico) + "|" + situacao(p.status);
    grupos.set(chave, (grupos.get(chave) || 0) + 1);
  }
  const linhas = [...grupos.entries()].slice(0, 3).map(([k, n]) => {
    const [serv, sit] = k.split("|");
    return `${serv}${n > 1 ? ` (${n})` : ""}: ${sit}`;
  });
  const resumo = linhas.length
    ? linhas.join(" · ") + (grupos.size > 3 ? ` e mais ${grupos.size - 3}` : "") + "."
    : "Seus processos estão em dia, sem pendências.";
  return {
    titulo: "✅ Seu processo foi acompanhado hoje",
    corpo: `A Passarinho Assessoria Bélica conferiu hoje seu processo na Polícia Federal. ${resumo} ` +
      "Seguimos acompanhando e avisamos assim que houver novidade. Toque para ver os detalhes.",
    url, tag,
  };
}
async function marcarConsulta(a) {
  if (SIMULAR) return;
  await sb(`push_acompanhamento?endpoint=eq.${encodeURIComponent(a.endpoint)}&cliente_id=eq.${a.cliente_id}`,
    { method: "PATCH", body: JSON.stringify({ avisado_consulta_ts: new Date().toISOString() }), headers: { Prefer: "return=minimal" } });
}

for (const cliente of new Set(inscricoes.map(i => i.cliente_id))) {
  const aparelhos = inscricoes.filter(i => i.cliente_id === cliente);
  const mudaram = pendentes.filter(p => p.cliente_id === cliente && !rascunho(p) && p.status);
  const url = `/acompanhamento/${cliente}`, tag = `acomp-${cliente}`;

  // 1) Status mudou: avisa a mudança (vale também como o aviso desta consulta)
  if (mudaram.length) {
    const aviso = { titulo: "Passarinho — atualização do seu processo", corpo: listar(mudaram) + ". Toque para ver.", url, tag };
    for (const a of aparelhos) if (await enviar(a, aviso)) { avisosMudanca++; await marcarHoje(a); await marcarConsulta(a); await guardarPendente(a, aviso, true); }
    continue;
  }
  // 2) O escritório consultou e nada mudou: "seu processo foi acompanhado" (1 a cada 6 horas por aparelho)
  const dele = processos.filter(p => p.cliente_id === cliente && !rascunho(p) && p.status);
  const ultimaConsulta = Math.max(0, ...dele.map(p => p.consultado_em ? new Date(p.consultado_em).getTime() : 0));
  // só consulta recente (o texto diz "hoje"; e quem ativou depois não recebe aviso de consulta antiga)
  if (ultimaConsulta && Date.now() - ultimaConsulta < 12 * 3600 * 1000) {
    const aviso = avisoDeConsulta(dele, url, tag);
    for (const a of aparelhos) {
      const ultimoAviso = a.avisado_consulta_ts ? new Date(a.avisado_consulta_ts).getTime() : 0;
      if (ultimaConsulta <= ultimoAviso || Date.now() - ultimoAviso < INTERVALO_CONSULTA) continue;
      if (await enviar(a, aviso)) { avisosConsulta++; await marcarConsulta(a); }
    }
  }
  // Aviso não aberto: manda de novo 1 vez por dia, até 3 vezes (o usuário pediu). Abriu → aviso_pendente fica vazio.
  for (const a of aparelhos) {
    if (!a.aviso_pendente || (a.aviso_reenvios || 0) >= REENVIOS_MAX) continue;
    if (a.aviso_enviado_em && Date.now() - new Date(a.aviso_enviado_em).getTime() < INTERVALO_REENVIO) continue;
    const aviso = { ...a.aviso_pendente, titulo: `Lembrete: ${String(a.aviso_pendente.titulo || "atualização do seu processo").replace(/^Lembrete: /, "")}` };
    if (await enviar(a, aviso)) { reenvios++; await guardarPendente(a, a.aviso_pendente, false); }
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
    // serviço com o nome curto e contado ("Guia de Tráfego (GT) (5)"), em vez de repetir o nome longo da PF 5 vezes
    const contagem = new Map();
    for (const p of deferidos.filter(p => p.cliente_id === c.id)) { const n = nomeServico(p.servico); contagem.set(n, (contagem.get(n) || 0) + 1); }
    const lista = [...contagem.entries()].map(([n, q]) => q > 1 ? `${n} (${q})` : n).join(", ");
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
  ` | avisos de mudança: ${avisosMudanca} | avisos de consulta: ${avisosConsulta} | enviados: ${enviados}` +
  ` | lembretes (não abertos): ${reenvios} | deferidos avisados ao escritório: ${deferidosAvisados} | inscrições removidas: ${removidas} | falhas: ${falhas}`);
if (falhas && !enviados) process.exit(1);
