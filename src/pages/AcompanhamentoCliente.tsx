import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { pushSuportado, inscricaoAtual, ativarPush, abertoComoApp, ehIOS } from "@/lib/avisosPush";

// Página pública que o cliente abre pelo link /acompanhamento/<id do cliente> (Clientes Armas).
// Mostra cada processo como o Sinarm CAC mostra ("Fluxo de Processo" e as colunas da lista de processos), com o status
// que o Passarinho grava quando o escritório abre a lista na conta gov do cliente (Sinarm CAC ou Portal PF).
// O cliente pode ativar o aviso no celular: o GitHub (avisos-acompanhamento.yml) avisa quando um status muda.
const SUPABASE_URL = "https://qubkmecpxbsdphtmwvvw.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Cores do Sinarm CAC
const VERDE = "#00796b", VERDE_CLARO = "#009688", CABECALHO = "#d0ebe8", FUNDO = "#f2f2f2", BORDA = "#cfd8dc";
const TEXTO = "#212121", APAGADO = "#616161", FONT = "Roboto, 'Segoe UI', system-ui, sans-serif";

interface Processo {
  protocolo: string; servico: string; descricao: string; status: string;
  data_solicitacao?: string; status_desde?: string; consultado_em?: string;
  // origem: "sinarm" (Sinarm CAC, servicos.pf.gov.br) ou "portal" (Portal PF); motivo, GRU e fila só vêm do Sinarm CAC
  origem?: string; motivo?: string; gru?: string; posicao_fila?: string;
}
interface Dados { nome: string; etapa?: string; processos: Processo[]; }

// Etapa do cliente no escritório (o status do card em Clientes Armas), só enquanto não há nada lido da PF
const ETAPAS: Record<string, string> = {
  doc: "Reunindo os documentos do CR",
  docaut: "Reunindo os documentos da Autorização de Compra",
  analise: "CR em análise na Polícia Federal",
  deferido: "CR deferido",
  autor: "Autorização de Compra em análise",
  doccraf: "Reunindo os documentos do CRAF",
  craf: "CRAF em análise",
  gt: "Emissão da Guia de Tráfego",
  completo: "Processo concluído",
};

// "Fluxo de Processo" do Sinarm CAC
const FLUXO = ["Pendente", "Iniciado", "Pronto para Análise", "Em Análise", "Restituído", "Finalizado (Deferido/Indeferido)"];
const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function passoDoStatus(status: string) {
  const s = sem(status);
  if (/deferid|indeferid|conclu|finaliz|cancelad|arquivad/.test(s)) return 5;
  if (/restitu/.test(s)) return 4;
  if (/em analise|processament/.test(s)) return 3;
  if (/pronto/.test(s)) return 2;
  if (/iniciad/.test(s)) return 1;
  return 0; // Pendente, "Aguardando documentação" (Portal PF)...
}
function corDoStatus(status: string) {
  const s = sem(status);
  if (/indeferid|cancelad|arquivad|negad|reprovad/.test(s)) return { cor: "#c62828", fundo: "#ffebee" };
  if (/deferid|conclu|emitid|aprovad|finalizad/.test(s)) return { cor: "#2e7d32", fundo: "#e8f5e9" };
  if (/analise|processament|tramit|pronto|iniciad/.test(s)) return { cor: "#1565c0", fundo: "#e3f2fd" };
  if (/aguardand|pendent|exigenc|restitu/.test(s)) return { cor: "#ef6c00", fundo: "#fff3e0" };
  return { cor: VERDE, fundo: "#e0f2f1" };
}

const dataHora = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

