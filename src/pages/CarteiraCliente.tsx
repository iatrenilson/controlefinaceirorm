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

interface CartDoc { id?: string; tipo: string; arquivo_path: string; arquivo_nome: string; data_expedicao?: string; data_validade?: string; numero_serie?: string; }
interface CarteiraData { id: string; nome: string; docs: CartDoc[]; }

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome;
}


async function baixarArquivo(url: string, nomeArquivo: string) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) {
    window.open(url, "_blank");
    return;
  }
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
  const isPdf = nome.toLowerCase().endsWith(".pdf") || url.toLowerCase().includes(".pdf") || (!nome.match(/\.(png|jpg|jpeg|gif|webp)$/i) && !url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i));
  const viewerUrl = isPdf
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : url;
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.88)", display:"flex", flexDirection:"column", padding:0 }}
    >
      {/* Barra topo */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:"#0d0e13", borderBottom:"1px solid rgba(201,162,39,0.28)", flexShrink:0, gap:12 }}>
        <p style={{ color:"#e8d5a0", fontSize:13, fontWeight:600, margin:0, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{nome}</p>
        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
          <button onClick={() => baixarArquivo(url, nome)}
            style={{ padding:"6px 14px", background:"#c9a227", color:"#0a0b0f", borderRadius:8, border:"none", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            ⬇ Baixar
          </button>
          <button onClick={onClose}
            style={{ width:32, height:32, borderRadius:8, background:"rgba(201,162,39,0.10)", border:"1px solid rgba(201,162,39,0.28)", color:"#c9a227", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
            ✕
          </button>
        </div>
      </div>

      {/* Preview */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", padding:8 }}>
        {isPdf ? (
          <iframe
            src={viewerUrl}
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

  const BG = "linear-gradient(160deg, #0a0b0f 0%, #111318 60%, #0d0e13 100%)";
  const GOLD = "#c9a227";
  const GOLD_DIM = "rgba(201,162,39,0.18)";
  const GOLD_BORDER = "rgba(201,162,39,0.28)";
  const CARD_BG = "rgba(255,255,255,0.03)";

  if (loading) return (
    <div style={{ minHeight:"100vh", background:BG, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:"#8b7d5a" }}>
        <div style={{ width:40, height:40, border:`3px solid ${GOLD_BORDER}`, borderTopColor:GOLD, borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }} />
        <p style={{ fontSize:14 }}>Carregando carteira...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (erro || !data) return (
    <div style={{ minHeight:"100vh", background:BG, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ textAlign:"center", color:"#8b7d5a", maxWidth:320 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
        <h2 style={{ color:"#e8d5a0", fontSize:18, marginBottom:8 }}>Carteira não encontrada</h2>
        <p style={{ fontSize:14 }}>Este link pode estar incorreto ou expirado.</p>
        <a href="https://wa.me/5592993161828" style={{ display:"inline-block", marginTop:20, padding:"10px 20px", background:"#25d366", color:"#fff", borderRadius:8, textDecoration:"none", fontSize:14, fontWeight:600 }}>
          📱 Falar com a Assessoria
        </a>
      </div>
    </div>
  );

  const docsMap: Record<string, CartDoc[]> = {};
  (data.docs ?? []).forEach(d => { (docsMap[d.tipo] ??= []).push(d); });

  return (
    <>
      {preview && <PreviewModal url={preview.url} nome={preview.nome} onClose={() => setPreview(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ minHeight:"100vh", background:BG, padding:"0 0 32px", fontFamily:"system-ui, sans-serif" }}>

        {/* Header com glow dourado */}
        <div style={{
          background:"linear-gradient(180deg, rgba(201,162,39,0.10) 0%, transparent 100%)",
          borderBottom:`1px solid ${GOLD_BORDER}`,
          padding:"28px 16px 24px",
          textAlign:"center",
          marginBottom:20,
        }}>
          <img
            src="https://rwinvestimentos.com.br/passarinho-logo.webp"
            alt="Passarinho Assessoria Bélica"
            style={{ height:130, objectFit:"contain", display:"block", margin:"0 auto 8px", filter:"drop-shadow(0 4px 16px rgba(201,162,39,0.35))" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <p style={{ color:GOLD, fontSize:10, margin:0, letterSpacing:"0.18em", fontWeight:600 }}>PASSARINHO ASSESSORIA BÉLICA</p>
        </div>

        <div style={{ maxWidth:440, margin:"0 auto", padding:"0 14px" }}>

          {/* Card cliente */}
          <div style={{ background:CARD_BG, borderRadius:16, padding:"16px 18px", marginBottom:12, border:`1px solid ${GOLD_BORDER}`, backdropFilter:"blur(8px)" }}>
            <p style={{ color:GOLD, fontSize:10, margin:"0 0 4px", textTransform:"uppercase", letterSpacing:"0.15em", fontWeight:600 }}>✦ Carteira Digital</p>
            <h1 style={{ color:"#f0e6c8", fontSize:22, fontWeight:800, margin:0 }}>{primeiroNome(data.nome)}</h1>
            <p style={{ color:"#7a6a48", fontSize:12, margin:"3px 0 0" }}>{data.nome}</p>
          </div>

          {/* Documentos */}
          <div style={{ background:CARD_BG, borderRadius:16, padding:"16px 18px", marginBottom:12, border:`1px solid ${GOLD_BORDER}` }}>
            <p style={{ color:GOLD, fontSize:10, margin:"0 0 14px", textTransform:"uppercase", letterSpacing:"0.15em", fontWeight:600 }}>✦ Seus Documentos</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {TIPOS.map(({ key, label, desc, emoji }) => {
                const docList = docsMap[key] ?? [];
                const temDocs = docList.length > 0;
                return (
                  <div key={key} style={{
                    borderRadius:12,
                    border: temDocs ? `1px solid ${GOLD_BORDER}` : "1px solid rgba(255,255,255,0.06)",
                    background: temDocs ? "rgba(201,162,39,0.05)" : "rgba(255,255,255,0.02)",
                    overflow:"hidden",
                  }}>
                    {/* Cabeçalho do tipo */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 14px", borderBottom: temDocs ? `1px solid rgba(201,162,39,0.15)` : "none" }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{emoji}</span>
                      <div style={{ minWidth:0, flex:1 }}>
                        <p style={{ color: temDocs ? "#e8d5a0" : "#6b5f45", fontSize:13, fontWeight:700, margin:0 }}>{label}</p>
                        <p style={{ color:"#4a3f2a", fontSize:10, margin:0 }}>{desc}</p>
                        {temDocs && docList.some(d => d.data_validade) && (() => {
                          const comVal = docList.filter(d => d.data_validade);
                          const ultimaData = (s: string) => (s.match(/\d{2}\/\d{2}\/\d{4}/g) ?? []).pop() ?? s;
                          const diasRestantes = (dateStr: string): number => {
                            const [dv, mv, yv] = dateStr.split("/").map(Number);
                            const val = new Date(yv, mv - 1, dv);
                            const hoje = new Date(); hoje.setHours(0,0,0,0);
                            return Math.ceil((val.getTime() - hoje.getTime()) / 86400000);
                          };
                          return (
                            <p style={{ color:"#8b7d5a", fontSize:10, margin:"3px 0 0", lineHeight:1.6 }}>
                              Validade:{" "}
                              {comVal.map((doc, i) => {
                                const last = ultimaData(doc.data_validade as string);
                                const [dv, mv, yv] = last.split("/").map(Number);
                                const valColor = new Date(yv, mv - 1, dv) < new Date() ? "#ef4444" : "#22c55e";
                                const dias = diasRestantes(last);
                                const diasLabel = dias < 0 ? `vencido há ${Math.abs(dias)}d` : `${dias}d`;
                                return (
                                  <span key={doc.id ?? i}>
                                    {i > 0 && <span style={{ color:"#4a3f2a" }}>, </span>}
                                    <span style={{ color: valColor, fontWeight: 400, fontSize: 9 }}>({diasLabel}) </span>
                                    <span style={{ color: valColor, fontWeight: 700 }}>{doc.data_validade}</span>
                                    {doc.numero_serie && <span style={{ color:"#7a6a48" }}> ({doc.numero_serie})</span>}
                                  </span>
                                );
                              })}
                            </p>
                          );
                        })()}
                      </div>
                      {!temDocs && (
                        <span style={{ flexShrink:0, padding:"6px 12px", background:"rgba(255,255,255,0.03)", color:"#3a3020", borderRadius:7, fontSize:11, border:"1px solid rgba(255,255,255,0.06)" }}>
                          Pendente
                        </span>
                      )}
                    </div>
                    {/* Lista de arquivos */}
                    {docList.map((doc, i) => {
                      const url = publicUrl(doc.arquivo_path);
                      return (
                        <div key={doc.id ?? i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, padding:"10px 14px", borderBottom: i < docList.length - 1 ? "1px solid rgba(201,162,39,0.10)" : "none" }}>
                          <p style={{ color:"#a89060", fontSize:11, margin:0, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                            {docList.length > 1 ? `${i+1}. ` : ""}{doc.arquivo_nome}
                          </p>
                          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                            <button
                              onClick={() => setPreview({ url, nome: doc.arquivo_nome || label })}
                              style={{ padding:"6px 10px", background:"rgba(201,162,39,0.12)", color:GOLD, borderRadius:7, border:`1px solid ${GOLD_BORDER}`, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                              ⛶ Expandir
                            </button>
                            <button onClick={() => baixarArquivo(url, doc.arquivo_nome || `${label}.pdf`)}
                              style={{ padding:"6px 10px", background:GOLD, color:"#0a0b0f", borderRadius:7, border:"none", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                              ⬇ Baixar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contato WhatsApp */}
          <a href="https://wa.me/5592993161828" style={{
            display:"flex", alignItems:"center", gap:12, padding:"14px 18px",
            background:"rgba(37,211,102,0.08)", borderRadius:16, textDecoration:"none",
            color:"#fff", border:"1px solid rgba(37,211,102,0.25)",
          }}>
            <span style={{ fontSize:24 }}>📱</span>
            <div>
              <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#5fda8a" }}>Dúvidas? WhatsApp</p>
              <p style={{ margin:0, fontSize:11, color:"#3a7a52" }}>Passarinho Assessoria Bélica</p>
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
