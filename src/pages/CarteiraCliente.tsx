import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Bell } from "lucide-react";
import { docColorido, type DocColorido, type ModeloDoc } from "@/lib/crColorido";
import { ROTULO_TIPO_CARTEIRA, situacaoDoc, ultimaData, textoPrazo, ordemAvisos } from "@/lib/avisosCarteira";
import { pushSuportado, inscricaoAtual, ativarPush, desativarPush, abertoComoApp } from "@/lib/avisosPush";
import { useEscComPdf } from "@/hooks/useEscComPdf";

const SUPABASE_URL = "https://qubkmecpxbsdphtmwvvw.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const BUCKET = "carteira-docs";

const TIPOS = [
  { key: "cr",   label: "CR",           desc: "Certificado de Registro",                emoji: "📄" },
  { key: "craf", label: "CRAF da Arma", desc: "Certificado de Registro de Arma de Fogo", emoji: "🔫" },
  { key: "gt",   label: "GT",           desc: "Guia de Tráfego",                         emoji: "📋" },
  { key: "cert", label: "CERTIFICADOS", desc: "Certificados",                             emoji: "📜" },
] as const;

interface CartDoc { id?: string; tipo: string; arquivo_path: string; arquivo_nome: string; data_expedicao?: string; data_validade?: string; numero_serie?: string; nome_arma?: string; sort_order?: number; }
interface CarteiraData { id: string; nome: string; cpf?: string; docs: CartDoc[]; }

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

const ehImagem = (nome: string) => /\.(png|jpg|jpeg|gif|webp)$/i.test(nome);

// Com modelo (chave Colorir ligada), baixa o PDF colorido; se o PDF não for do SisGCorp, baixa o original
async function baixarDoc(url: string, nome: string, modelo?: ModeloDoc) {
  if (modelo && !ehImagem(nome)) {
    const r = await docColorido(url, modelo).catch(() => null);
    if (r) {
      const blobUrl = URL.createObjectURL(r.pdf);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${nome.replace(/\.[^.]+$/, "")} - colorido.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
  }
  await baixarArquivo(url, nome);
}

function ChaveColorir({ ligada, onChange }: { ligada: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!ligada)} aria-pressed={ligada} title={ligada ? "Voltar aos originais" : "Colorir CR e CRAF"}
      style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 11px", borderRadius:999, cursor:"pointer", fontSize:11, fontWeight:700, whiteSpace:"nowrap",
        border:`1px solid ${ligada ? "#009c3b" : "rgba(255,255,255,0.22)"}`, background: ligada ? "rgba(0,156,59,0.18)" : "transparent", color: ligada ? "#3ddc84" : "#cfcfcf" }}>
      <span style={{ position:"relative", width:30, height:16, borderRadius:999, background: ligada ? "#009c3b" : "rgba(255,255,255,0.25)", flexShrink:0 }}>
        <span style={{ position:"absolute", top:2, left: ligada ? 16 : 2, width:12, height:12, borderRadius:"50%", background:"#fff", transition:"left .15s" }} />
      </span>
      🎨 Colorir
    </button>
  );
}

