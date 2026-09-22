import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const SUPABASE_URL = "https://qubkmecpxbsdphtmwvvw.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1YmttZWNweGJzZHBodG13dnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDI5NDIsImV4cCI6MjA4OTcxODk0Mn0.Y72dKZFiqCh-CMNLMyi5Yg7lOLGT4BsODQQO0FSD54E";
const BUCKET = "carteira-docs";

const TIPOS = [
  { key: "cr",   label: "CR",           desc: "Certificado de Registro",            emoji: "📄" },
  { key: "craf", label: "CRAF da Arma", desc: "Certificado de Registro de Arma de Fogo", emoji: "🔫" },
  { key: "gt",   label: "GT",           desc: "Guia de Tráfego",                    emoji: "📋" },
] as const;

interface CartDoc { tipo: string; arquivo_path: string; arquivo_nome: string; }
interface CarteiraData { id: string; nome: string; docs: CartDoc[]; }

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
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
    fetch(`${SUPABASE_URL}/rest/v1/rpc/get_carteira_v2`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ p_id: id }),
    })
      .then(r => r.json())
      .then(json => {
        if (!json || !json.nome) setErro(true);
        else setData(json);
        setLoading(false);
      })
      .catch(() => { setErro(true); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0f172a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:"#94a3b8" }}>
        <div style={{ width:40, height:40, border:"3px solid #334155", borderTopColor:"#3b82f6", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }} />
        <p style={{ fontSize:14 }}>Carregando carteira...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (erro || !data) return (
    <div style={{ minHeight:"100vh", background:"#0f172a", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ textAlign:"center", color:"#94a3b8", maxWidth:320 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
        <h2 style={{ color:"#f1f5f9", fontSize:18, marginBottom:8 }}>Carteira não encontrada</h2>
        <p style={{ fontSize:14 }}>Este link pode estar incorreto ou expirado.</p>
        <a href="https://wa.me/5592985032288" style={{ display:"inline-block", marginTop:20, padding:"10px 20px", background:"#25d366", color:"#fff", borderRadius:8, textDecoration:"none", fontSize:14, fontWeight:600 }}>
          📱 Falar com a Assessoria
        </a>
      </div>
    </div>
  );

  const docsMap = Object.fromEntries((data.docs ?? []).map(d => [d.tipo, d]));

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", padding:"24px 16px", fontFamily:"system-ui, sans-serif" }}>
      <div style={{ maxWidth:420, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <img src="https://rwinvestimentos.com.br/rw-logo.png" alt="Passarinho" style={{ height:72, objectFit:"contain", marginBottom:6 }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <p style={{ color:"#64748b", fontSize:11, margin:0 }}>PASSARINHO ASSESSORIA BÉLICA</p>
        </div>

        {/* Card cliente */}
        <div style={{ background:"#1e293b", borderRadius:16, padding:20, marginBottom:12, border:"1px solid #334155" }}>
          <p style={{ color:"#64748b", fontSize:11, margin:"0 0 2px", textTransform:"uppercase", letterSpacing:"0.1em" }}>Carteira Digital</p>
          <h1 style={{ color:"#f1f5f9", fontSize:20, fontWeight:700, margin:0 }}>{primeiroNome(data.nome)}</h1>
          <p style={{ color:"#94a3b8", fontSize:12, margin:"2px 0 0" }}>{data.nome}</p>
        </div>

        {/* Documentos */}
        <div style={{ background:"#1e293b", borderRadius:16, padding:20, marginBottom:12, border:"1px solid #334155" }}>
          <p style={{ color:"#64748b", fontSize:11, margin:"0 0 14px", textTransform:"uppercase", letterSpacing:"0.1em" }}>Seus Documentos</p>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {TIPOS.map(({ key, label, desc, emoji }) => {
              const doc = docsMap[key];
              return (
                <div key={key} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
                  padding:"14px 16px", borderRadius:12, border:`1px solid ${doc ? "#22c55e33" : "#334155"}`,
                  background: doc ? "#14291a" : "#0f172a",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{emoji}</span>
                    <div style={{ minWidth:0 }}>
                      <p style={{ color: doc ? "#86efac" : "#94a3b8", fontSize:14, fontWeight:700, margin:0 }}>{label}</p>
                      <p style={{ color:"#64748b", fontSize:11, margin:0 }}>{desc}</p>
                    </div>
                  </div>
                  {doc ? (
                    <a href={publicUrl(doc.arquivo_path)} target="_blank" rel="noopener noreferrer"
                      style={{ flexShrink:0, padding:"8px 14px", background:"#16a34a", color:"#fff", borderRadius:8, textDecoration:"none", fontSize:12, fontWeight:600, whiteSpace:"nowrap" }}>
                      ⬇ Baixar
                    </a>
                  ) : (
                    <span style={{ flexShrink:0, padding:"8px 14px", background:"#1e293b", color:"#475569", borderRadius:8, fontSize:12, border:"1px solid #334155" }}>
                      Pendente
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contato */}
        <a href="https://wa.me/5592985032288" style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", background:"#14532d", borderRadius:16, textDecoration:"none", color:"#fff", border:"1px solid #16a34a44" }}>
          <span style={{ fontSize:22 }}>📱</span>
          <div>
            <p style={{ margin:0, fontWeight:600, fontSize:14 }}>Dúvidas? WhatsApp</p>
            <p style={{ margin:0, fontSize:11, opacity:0.7 }}>Passarinho Assessoria Bélica</p>
          </div>
        </a>

        <p style={{ textAlign:"center", color:"#334155", fontSize:10, marginTop:20 }}>
          rwinvestimentos.com.br
        </p>
      </div>
    </div>
  );
}