function Fluxo({ passo }: { passo: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", padding: "14px 6px 6px" }}>
      {FLUXO.map((rotulo, i) => {
        const feito = i < passo, atual = i === passo;
        return (
          <div key={rotulo} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            {i > 0 && (
              <div style={{ position: "absolute", top: 11, right: "50%", width: "100%", height: 2, background: i <= passo ? VERDE_CLARO : "#bdbdbd" }} />
            )}
            <div style={{
              position: "relative", width: 24, height: 24, borderRadius: "50%", fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
              background: atual ? VERDE : feito ? VERDE_CLARO : "#757575",
              boxShadow: atual ? `0 0 0 4px rgba(0,150,136,0.25)` : "none",
            }}>{i + 1}</div>
            <div style={{ fontSize: 10, marginTop: 6, textAlign: "center", lineHeight: 1.2, padding: "0 2px",
              color: atual ? VERDE : APAGADO, fontWeight: atual ? 700 : 400 }}>{rotulo}</div>
          </div>
        );
      })}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, 38%) 1fr", borderTop: `1px solid ${BORDA}` }}>
      <div style={{ background: CABECALHO, padding: "9px 10px", fontSize: 12, fontWeight: 500, color: TEXTO }}>{rotulo}</div>
      <div style={{ background: FUNDO, padding: "9px 10px", fontSize: 13, color: TEXTO, wordBreak: "break-word" }}>{valor || "—"}</div>
    </div>
  );
}

