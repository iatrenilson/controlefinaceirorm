import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const SUPABASE_URL = "https://qubkmecpxbsdphtmwvvw.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1YmttZWNweGJzZHBodG13dnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDI5NDIsImV4cCI6MjA4OTcxODk0Mn0.Y72dKZFiqCh-CMNLMyi5Yg7lOLGT4BsODQQO0FSD54E";

const STATUS_LABELS: Record<string, string> = {
  doc:      "Doc. CR",
  docaut:   "Doc. Aut.",
  deferido: "CR defer.",
  analise:  "CR Analise",
  autor:    "Aut. Analise",
  craf:     "Craf. Analise",
  completo: "Concluído",
};

const STATUS_STEPS = ["doc", "docaut", "analise", "craf", "autor", "deferido", "completo"];

const STATUS_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  doc:      { bg: "#1e3a5f", text: "#93c5fd", border: "#3b82f6" },
  docaut:   { bg: "#1e3a5f", text: "#93c5fd", border: "#60a5fa" },
  deferido: { bg: "#3b1f1f", text: "#fca5a5", border: "#ef4444" },
  analise:  { bg: "#1a3a2a", text: "#86efac", border: "#22c55e" },
  autor:    { bg: "#2d2a1a", text: "#fde68a", border: "#eab308" },
  craf:     { bg: "#2a1a3a", text: "#d8b4fe", border: "#a855f7" },
  completo: { bg: "#1a2a1a", text: "#86efac", border: "#16a34a" },
};

interface CarteiraData {
  id: string;
  nome: string;
  status: string;
  dataEntradaProcesso?: string;
  dataDeferimento?: string;
  cidade?: string;
  estado?: string;
}

function diasNoProcesso(dataEntrada?: string): number | null {
  if (!dataEntrada) return null;
  const ini = new Date(dataEntrada);
  const hoje = new Date();
  return Math.max(0, Math.floor((hoje.getTime() - ini.getTime()) / 86400000));
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome;
}

export default function CarteiraCliente() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CarteiraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!id) { setErro(true); setLoading(false); return; }
    fetch(`${SUPABASE_URL}/rest/v1/rpc/get_carteira_cliente`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON,
        "Authorization": `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({ p_id: id }),
    })
      .then(r => r.json())
      .then(json => {
        if (!json || !json.nome) { setErro(true); }
        else { setData(json); }
        setLoading(false);
      })
      .catch(() => { setErro(true); setLoading(false); });
  }, [id]);

  const status = data?.status ?? "doc";
  const cor = STATUS_COLOR[status] ?? STATUS_COLOR.doc;
  const stepIdx = STATUS_STEPS.indexOf(status);
  const dias = diasNoProcesso(data?.dataEntradaProcesso);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#94a3b8" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #334155", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ fontSize: 14 }}>Carregando carteira...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (erro || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", color: "#94a3b8", maxWidth: 320 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h2 style={{ color: "#f1f5f9", fontSize: 18, marginBottom: 8 }}>Carteira não encontrada</h2>
          <p style={{ fontSize: 14 }}>Este link pode estar incorreto ou expirado. Entre em contato com a assessoria.</p>
          <a href="https://wa.me/5592985032288" style={{ display: "inline-block", marginTop: 20, padding: "10px 20px", background: "#25d366", color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            📱 Falar com a Assessoria
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img
            src="https://rwinvestimentos.com.br/rw-logo.png"
            alt="Passarinho Assessoria Bélica"
            style={{ height: 80, objectFit: "contain", marginBottom: 8 }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>ASSESSORIA BÉLICA</p>
        </div>

        {/* Card principal */}
        <div style={{ background: "#1e293b", borderRadius: 16, padding: 24, marginBottom: 16, border: "1px solid #334155" }}>
          <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Carteira Digital</p>
          <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>
            {primeiroNome(data.nome)}
          </h1>
          {data.cidade && (
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
              {data.cidade}{data.estado ? ` — ${data.estado}` : ""}
            </p>
          )}
        </div>

        {/* Status */}
        <div style={{ background: "#1e293b", borderRadius: 16, padding: 24, marginBottom: 16, border: `1px solid ${cor.border}`, backgroundColor: cor.bg }}>
          <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Status do Processo</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: cor.border, flexShrink: 0 }} />
            <span style={{ color: cor.text, fontSize: 18, fontWeight: 700 }}>{STATUS_LABELS[status] ?? status}</span>
          </div>
          {dias !== null && (
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "8px 0 0" }}>
              {dias === 0 ? "Iniciado hoje" : `${dias} dia${dias !== 1 ? "s" : ""} em processo`}
            </p>
          )}
          {status === "completo" && data.dataDeferimento && (
            <p style={{ color: "#86efac", fontSize: 13, margin: "4px 0 0" }}>
              ✓ Concluído em {new Date(data.dataDeferimento).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        {/* Barra de progresso */}
        <div style={{ background: "#1e293b", borderRadius: 16, padding: 20, marginBottom: 16, border: "1px solid #334155" }}>
          <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Progresso</p>
          <div style={{ display: "flex", gap: 4 }}>
            {STATUS_STEPS.map((s, i) => (
              <div
                key={s}
                title={STATUS_LABELS[s]}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  background: i <= stepIdx ? STATUS_COLOR[s].border : "#334155",
                  transition: "background 0.3s",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ color: "#475569", fontSize: 10 }}>Início</span>
            <span style={{ color: "#475569", fontSize: 10 }}>Concluído</span>
          </div>
        </div>

        {/* Contato */}
        <div style={{ background: "#1e293b", borderRadius: 16, padding: 20, border: "1px solid #334155" }}>
          <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Dúvidas?</p>
          <a
            href="https://wa.me/5592985032288"
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#15803d", borderRadius: 10, textDecoration: "none", color: "#fff" }}
          >
            <span style={{ fontSize: 20 }}>📱</span>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>WhatsApp Assessoria</p>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Fale com a Passarinho Assessoria Bélica</p>
            </div>
          </a>
        </div>

        <p style={{ textAlign: "center", color: "#334155", fontSize: 11, marginTop: 24 }}>
          Passarinho Assessoria Bélica · rwinvestimentos.com.br
        </p>
      </div>
    </div>
  );
}