function PreviewModal({ url, nome, modelo, colorir, onColorir, onClose }: {
  url: string; nome: string; modelo?: ModeloDoc; colorir: boolean; onColorir: (v: boolean) => void; onClose: () => void;
}) {
  const isPdf = nome.toLowerCase().endsWith(".pdf") || url.toLowerCase().includes(".pdf") || (!nome.match(/\.(png|jpg|jpeg|gif|webp)$/i) && !url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i));
  const viewerUrl = isPdf
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : url;
  const podeColorir = !!modelo && isPdf;
  const [colorido, setColorido] = useState<DocColorido | "erro" | null>(null);

  // CR/CRAF: original e colorido saem do mesmo renderizador, na mesma escala, para a chave só trocar as cores
  useEffect(() => {
    if (!podeColorir || !modelo) return;
    let vivo = true;
    docColorido(url, modelo).then(r => { if (vivo) setColorido(r ?? "erro"); }, () => { if (vivo) setColorido("erro"); });
    return () => { vivo = false; };
  }, [url, modelo, podeColorir]);

  const usarRender = podeColorir && colorido !== "erro";
  const mostrarColorido = usarRender && colorir;
  const janela = useRef<HTMLDivElement>(null);
  useEscComPdf(janela); // Esc fecha mesmo depois de clicar no PDF
  return (
    <div ref={janela} tabIndex={-1}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.88)", display:"flex", flexDirection:"column", padding:0, outline:"none" }}
    >
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:"#0d0e13", borderBottom:"1px solid rgba(201,162,39,0.28)", flexShrink:0, gap:12 }}>
        <p style={{ color:"#e8d5a0", fontSize:13, fontWeight:600, margin:0, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{nome}</p>
        <div style={{ display:"flex", gap:8, flexShrink:0, alignItems:"center" }}>
          {usarRender && <ChaveColorir ligada={colorir} onChange={onColorir} />}
          <button onClick={() => baixarDoc(url, nome, mostrarColorido ? modelo : undefined)}
            style={{ padding:"6px 14px", background:"#c9a227", color:"#0a0b0f", borderRadius:8, border:"none", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            ⬇ Baixar
          </button>
          <button onClick={onClose}
            style={{ width:32, height:32, borderRadius:8, background:"rgba(201,162,39,0.10)", border:"1px solid rgba(201,162,39,0.28)", color:"#c9a227", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
            ✕
          </button>
        </div>
      </div>
      <div style={{ flex:1, overflow: usarRender ? "auto" : "hidden", display:"flex", alignItems: usarRender ? "flex-start" : "center", justifyContent:"center", padding:8 }}>
        {usarRender
          ? colorido
            ? <img src={colorir ? colorido.previa : colorido.previaOriginal} alt={colorir ? `${nome} colorido` : nome}
                style={{ width:"100%", height:"auto", display:"block", borderRadius:4, background:"#fff" }} />
            : <p style={{ color:"#e8d5a0", fontSize:13, margin:"auto" }}>{colorir ? "Colorindo..." : "Carregando..."}</p>
          : isPdf
            ? <iframe src={viewerUrl} title={nome} style={{ width:"100%", height:"100%", border:"none", borderRadius:8, background:"#fff" }} />
            : <img src={url} alt={nome} style={{ maxWidth:"100%", maxHeight:"100%", borderRadius:8, objectFit:"contain" }} />
        }
      </div>
    </div>
  );
}

export default function CarteiraCliente() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CarteiraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [preview, setPreview] = useState<{ url: string; nome: string; modelo?: ModeloDoc } | null>(null);
  const [expandedArmas, setExpandedArmas] = useState<Record<string, boolean>>({});
  // A chave fica lembrada neste aparelho até ser desligada
  const [colorir, setColorirEstado] = useState<boolean>(() => {
    try { return localStorage.getItem("carteira_colorir") === "1"; } catch { return false; }
  });
  const setColorir = (v: boolean) => {
    setColorirEstado(v);
    try { localStorage.setItem("carteira_colorir", v ? "1" : "0"); } catch { /* armazenamento bloqueado: vale só nesta visita */ }
  };
  const [baixando, setBaixando] = useState<string | null>(null);
  // Sininho de avisos: documentos vencidos ou perto de vencer, com a mesma regra e os mesmos prazos do sininho do site
  // (lib/avisosCarteira). O número some depois que o cliente abre a lista; volta quando surge aviso novo.
  const [avisosAberto, setAvisosAberto] = useState(false);
  // Instalar como aplicativo: no Android (Chrome, Edge, Samsung) o botão abre o "Instalar" do próprio navegador e o app
  // vai para a tela inicial abrindo direto esta carteira; no iPhone a Apple não deixa instalar por botão, então ele
  // mostra os toques do Safari. Aberto já como aplicativo, o botão não aparece.
  const [pedidoInstalar, setPedidoInstalar] = useState<any>(null);
  const [instalado, setInstalado] = useState(() =>
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);
  const [ajudaInstalar, setAjudaInstalar] = useState(false);
  useEffect(() => {
    const aoPedir = (e: Event) => { e.preventDefault(); setPedidoInstalar(e); };
    const aoInstalar = () => { setInstalado(true); setPedidoInstalar(null); };
    window.addEventListener("beforeinstallprompt", aoPedir);
    window.addEventListener("appinstalled", aoInstalar);
    return () => { window.removeEventListener("beforeinstallprompt", aoPedir); window.removeEventListener("appinstalled", aoInstalar); };
  }, []);
  // Avisos de vencimento no celular (notificação push, lib/avisosPush): enviados às 9h, 13h e 18h enquanto houver
  // documento vencido. "sem": navegador sem suporte (no iPhone, só a carteira instalada na Tela de Início recebe)
  const [pushEstado, setPushEstado] = useState<"carregando" | "ativo" | "inativo" | "bloqueado" | "sem" | "erro">("carregando");
  const [pushOcupado, setPushOcupado] = useState(false);
  // Aberta como aplicativo (instalada na tela de início) e com os avisos desligados: pergunta logo ao abrir, de novo a
  // cada abertura do aplicativo enquanto estiverem desligados ("Agora não" vale até fechar o aplicativo). Ligar sozinho
  // não dá (o celular sempre pede a permissão ao dono); o toque em "Ativar avisos" é o que o iPhone exige para mostrar
  // o "Permitir".
  const chavePerguntouAvisos = `carteira_avisos_perguntado_${id}`;
  const [perguntarAvisos, setPerguntarAvisos] = useState(false);
  useEffect(() => {
    if (!pushSuportado()) { setPushEstado("sem"); return; }
    if (Notification.permission === "denied") { setPushEstado("bloqueado"); return; }
    inscricaoAtual().then(sub => {
      setPushEstado(sub ? "ativo" : "inativo");
      if (sub || !abertoComoApp()) return;
      try { if (sessionStorage.getItem(chavePerguntouAvisos)) return; } catch { /* armazenamento bloqueado: pergunta */ }
      setPerguntarAvisos(true);
    }).catch(() => setPushEstado("inativo"));
  }, []);
  const chaveAvisosVistos = `carteira_avisos_vistos_${id}`;
  const [avisosVistos, setAvisosVistos] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`carteira_avisos_vistos_${id}`) || "[]"); } catch { return []; }
  });

  useEffect(() => {
    if (!id) return;
    const addedEls: HTMLElement[] = [];
    const addToHead = (el: HTMLElement) => { document.head.appendChild(el); addedEls.push(el); };
    let manifestBlobUrl = "";
    let iconBlobUrl = "";

    // Space Grotesk font — igual ao site principal
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800&display=swap";
    addToHead(fontLink);

    const manifestosDoSite: Element[] = [];
    const applyPWA = () => {
      // o manifesto do site (o do admin, em index.html) não vale aqui: a carteira instala com o dela, que abre neste link
      document.querySelectorAll('link[rel="manifest"]').forEach(l => { manifestosDoSite.push(l); l.remove(); });
      const iconUrl = `${window.location.origin}/carteira-icon5.png`;
      const manifest = {
        name: "Carteira CAC",
        short_name: "Carteira CAC",
        description: "Passarinho Assessoria Bélica",
        start_url: `${window.location.origin}/carteira/${id}`,
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#c9a227",
        icons: [{ src: iconUrl, sizes: "512x512", type: "image/png", purpose: "any" }]
      };
      const mBlob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
      manifestBlobUrl = URL.createObjectURL(mBlob);
      const linkEl = document.createElement("link"); linkEl.rel = "manifest"; linkEl.href = manifestBlobUrl;
      addToHead(linkEl);
      const appleIcon = document.createElement("link"); appleIcon.rel = "apple-touch-icon"; appleIcon.href = iconUrl;
      addToHead(appleIcon);
      const appleMeta = document.createElement("meta"); appleMeta.name = "apple-mobile-web-app-capable"; appleMeta.content = "yes";
      addToHead(appleMeta);
      const appleTitle = document.createElement("meta"); appleTitle.name = "apple-mobile-web-app-title"; appleTitle.content = "Carteira CAC";
      addToHead(appleTitle);
      const themeColor = document.createElement("meta"); themeColor.name = "theme-color"; themeColor.content = "#c9a227";
      addToHead(themeColor);
      document.title = "Carteira CAC";
    };

    applyPWA();

    return () => {
      addedEls.forEach(el => { try { document.head.removeChild(el); } catch {} });
      manifestosDoSite.forEach(l => document.head.appendChild(l));
      if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
      document.title = "RW Investimentos Financeiros";
    };
  }, [id]);

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

  // Ao ligar a chave, já colore CR e CRAF em segundo plano para Expandir/Baixar abrirem na hora
  useEffect(() => {
    if (!colorir || !data) return;
    for (const d of data.docs ?? []) {
      if ((d.tipo === "cr" || d.tipo === "craf") && !ehImagem(d.arquivo_nome)) docColorido(publicUrl(d.arquivo_path), d.tipo).catch(() => {});
    }
  }, [colorir, data]);

  // Cores idênticas ao site principal (index.css .dark)
  const BG = "#0b0908";          // hsl(20 12% 4%)
  const GOLD = "#d4a730";        // hsl(42 82% 52%)
  const GOLD_DIM = "rgba(212,167,48,0.12)";
  const GOLD_BORDER = "rgba(212,167,48,0.22)";
  const CARD_BG = "#131110";     // hsl(20 10% 7%)
  const FONT = "'Space Grotesk', system-ui, sans-serif";
  const FG = "#ede7d9";          // hsl(45 18% 90%)
  const FG_MUTED = "#807060";    // hsl(40 6% 50%)

  const FULL_BG = {
    background: `radial-gradient(ellipse at 10% 0%, rgba(212,167,48,0.08) 0%, transparent 50%), radial-gradient(ellipse at 90% 100%, rgba(212,167,48,0.05) 0%, transparent 50%), ${BG}`,
    minHeight: "100vh",
    fontFamily: FONT,
  };

  if (loading) return (
    <div style={{ ...FULL_BG, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:FG_MUTED }}>
        <div style={{ width:40, height:40, border:`3px solid ${GOLD_BORDER}`, borderTopColor:GOLD, borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }} />
        <p style={{ fontSize:14, fontFamily:FONT }}>Carregando carteira...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (erro || !data) return (
    <div style={{ ...FULL_BG, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ textAlign:"center", color:FG_MUTED, maxWidth:320 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
        <h2 style={{ color:FG, fontSize:18, marginBottom:8, fontFamily:FONT }}>Carteira não encontrada</h2>
        <p style={{ fontSize:14, fontFamily:FONT }}>Este link pode estar incorreto ou expirado.</p>
        <a href="https://wa.me/5592993161828" style={{ display:"inline-block", marginTop:20, padding:"10px 20px", background:"#25d366", color:"#fff", borderRadius:8, textDecoration:"none", fontSize:14, fontWeight:600, fontFamily:FONT }}>
          📱 Falar com a Assessoria
        </a>
      </div>
    </div>
  );

  const docsMap: Record<string, CartDoc[]> = {};
  (data.docs ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .forEach(d => { (docsMap[d.tipo] ??= []).push(d); });

  const avisos = (data.docs ?? []).flatMap(d => {
    const sit = situacaoDoc(d.tipo, d.data_validade || "");
    if (!sit) return [];
    // CRAF e GT: o nome da arma (ou o número de série) diz de qual arma é
    const arma = d.tipo === "craf" || d.tipo === "gt" ? (d.nome_arma || (d.numero_serie ? `nº ${d.numero_serie}` : "")) : "";
    return [{ ...sit, tipo: d.tipo, arma, rotulo: ROTULO_TIPO_CARTEIRA[d.tipo] ?? d.tipo.toUpperCase(),
      validade: ultimaData(d.data_validade || ""), chave: `${d.id ?? d.arquivo_path}|${d.data_validade}${sit.vencido ? "" : "|a"}` }];
  }).sort(ordemAvisos);
  const avisosNovos = avisos.filter(a => !avisosVistos.includes(a.chave)).length;
  const ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalarApp = async () => {
    if (pedidoInstalar) {
      pedidoInstalar.prompt();
      const escolha = await pedidoInstalar.userChoice.catch(() => null);
      if (escolha?.outcome === "accepted") setInstalado(true);
      setPedidoInstalar(null); // o pedido do navegador só vale uma vez
      return;
    }
    setAjudaInstalar(v => !v);
  };
  const rpcCarteira = (fn: string, corpo: object) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify(corpo),
  }).then(r => { if (!r.ok) throw new Error(`rpc ${r.status}`); });
  const ativarAvisosCelular = async () => {
    if (!id) return;
    setPushOcupado(true);
    try {
      const sub = await ativarPush();
      await rpcCarteira("salvar_push_carteira", { p_carteira: id, p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth });
      setPushEstado("ativo");
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "";
      setPushEstado(motivo === "bloqueado" ? "bloqueado" : motivo === "sem permissao" ? "inativo" : "erro");
    } finally { setPushOcupado(false); }
  };
  const responderPerguntaAvisos = (ativar: boolean) => {
    setPerguntarAvisos(false);
    try { sessionStorage.setItem(chavePerguntouAvisos, "1"); } catch { /* armazenamento bloqueado */ }
    if (ativar) ativarAvisosCelular();
  };
  const desativarAvisosCelular = async () => {
    setPushOcupado(true);
    try {
      const endpoint = await desativarPush();
      if (endpoint) await rpcCarteira("remover_push", { p_endpoint: endpoint }).catch(() => {});
      setPushEstado("inativo");
    } finally { setPushOcupado(false); }
  };
  const alternarAvisos = () => {
    const abrir = !avisosAberto;
    setAvisosAberto(abrir);
    if (abrir && avisosNovos > 0) {
      const todos = avisos.map(a => a.chave);
      setAvisosVistos(todos);
      try { localStorage.setItem(chaveAvisosVistos, JSON.stringify(todos)); } catch { /* armazenamento bloqueado */ }
    }
  };

  return (
    <>
      {preview && <PreviewModal url={preview.url} nome={preview.nome} modelo={preview.modelo} colorir={colorir} onColorir={setColorir} onClose={() => setPreview(null)} />}
      {perguntarAvisos && pushEstado === "inativo" && (
        <div role="dialog" aria-modal="true" aria-labelledby="pergunta-avisos-titulo"
          style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.72)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ width:"100%", maxWidth:360, padding:"26px 22px 16px", background:CARD_BG, borderRadius:18, border:`1px solid ${GOLD_BORDER}`,
            boxShadow:"0 20px 50px rgba(0,0,0,0.6)", textAlign:"center", fontFamily:FONT }}>
            <div style={{ fontSize:40, lineHeight:1, marginBottom:12 }}>🔔</div>
            <h2 id="pergunta-avisos-titulo" style={{ margin:"0 0 8px", color:FG, fontSize:18, fontWeight:700 }}>Ativar avisos de vencimento?</h2>
            <p style={{ margin:"0 0 20px", color:"rgba(237,231,217,0.72)", fontSize:13, lineHeight:1.6 }}>
              Receba uma notificação neste celular às 9h, 13h e 18h quando algum documento da sua carteira vencer.
            </p>
            <button onClick={() => responderPerguntaAvisos(true)}
              style={{ width:"100%", padding:"13px 16px", background:GOLD, color:BG, border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:FONT }}>
              Ativar avisos
            </button>
            <button onClick={() => responderPerguntaAvisos(false)}
              style={{ width:"100%", marginTop:6, padding:"10px 16px", background:"transparent", color:FG_MUTED, border:"none", fontSize:13, cursor:"pointer", fontFamily:FONT }}>
              Agora não
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>

      <div style={{ ...FULL_BG, padding:"0 0 40px" }}>

        {/* Header com glow dourado */}
        <div style={{
          background:"linear-gradient(180deg, rgba(212,167,48,0.10) 0%, transparent 100%)",
          borderBottom:`1px solid ${GOLD_BORDER}`,
          padding:"28px 16px 24px",
          textAlign:"center",
          marginBottom:20,
        }}>
          <img
            src="https://rwinvestimentos.com.br/logo-passarinho.png"
            alt="Passarinho Assessoria Bélica"
            style={{ height:140, objectFit:"contain", display:"block", margin:"0 auto 10px", filter:"drop-shadow(0 4px 20px rgba(212,167,48,0.40))" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <p style={{ color:GOLD, fontSize:10, margin:0, letterSpacing:"0.20em", fontWeight:700, fontFamily:FONT }}>PASSARINHO ASSESSORIA BÉLICA</p>
        </div>

        <div style={{ maxWidth:440, margin:"0 auto", padding:"0 14px" }}>

          {/* Card cliente */}
          <div style={{ position:"relative", background:CARD_BG, borderRadius:16, padding:"18px 20px", marginBottom:12, border:`1px solid ${GOLD_BORDER}`, backdropFilter:"blur(12px)" }}>
            <div style={{ paddingRight:48 }}>
              <p style={{ color:GOLD, fontSize:10, margin:"0 0 4px", textTransform:"uppercase", letterSpacing:"0.18em", fontWeight:700, fontFamily:FONT }}>✦ Carteira Digital</p>
              <h1 style={{ color:FG, fontSize:24, fontWeight:800, margin:0, fontFamily:FONT }}>{primeiroNome(data.nome)}</h1>
              <p style={{ color:FG_MUTED, fontSize:12, margin:"4px 0 0", fontFamily:FONT }}>{data.nome}</p>
            </div>

            {/* Sininho: documentos vencidos ou perto de vencer */}
            <button onClick={alternarAvisos} aria-label="Avisos de vencimento" title="Avisos de vencimento" aria-expanded={avisosAberto}
              style={{ position:"absolute", top:16, right:16, width:38, height:38, borderRadius:"50%", border:`1px solid ${GOLD_BORDER}`,
                background: avisosAberto ? GOLD_DIM : "transparent", color:GOLD, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 }}>
              <Bell size={18} />
              {avisosNovos > 0 && (
                <span style={{ position:"absolute", top:-5, right:-5, minWidth:18, height:18, padding:"0 4px", borderRadius:9, background:"#ef4444", color:"#fff",
                  fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:FONT }}>{avisosNovos}</span>
              )}
            </button>
            {avisosAberto && (
              <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${GOLD_BORDER}` }}>
                {avisos.length === 0 ? (
                  <p style={{ color:FG_MUTED, fontSize:12, margin:0, fontFamily:FONT }}>Nenhum documento vencido ou perto de vencer.</p>
                ) : (
                  <>
                    {[{ vencido: true, titulo: "Vencidos", cor: "#ef4444" }, { vencido: false, titulo: "Vencem em breve", cor: "#f59e0b" }].map(sec => {
                      const lista = avisos.filter(a => a.vencido === sec.vencido);
                      if (!lista.length) return null;
                      return (
                        <div key={sec.titulo} style={{ marginBottom:8 }}>
                          <p style={{ color:sec.cor, fontSize:10, margin:"0 0 4px", textTransform:"uppercase", letterSpacing:"0.15em", fontWeight:700, fontFamily:FONT }}>{sec.titulo}</p>
                          {lista.map(a => (
                            <button key={a.chave}
                              onClick={() => { setAvisosAberto(false); document.getElementById(`tipo-${a.tipo}`)?.scrollIntoView({ behavior:"smooth", block:"center" }); }}
                              style={{ display:"flex", alignItems:"flex-start", gap:8, width:"100%", textAlign:"left", background:"transparent", border:"none", padding:"6px 0", cursor:"pointer", fontFamily:FONT }}>
                              <span style={{ width:8, height:8, borderRadius:"50%", background:sec.cor, marginTop:5, flexShrink:0 }} />
                              <span style={{ minWidth:0 }}>
                                <span style={{ display:"block", color:FG, fontSize:13, fontWeight:700 }}>{a.rotulo}{a.arma ? ` — ${a.arma}` : ""}</span>
                                <span style={{ display:"block", color:FG_MUTED, fontSize:11, marginTop:1 }}>{textoPrazo(a.validade, a.dias, a.vencido)}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                    <a href="https://wa.me/5592993161828" style={{ display:"block", marginTop:4, color:"#5fda8a", fontSize:12, fontWeight:600, textDecoration:"none", fontFamily:FONT }}>
                      📱 Para renovar, fale com a Passarinho no WhatsApp
                    </a>
                  </>
                )}
                {/* Avisos de vencimento no celular: no rodapé do sininho, igual ao sino do admin no site */}
                {pushEstado !== "carregando" && (
                  <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${GOLD_BORDER}`, fontFamily:FONT }}>
                    {pushEstado === "ativo" ? (
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                        <span style={{ color:"#5fda8a", fontSize:12, fontWeight:600 }}>🔔 Avisos no celular ativados (às 9h, 13h e 18h)</span>
                        <button onClick={desativarAvisosCelular} disabled={pushOcupado}
                          style={{ background:"transparent", border:"none", padding:0, color:FG_MUTED, fontSize:11, textDecoration:"underline", cursor:"pointer", fontFamily:FONT, flexShrink:0 }}>
                          desativar
                        </button>
                      </div>
                    ) : pushEstado === "sem" ? (
                      <p style={{ margin:0, color:FG_MUTED, fontSize:11, lineHeight:1.6 }}>
                        {ehIOS && !abertoComoApp()
                          ? "Avisos no iPhone: instale o aplicativo (botão \"Instalar o aplicativo\", logo abaixo) e ative por ele."
                          : "Este navegador não recebe notificações. Abra o link no Chrome para ativar os avisos."}
                      </p>
                    ) : pushEstado === "bloqueado" ? (
                      <p style={{ margin:0, color:FG_MUTED, fontSize:11, lineHeight:1.6 }}>
                        🔕 Notificações bloqueadas para esta carteira nas configurações do celular.
                      </p>
                    ) : (
                      <button onClick={ativarAvisosCelular} disabled={pushOcupado}
                        style={{ width:"100%", height:34, borderRadius:10, border:`1px solid ${GOLD_BORDER}`, background:"transparent", color:GOLD,
                          fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:FONT }}>
                        🔔 {pushOcupado ? "Ativando…" : pushEstado === "erro" ? "Não deu certo — tentar de novo" : "Receber avisos de vencimento no celular"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Instalar o aplicativo */}
          {!instalado && (
            <div style={{ marginBottom:12 }}>
              <button onClick={instalarApp} style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"14px 18px", background:GOLD_DIM,
                borderRadius:16, border:`1px solid ${GOLD_BORDER}`, cursor:"pointer", textAlign:"left", fontFamily:FONT }}>
                <span style={{ fontSize:24 }}>📲</span>
                <span>
                  <span style={{ display:"block", color:GOLD, fontSize:14, fontWeight:700 }}>Instalar o aplicativo</span>
                  <span style={{ display:"block", color:FG_MUTED, fontSize:11, marginTop:1 }}>Sua carteira na tela do celular, como um app</span>
                </span>
              </button>
              {ajudaInstalar && (
                <div style={{ marginTop:8, padding:"12px 16px", background:CARD_BG, borderRadius:12, border:`1px solid ${GOLD_BORDER}`, color:FG, fontSize:12, lineHeight:1.7, fontFamily:FONT }}>
                  {ehIOS ? (
                    <>No iPhone, pelo <b>Safari</b>:<br />1. Toque em <b>Compartilhar</b> (o quadrado com a seta ↑)<br />2. Toque em <b>Adicionar à Tela de Início</b><br />3. Toque em <b>Adicionar</b></>
                  ) : (
                    <>Toque no menu <b>⋮</b> do navegador e depois em <b>Instalar aplicativo</b> (ou <b>Adicionar à tela inicial</b>).</>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Documentos */}
          <div style={{ background:CARD_BG, borderRadius:16, padding:"16px 18px", marginBottom:12, border:`1px solid ${GOLD_BORDER}` }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, margin:"0 0 14px" }}>
              <p style={{ color:GOLD, fontSize:10, margin:0, textTransform:"uppercase", letterSpacing:"0.18em", fontWeight:700, fontFamily:FONT }}>✦ Seus Documentos</p>
              {(docsMap.cr?.length || docsMap.craf?.length) ? <ChaveColorir ligada={colorir} onChange={setColorir} /> : null}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {TIPOS.map(({ key, label, desc, emoji }) => {
                const docList = docsMap[key] ?? [];
                const temDocs = docList.length > 0;
                return (
                  <div key={key} id={`tipo-${key}`} style={{
                    borderRadius:12,
                    border: temDocs ? `1px solid ${GOLD_BORDER}` : "1px solid rgba(255,255,255,0.06)",
                    background: temDocs ? "rgba(201,162,39,0.05)" : "rgba(255,255,255,0.02)",
                    overflow:"hidden",
                  }}>
                    {/* Cabeçalho do tipo */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 14px", borderBottom: temDocs ? `1px solid ${GOLD_BORDER}` : "none" }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{emoji}</span>
                      <div style={{ minWidth:0, flex:1 }}>
                        <p style={{ color: temDocs ? FG : FG_MUTED, fontSize:13, fontWeight:700, margin:0, fontFamily:FONT }}>{label}</p>
                        <p style={{ color:"#50412d", fontSize:10, margin:0, fontFamily:FONT }}>{desc}</p>
                        {temDocs && key !== "gt" && docList.some(d => d.data_validade) && (() => {
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
                              {comVal.map((doc, i) => {
                                const last = ultimaData(doc.data_validade as string);
                                const [dv, mv, yv] = last.split("/").map(Number);
                                const valColor = new Date(yv, mv - 1, dv) < new Date() ? "#ef4444" : GOLD;
                                const dias = diasRestantes(last);
                                const diasLabel = dias < 0 ? `vencido há ${Math.abs(dias)}d` : `vence em (${dias}d)`;
                                return (
                                  <span key={doc.id ?? i} style={{ display:"block", marginTop: i === 0 ? 0 : 2, fontFamily:FONT }}>
                                    <span style={{ color:FG_MUTED, fontWeight: 400 }}>{diasLabel} </span>
                                    <span style={{ color: valColor, fontWeight: 700 }}>{doc.data_validade}</span>
                                    {doc.numero_serie && <span style={{ color:FG_MUTED }}> ({doc.numero_serie})</span>}
                                  </span>
                                );
                              })}
                            </p>
                          );
                        })()}
                      </div>
                      {!temDocs && (
                        <span style={{ flexShrink:0, padding:"5px 12px", background:"rgba(255,255,255,0.03)", color:"#3d3020", borderRadius:8, fontSize:11, border:"1px solid rgba(255,255,255,0.07)", fontFamily:FONT }}>
                          Pendente
                        </span>
                      )}
                    </div>
                    {/* Lista de arquivos — GT agrupado por arma */}
                    {key === "gt" && docList.length > 0 ? (() => {
                      const grupos: Record<string, CartDoc[]> = {};
                      docList.forEach(d => {
                        const g = d.nome_arma?.trim() || "Sem arma";
                        (grupos[g] ??= []).push(d);
                      });
                      return Object.entries(grupos).map(([arma, rawGtDocs], gi) => {
                        const gtDocs = [...rawGtDocs].sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                        const expanded = expandedArmas[arma] ?? false;
                        return (
                          <div key={arma} style={{ borderTop: gi > 0 ? "1px solid rgba(201,162,39,0.10)" : undefined }}>
                            {/* Cabeçalho da arma — clicável */}
                            <button
                              onClick={() => setExpandedArmas(prev => ({ ...prev, [arma]: !expanded }))}
                              style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:"none", border:"none", cursor:"pointer", textAlign:"left", fontFamily:FONT }}>
                              <span style={{ color:FG, fontSize:13, fontWeight:700 }}>🔫 {arma}</span>
                              <span style={{ color:GOLD, fontSize:12, fontWeight:600 }}>{expanded ? "▲" : "▼"} {gtDocs.length} GT{gtDocs.length > 1 ? "s" : ""}</span>
                            </button>
                            {/* GTs desta arma */}
                            {expanded && gtDocs.map((doc, i) => {
                              const url = publicUrl(doc.arquivo_path);
                              return (
                                <div key={doc.id ?? i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, padding:"8px 14px 8px 24px", borderTop:"1px solid rgba(201,162,39,0.06)" }}>
                                  <div style={{ minWidth:0, flex:1 }}>
                                    <p style={{ color:FG, fontSize:12, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:FONT }}>
                                      {gtDocs.length > 1 ? `${i+1}. ` : ""}{doc.arquivo_nome}
                                    </p>
                                    {doc.data_validade && (() => {
                                      const [dv, mv, yv] = doc.data_validade.split("/").map(Number);
                                      const dias = Math.round((new Date(yv, mv-1, dv).getTime() - Date.now()) / 86400000);
                                      const vencido = dias < 0;
                                      return (
                                        <p style={{ margin:"2px 0 0", fontSize:10, fontFamily:FONT }}>
                                          <span style={{ color:FG_MUTED }}>{vencido ? `vencido há ${Math.abs(dias)}d` : `vence em (${dias}d)`} </span>
                                          <span style={{ color: vencido ? "#ef4444" : GOLD, fontWeight:700 }}>{doc.data_validade}</span>
                                        </p>
                                      );
                                    })()}
                                  </div>
                                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                                    <button onClick={() => setPreview({ url, nome: doc.arquivo_nome || label })}
                                      style={{ padding:"6px 10px", background:"rgba(201,162,39,0.12)", color:GOLD, borderRadius:7, border:`1px solid ${GOLD_BORDER}`, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                                      ⛶ Expandir
                                    </button>
                                    <button onClick={() => baixarArquivo(url, doc.arquivo_nome || "GT.pdf")}
                                      style={{ padding:"6px 10px", background:GOLD, color:"#0a0b0f", borderRadius:7, border:"none", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                                      ⬇ Baixar
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      });
                    })() : docList.map((doc, i) => {
                      const url = publicUrl(doc.arquivo_path);
                      const docKey = doc.id ?? `${key}-${i}`;
                      const modelo: ModeloDoc | undefined = key === "cr" || key === "craf" ? key : undefined;
                      const nomeDoc = doc.arquivo_nome || `${label}.pdf`;
                      return (
                        <div key={docKey} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, padding:"10px 14px", borderBottom: i < docList.length - 1 ? "1px solid rgba(201,162,39,0.10)" : "none" }}>
                          <p style={{ color:FG, fontSize:12, margin:0, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, fontFamily:FONT }}>
                            {docList.length > 1 ? `${i+1}. ` : ""}{doc.arquivo_nome}
                          </p>
                          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                            <button onClick={() => setPreview({ url, nome: doc.arquivo_nome || label, modelo })}
                              style={{ padding:"6px 10px", background:"rgba(201,162,39,0.12)", color:GOLD, borderRadius:7, border:`1px solid ${GOLD_BORDER}`, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                              ⛶ Expandir
                            </button>
                            <button disabled={baixando === docKey}
                              onClick={async () => {
                                setBaixando(docKey);
                                try { await baixarDoc(url, nomeDoc, colorir ? modelo : undefined); } finally { setBaixando(null); }
                              }}
                              style={{ padding:"6px 10px", background:GOLD, color:"#0a0b0f", borderRadius:7, border:"none", fontSize:11, fontWeight:700, cursor:"pointer", minWidth:72 }}>
                              {baixando === docKey ? "⏳" : "⬇ Baixar"}
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

          {/* Rodapé: e-mail da assessoria (o usuário pediu no lugar do nome) */}
          <p style={{ textAlign:"center", fontSize:10, marginTop:20, fontFamily:FONT, letterSpacing:"0.1em" }}>
            <a href="mailto:adm@passarinhoassessoriabelica.com.br" style={{ color:"#ffffff", textDecoration:"none" }}>
              adm@passarinhoassessoriabelica.com.br
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
