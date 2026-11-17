import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";

// Página pública que o cliente abre pelo link /acompanhamento/<id do cliente> (Clientes Armas).
// Mostra a etapa do processo no escritório e o status de cada solicitação no Portal PF, que o Passarinho grava
// sempre que o escritório entra na conta gov do cliente (tabela processos_pf, lida pela função get_acompanhamento).
const SUPABASE_URL = "https://qubkmecpxbsdphtmwvvw.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const BG = "#0b0908", CARD_BG = "#131110", GOLD = "#d4a730", GOLD_BORDER = "rgba(212,167,48,0.22)";
const FG = "#ede7d9", FG_MUTED = "#807060", FONT = "'Space Grotesk', system-ui, sans-serif";

interface Processo {
  protocolo: string; servico: string; descricao: string; status: string;
  data_solicitacao?: string; status_desde?: string; consultado_em?: string;
  // origem: "sinarm" (Sinarm CAC, servicos.pf.gov.br) ou "portal" (Portal PF); motivo, GRU e fila só vêm do Sinarm CAC
  origem?: string; motivo?: string; gru?: string; posicao_fila?: string;
}
interface Dados { nome: string; etapa?: string; processos: Processo[]; }

// Etapa do cliente no escritório (o status do card em Clientes Armas), em palavras para o cliente
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

// Cor do status como a PF escreve ("Aguardando documentação", "Em análise", "Deferido"...)
function corDoStatus(status: string) {
  const s = status.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/indeferid|cancelad|arquivad|negad|reprovad/.test(s)) return { cor: "#ff8a80", fundo: "rgba(255,138,128,0.12)" };
  if (/deferid|conclu|emitid|aprovad|finalizad/.test(s)) return { cor: "#4ade80", fundo: "rgba(74,222,128,0.12)" };
  if (/analise|processament|tramit/.test(s)) return { cor: "#60a5fa", fundo: "rgba(96,165,250,0.12)" };
  if (/aguardand|pendent|exigenc/.test(s)) return { cor: "#fbbf24", fundo: "rgba(251,191,36,0.12)" };
  return { cor: GOLD, fundo: "rgba(212,167,48,0.12)" };
}

const dataHora = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function AcompanhamentoCliente() {
  const { id } = useParams();
  const [dados, setDados] = useState<Dados | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");

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
    return () => { document.title = "RW Investimentos Financeiros"; };
  }, [id]);

  const tela: CSSProperties = { minHeight: "100vh", background: BG, color: FG, fontFamily: FONT, padding: "24px 16px" };

  if (estado === "carregando") return (
    <div style={{ ...tela, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: FG_MUTED, fontSize: 14 }}>Carregando…</p>
    </div>
  );
  if (estado === "erro" || !dados) return (
    <div style={{ ...tela, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div>
        <p style={{ fontSize: 16, fontWeight: 600 }}>Link não encontrado</p>
        <p style={{ color: FG_MUTED, fontSize: 13, marginTop: 6 }}>Confira o link com a RW Investimentos.</p>
      </div>
    </div>
  );

  // Rascunho é pedido que o escritório ainda está montando: não mostra um por um (pode haver vários)
  const enviados = dados.processos.filter(p => !/rascunho/i.test(p.descricao));
  const temRascunho = dados.processos.some(p => /rascunho/i.test(p.descricao));
  const ultimaConsulta = dados.processos.map(p => p.consultado_em || "").sort().pop();
  // A etapa do escritório só aparece enquanto não há nada lido da Polícia Federal: com o status real da PF
  // (Sinarm CAC ou Portal PF) ela poderia contradizer o que a PF diz
  const etapa = dados.etapa && enviados.length === 0 ? ETAPAS[dados.etapa] : "";

  return (
    <div style={tela}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <p style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          RW Investimentos · Acompanhamento
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 2px", lineHeight: 1.2 }}>{dados.nome}</h1>
        {ultimaConsulta && (
          <p style={{ color: FG_MUTED, fontSize: 12 }}>Última consulta na Polícia Federal: {dataHora(ultimaConsulta)}</p>
        )}

        {etapa && (
          <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: CARD_BG, border: `1px solid ${GOLD_BORDER}` }}>
            <p style={{ color: FG_MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>Etapa atual</p>
            <p style={{ fontSize: 16, fontWeight: 600, marginTop: 4, color: GOLD }}>{etapa}</p>
          </div>
        )}

        <h2 style={{ fontSize: 13, fontWeight: 700, margin: "22px 0 8px", color: FG_MUTED, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Solicitações na Polícia Federal
        </h2>

        {enviados.length === 0 ? (
          <div style={{ padding: 14, borderRadius: 12, background: CARD_BG, border: `1px solid ${GOLD_BORDER}`, fontSize: 14, color: FG_MUTED }}>
            {temRascunho
              ? "O pedido está sendo preparado pelo escritório e ainda não foi enviado à Polícia Federal."
              : "Ainda não há solicitação registrada. Assim que o escritório consultar o Portal da PF, o status aparece aqui."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {enviados.map(p => {
              const c = corDoStatus(p.status);
              return (
                <div key={p.protocolo} style={{ padding: 14, borderRadius: 12, background: CARD_BG, border: `1px solid ${GOLD_BORDER}` }}>
                  <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                    {p.origem === "sinarm" ? "Sinarm CAC" : "Portal PF"}
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{p.servico || "Solicitação"}</p>
                  <p style={{ color: FG_MUTED, fontSize: 12, marginTop: 3 }}>
                    Protocolo {p.protocolo}{p.data_solicitacao ? ` · aberto em ${p.data_solicitacao}` : ""}
                  </p>
                  <span style={{ display: "inline-block", marginTop: 10, padding: "4px 10px", borderRadius: 999, fontSize: 13, fontWeight: 600, color: c.cor, background: c.fundo }}>
                    {p.status || "Sem status"}
                  </span>
                  {p.motivo && <p style={{ fontSize: 12, marginTop: 8 }}><span style={{ color: FG_MUTED }}>Motivo:</span> {p.motivo}</p>}
                  {(p.gru || p.posicao_fila) && (
                    <p style={{ fontSize: 12, marginTop: 6, color: FG_MUTED }}>
                      {p.gru && <>GRU: <span style={{ color: FG }}>{p.gru}</span></>}
                      {p.gru && p.posicao_fila && " · "}
                      {p.posicao_fila && <>Posição na fila de análise: <span style={{ color: FG }}>{p.posicao_fila}</span></>}
                    </p>
                  )}
                  {p.status_desde && (
                    // é quando o escritório viu este status pela 1ª vez, não a data da decisão da PF
                    <p style={{ color: FG_MUTED, fontSize: 11, marginTop: 6 }}>Status conferido pelo escritório em {dataHora(p.status_desde)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p style={{ color: FG_MUTED, fontSize: 11, marginTop: 24, lineHeight: 1.5 }}>
          O status é atualizado cada vez que o escritório consulta o Portal da Polícia Federal. Dúvidas? Fale com a RW Investimentos.
        </p>
      </div>
    </div>
  );
}