export default function AcompanhamentoCliente() {
  const { id } = useParams();
  const [dados, setDados] = useState<Dados | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [avisos, setAvisos] = useState<"?" | "ativo" | "inativo" | "ocupado">("?");
  const [msgAviso, setMsgAviso] = useState("");
  const chaveLocal = `acompanhamento-avisos-${id}`;

  useEffect(() => {
    document.title = "Acompanhamento do processo";
    if (!id) { setEstado("erro"); return; }
    fetch(`${SUPABASE_URL}/rest/v1/rpc/get_acompanhamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ p_id: id }),
    })
      .then(r => r.json())
      .then(j => { if (j?.nome) { setDados(j); setEstado("ok"); } else setEstado("erro"); })
      .catch(() => setEstado("erro"));

    // Instalar na tela de início (no iPhone é o único jeito de receber aviso): abre direto neste link
    const criados: Element[] = [], doSite: Element[] = [];
    document.querySelectorAll('link[rel="manifest"]').forEach(l => { doSite.push(l); l.remove(); });
    const icone = `${window.location.origin}/carteira-icon5.png`;
    const manifesto = URL.createObjectURL(new Blob([JSON.stringify({
      name: "Acompanhamento do processo", short_name: "Meu processo", start_url: window.location.href,
      display: "standalone", background_color: "#ffffff", theme_color: VERDE,
      icons: [{ src: icone, sizes: "512x512", type: "image/png", purpose: "any" }],
    })], { type: "application/manifest+json" }));
    const add = (tag: string, attrs: Record<string, string>) => {
      const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el); criados.push(el);
    };
    add("link", { rel: "manifest", href: manifesto });
    add("link", { rel: "apple-touch-icon", href: icone });
    add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    add("meta", { name: "apple-mobile-web-app-title", content: "Meu processo" });
    add("meta", { name: "theme-color", content: VERDE });

    // avisos: ativo se este aparelho tem inscrição e ativou neste link
    (async () => {
      let marcado = false;
      try { marcado = localStorage.getItem(chaveLocal) === "1"; } catch { /* sem armazenamento */ }
      const sub = await inscricaoAtual().catch(() => null);
      setAvisos(sub && marcado ? "ativo" : "inativo");
    })();

    return () => {
      document.title = "RW Investimentos Financeiros";
      criados.forEach(e => e.remove());
      doSite.forEach(e => document.head.appendChild(e));
      URL.revokeObjectURL(manifesto);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rpc = (fn: string, corpo: object) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify(corpo),
  }).then(r => { if (!r.ok) throw new Error(`rpc ${r.status}`); });

  const ativarAvisos = async () => {
    setAvisos("ocupado"); setMsgAviso("");
    try {
      const sub = await ativarPush();
      await rpc("salvar_push_acompanhamento", { p_cliente: id, p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth });
      try { localStorage.setItem(chaveLocal, "1"); } catch { /* sem armazenamento */ }
      setAvisos("ativo");
    } catch (e) {
      const m = (e as Error).message;
      setMsgAviso(m === "bloqueado"
        ? "As notificações estão bloqueadas para este site. Libere nas configurações do navegador e tente de novo."
        : "Não foi possível ativar os avisos neste aparelho.");
      setAvisos("inativo");
    }
  };
  const desativarAvisos = async () => {
    setAvisos("ocupado");
    try {
      const sub = await inscricaoAtual();
      // só tira deste link: a mesma inscrição pode estar servindo os avisos da Carteira CAC
      if (sub) await rpc("remover_push_acompanhamento", { p_cliente: id, p_endpoint: sub.endpoint });
    } catch { /* sem rede: fica para a próxima */ }
    try { localStorage.removeItem(chaveLocal); } catch { /* sem armazenamento */ }
    setAvisos("inativo");
  };

  const tela: CSSProperties = { minHeight: "100vh", background: "#eceff1", color: TEXTO, fontFamily: FONT };

  if (estado === "carregando") return (
    <div style={{ ...tela, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: APAGADO, fontSize: 14 }}>Carregando…</p>
    </div>
  );
  if (estado === "erro" || !dados) return (
    <div style={{ ...tela, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 16 }}>
      <div>
        <p style={{ fontSize: 16, fontWeight: 600 }}>Link não encontrado</p>
        <p style={{ color: APAGADO, fontSize: 13, marginTop: 6 }}>Confira o link com a Passarinho Assessoria.</p>
      </div>
    </div>
  );

  // Rascunho é pedido que o escritório ainda está montando: não mostra um por um (pode haver vários)
  const enviados = dados.processos.filter(p => !/rascunho/i.test(p.descricao));
  const temRascunho = dados.processos.some(p => /rascunho/i.test(p.descricao));
  const ultimaConsulta = dados.processos.map(p => p.consultado_em || "").sort().pop();
  const etapa = dados.etapa && enviados.length === 0 ? ETAPAS[dados.etapa] : "";
  const iphoneSemApp = ehIOS() && !abertoComoApp();

  const caixa: CSSProperties = { background: "#fff", borderRadius: 4, boxShadow: "0 1px 3px rgba(0,0,0,0.15)", overflow: "hidden" };

  return (
    <div style={tela}>
      {/* Barra de cima no estilo do Sinarm CAC */}
      <div style={{ background: VERDE_CLARO, color: "#fff", padding: "14px 16px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <p style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.85 }}>Passarinho Assessoria · Acompanhamento</p>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 2px", lineHeight: 1.2 }}>{dados.nome}</h1>
          {ultimaConsulta && <p style={{ fontSize: 12, opacity: 0.9 }}>Última consulta na Polícia Federal: {dataHora(ultimaConsulta)}</p>}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Aviso no celular */}
        {pushSuportado() && avisos !== "?" && (
          <div style={{ ...caixa, padding: 14 }}>
            {avisos === "ativo" ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <p style={{ fontSize: 13, color: "#2e7d32", fontWeight: 500 }}>🔔 Avisos ativados: você recebe uma notificação quando o status mudar.</p>
                <button onClick={desativarAvisos} style={{ background: "none", border: "none", color: APAGADO, fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>Desativar</button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, marginBottom: 10 }}>Quer ser avisado no celular quando o status do seu processo mudar?</p>
                <button onClick={ativarAvisos} disabled={avisos === "ocupado"}
                  style={{ background: VERDE_CLARO, color: "#fff", border: "none", borderRadius: 4, padding: "10px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer", opacity: avisos === "ocupado" ? 0.6 : 1 }}>
                  {avisos === "ocupado" ? "Ativando…" : "🔔 Avisar no meu celular"}
                </button>
                {msgAviso && <p style={{ fontSize: 12, color: "#c62828", marginTop: 8 }}>{msgAviso}</p>}
              </>
            )}
          </div>
        )}
        {iphoneSemApp && (
          <div style={{ ...caixa, padding: 14, fontSize: 13, lineHeight: 1.5 }}>
            📱 <b>No iPhone</b>, para receber aviso no celular: toque em <b>Compartilhar</b> (o quadrado com a seta) e depois em
            <b> Adicionar à Tela de Início</b>. Abra pelo ícone criado e toque em “Avisar no meu celular”.
          </div>
        )}

        {etapa && (
          <div style={{ ...caixa, padding: 14 }}>
            <p style={{ fontSize: 11, color: APAGADO, textTransform: "uppercase", letterSpacing: "0.08em" }}>Etapa atual</p>
            <p style={{ fontSize: 16, fontWeight: 600, marginTop: 4, color: VERDE }}>{etapa}</p>
          </div>
        )}

        {enviados.length === 0 ? (
          <div style={{ ...caixa, padding: 14, fontSize: 14, color: APAGADO }}>
            {temRascunho
              ? "O pedido está sendo preparado pelo escritório e ainda não foi enviado à Polícia Federal."
              : "Ainda não há solicitação registrada. Assim que o escritório consultar o sistema da Polícia Federal, o status aparece aqui."}
          </div>
        ) : enviados.map(p => {
          const c = corDoStatus(p.status);
          return (
            <div key={p.protocolo} style={caixa}>
              <div style={{ background: VERDE, color: "#fff", padding: "10px 14px" }}>
                <p style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.85 }}>
                  {p.origem === "sinarm" ? "Sinarm CAC" : "Portal PF"}
                </p>
                <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginTop: 2 }}>{p.servico || "Solicitação"}</p>
              </div>
              <p style={{ fontSize: 12, color: VERDE, padding: "12px 14px 0", fontWeight: 500 }}>Fluxo de Processo</p>
              <Fluxo passo={passoDoStatus(p.status)} />
              <div style={{ margin: "10px 0 0" }}>
                <Linha rotulo="Nr Protocolo" valor={p.protocolo} />
                <Linha rotulo="Data de Entrada" valor={p.data_solicitacao} />
                <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, 38%) 1fr", borderTop: `1px solid ${BORDA}` }}>
                  <div style={{ background: CABECALHO, padding: "9px 10px", fontSize: 12, fontWeight: 500 }}>Situação do Processo</div>
                  <div style={{ background: FUNDO, padding: "7px 10px" }}>
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 12, fontSize: 13, fontWeight: 600, color: c.cor, background: c.fundo }}>
                      {p.status || "Sem status"}
                    </span>
                  </div>
                </div>
                {p.origem === "sinarm" && <Linha rotulo="Motivo" valor={p.motivo} />}
                {p.origem === "sinarm" && <Linha rotulo="Situação da GRU" valor={p.gru} />}
                {p.origem === "sinarm" && <Linha rotulo="Posição na Fila de Análise" valor={p.posicao_fila} />}
              </div>
              {p.consultado_em && (
                // última vez que o escritório abriu a lista na conta gov do cliente: muda a cada consulta,
                // mesmo sem mudança de status (o cliente vê que o processo está sendo acompanhado)
                <p style={{ fontSize: 11, color: APAGADO, padding: "8px 14px 10px", background: VERDE_CLARO + "14" }}>
                  Status conferido pelo escritório em {dataHora(p.consultado_em)}
                </p>
              )}
            </div>
          );
        })}

        <p style={{ color: APAGADO, fontSize: 11, lineHeight: 1.5 }}>
          O status é atualizado cada vez que o escritório consulta o sistema da Polícia Federal. Dúvidas? Fale com a Passarinho Assessoria.
        </p>
      </div>
    </div>
  );
}
