import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const SUPABASE_URL = "https://qubkmecpxbsdphtmwvvw.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1YmttZWNweGJzZHBodG13dnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDI5NDIsImV4cCI6MjA4OTcxODk0Mn0.Y72dKZFiqCh-CMNLMyi5Yg7lOLGT4BsODQQO0FSD54E";
const BUCKET = "carteira-docs";

const TIPOS = [
  { key: "cr",   label: "CR",           desc: "Certificado de Registro",                emoji: "📄" },
  { key: "craf", label: "CRAF da Arma", desc: "Certificado de Registro de Arma de Fogo", emoji: "🔫" },
  { key: "gt",   label: "GT",           desc: "Guia de Tráfego",                         emoji: "📋" },
] as const;

interface CartDoc { tipo: string; arquivo_path: string; arquivo_nome: string; }
interface CarteiraData { id: string; nome: string; docs: CartDoc[]; }

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome;
}

// Mostra só a primeira metade do PDF (frente do documento) via iframe clippado
function PdfFirstPage({ url, onClick }: { url: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ cursor:"pointer", borderRadius:8, overflow:"hidden", background:"#fff", position:"relative", height:270 }}>
      <iframe
        src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        title="preview"
        style={{ width:"100%", height:"560px", border:"none", display:"block", pointerEvents:"none" }}
      />
    </div>
  );
}

async function baixarArquivo(url: string, nomeArquivo: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  } catch {
    window.open(url, "_blank");
  }
}

function PreviewModal({ url, nome, onClose }: { url: string; nome: string; onClose: () => void }) {
  const isPdf = url.toLowerCase().includes(".pdf") || url.includes("pdf");
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.88)", display:"flex", flexDirection:"column", padding:0 }}
    >
      {/* Barra topo */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:"#1e293b", flexShrink:0, gap:12 }}>
        <p style={{ color:"#f1f5f9", fontSize:13, fontWeight:600, margin:0, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{nome}</p>
        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
          <button onClick={() => baixarArquivo(url, nome)}
            style={{ padding:"6px 14px", background:"#16a34a", color:"#fff", borderRadius:8, border:"none", fontSize:12, fontWeight:600, cursor:"pointer" }}>
            ⬇ Baixar
          </button>
          <button onClick={onClose}
            style={{ width:32, height:32, borderRadius:8, background:"#334155", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
            ✕
          </button>
        </div>
      </div>

      {/* Preview */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", padding:8 }}>
        {isPdf ? (
          <iframe
            src={url + "#toolbar=0&navpanes=0"}
            title={nome}
            style={{ width:"100%", height:"100%", border:"none", borderRadius:8, background:"#fff" }}
          />
        ) : (
          <img src={url} alt={nome} style={{ maxWidth:"100%", maxHeight:"100%", borderRadius:8, objectFit:"contain" }} />
        )}
      </div>
    </div>
  );
}

export default function CarteiraCliente() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CarteiraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [preview, setPreview] = useState<{ url: string; nome: string } | null>(null);

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

  // Fecha preview com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
    <>
      {preview && <PreviewModal url={preview.url} nome={preview.nome} onClose={() => setPreview(null)} />}

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
                const url = doc ? publicUrl(doc.arquivo_path) : null;
                const isPdf = url ? (doc!.arquivo_nome?.toLowerCase().endsWith(".pdf") || doc!.arquivo_path?.toLowerCase().endsWith(".pdf")) : false;
                return (
                  <div key={key} style={{
                    borderRadius:12, border:`1px solid ${doc ? "#22c55e33" : "#334155"}`,
                    background: doc ? "#14291a" : "#0f172a", overflow:"hidden",
                  }}>
                    {/* Linha topo */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"12px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                        <span style={{ fontSize:18, flexShrink:0 }}>{emoji}</span>
                        <div style={{ minWidth:0 }}>
                          <p style={{ color: doc ? "#86efac" : "#94a3b8", fontSize:13, fontWeight:700, margin:0 }}>{label}</p>
                          <p style={{ color:"#64748b", fontSize:10, margin:0 }}>{desc}</p>
                        </div>
                      </div>
                      {doc && url ? (
                        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                          <button
                            onClick={() => setPreview({ url, nome: doc.arquivo_nome || label })}
                            style={{ padding:"6px 10px", background:"#1e3a5f", color:"#93c5fd", borderRadius:7, border:"1px solid #3b82f633", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                            ⛶ Expandir
                          </button>
                          <button onClick={() => baixarArquivo(url, doc.arquivo_nome || `${label}.pdf`)}
                            style={{ padding:"6px 10px", background:"#16a34a", color:"#fff", borderRadius:7, border:"none", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                            ⬇ Baixar
                          </button>
                        </div>
                      ) : (
                        <span style={{ flexShrink:0, padding:"6px 12px", background:"#1e293b", color:"#475569", borderRadius:7, fontSize:11, border:"1px solid #334155" }}>
                          Pendente
                        </span>
                      )}
                    </div>

                    {/* Preview inline */}
                    {doc && url && (
                      <div style={{ margin:"0 10px 10px" }}>
                        {isPdf ? (
                          <PdfFirstPage url={url} onClick={() => setPreview({ url, nome: doc.arquivo_nome || label })} />
                        ) : (
                          <div style={{ borderRadius:8, overflow:"hidden", cursor:"pointer" }} onClick={() => setPreview({ url, nome: doc.arquivo_nome || label })}>
                            <img src={url} alt={label} style={{ width:"100%", display:"block" }} />
                          </div>
                        )}
                        <div style={{ padding:"4px 10px", fontSize:10, color:"#475569", textAlign:"center" }}>
                          Toque para ampliar
                        </div>
                      </div>
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
    </>
  );
}
