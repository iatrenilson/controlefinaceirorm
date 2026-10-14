import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const GOLD = "#c9a227";
const TIPOS_SINARM = ["SINARM CAC", "SINARM POSSE", "SINARM PORTE"] as const;
const ARMAS_OPTS   = ["Pistola", "Revólver", "Rifle", "Espingarda"]  as const;

const labelStyle: React.CSSProperties = {
  color: "#7a6a48", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1px solid rgba(201,162,39,0.2)", background: "rgba(255,255,255,0.05)",
  color: "#e8d5a0", fontSize: 14, outline: "none", boxSizing: "border-box",
};

function CheckboxOpt({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <div onClick={onClick} style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
        border: `2px solid ${checked ? GOLD : "rgba(201,162,39,0.3)"}`,
        background: checked ? GOLD : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all .15s", cursor: "pointer",
      }}>
        {checked && (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
            <path d="M1 4L4 7L10 1" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span style={{ color: checked ? "#e8d5a0" : "#7a7060", fontSize: 13, fontWeight: checked ? 600 : 400, transition: "color .15s" }}>
        {label}
      </span>
    </label>
  );
}

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
};

interface Cliente {
  id: string;
  nome: string;
  cpf: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  tipo_sinarm: string | null;
  armas: string | null;
  psicologico_url: string | null;
  created_at: string;
}

function initForm() {
  return { nome:"", cpf:"", endereco:"", numero:"", complemento:"", bairro:"", cidade:"", estado:"", tipos:[] as string[], armas:[] as string[], psicoFile:null as File|null, psicoUrl:null as string|null };
}

type FormState = ReturnType<typeof initForm>;

export default function ColaboradorPortal() {
  const { token } = useParams<{ token: string }>();
  const [colaborador, setColaborador] = useState<{ nome: string; ativo: boolean } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tela, setTela] = useState<"lista" | "novo" | "editar">("lista");
  const [form, setForm] = useState<FormState>(initForm());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPsico, setUploadingPsico] = useState(false);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => { if (token) verificarToken(); }, [token]);

  async function verificarToken() {
    setCarregando(true);
    const { data, error } = await supabase.rpc("get_colaborador_info", { p_token: token });
    if (error || !data || (data as any[]).length === 0) { setCarregando(false); return; }
    const info = (data as any[])[0];
    setColaborador(info);
    if (info.ativo) await carregar();
    setCarregando(false);
  }

  async function carregar() {
    const { data } = await supabase.rpc("get_cac_cadastros_by_token", { p_token: token });
    if (data) setClientes(data as Cliente[]);
  }

  function toggle(k: "tipos" | "armas", v: string) {
    const lista = form[k] as string[];
    setForm(f => ({ ...f, [k]: lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v] }));
  }

  async function handlePsicoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(f => ({ ...f, psicoFile: file, psicoUrl: null }));
    setUploadingPsico(true);
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("psicologicos").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("psicologicos").getPublicUrl(path);
      setForm(f => ({ ...f, psicoUrl: publicUrl }));
    } else {
      toast.error("Erro ao enviar arquivo.");
      setForm(f => ({ ...f, psicoFile: null }));
    }
    setUploadingPsico(false);
  }

  async function salvar() {
    if (!form.nome.trim())     { toast.error("Informe o nome."); return; }
    if (!form.cpf.trim())      { toast.error("Informe o CPF."); return; }
    if (!form.endereco.trim()) { toast.error("Informe o endereço."); return; }
    if (!form.numero.trim())   { toast.error("Informe o número."); return; }
    if (!form.bairro.trim())   { toast.error("Informe o bairro."); return; }
    if (!form.cidade.trim())   { toast.error("Informe a cidade."); return; }
    if (!form.tipos.length)    { toast.error("Selecione o Tipo de Serviço."); return; }
    if (!form.armas.length)    { toast.error("Selecione ao menos uma Arma."); return; }
    if (uploadingPsico)        { toast.error("Aguarde o upload."); return; }
    setSaving(true);
    if (tela === "novo") {
      // Abre WhatsApp ANTES do await (evita bloqueio do navegador)
      const linhas = [
        "✅ *Confirmação de Cadastro*",
        "",
        `*Nome:* ${form.nome}`,
        form.cpf      ? `*CPF:* ${form.cpf}` : null,
        form.endereco ? `*Endereço:* ${form.endereco}${form.numero ? `, Nº ${form.numero}` : ""}${form.complemento ? ` - ${form.complemento}` : ""}` : null,
        form.bairro   ? `*Bairro:* ${form.bairro}` : null,
        (form.cidade || form.estado) ? `*Cidade/UF:* ${form.cidade}${form.cidade && form.estado ? " - " : ""}${form.estado}` : null,
        form.tipos.length ? `*Tipo:* ${form.tipos.join(", ")}` : null,
        form.armas.length ? `*Armas:* ${form.armas.join(", ")}` : null,
        form.psicoUrl ? `*Psicológico:* ${form.psicoUrl}` : null,
      ].filter(l => l !== null).join("\n");
      window.open(`https://wa.me/5592993161828?text=${encodeURIComponent(linhas)}`, "_blank");

      const { error } = await supabase.rpc("insert_cac_cadastro_by_token", {
        p_token: token, p_nome: form.nome, p_cpf: form.cpf, p_endereco: form.endereco,
        p_numero: form.numero, p_complemento: form.complemento, p_bairro: form.bairro,
        p_cidade: form.cidade, p_estado: form.estado,
        p_tipo_sinarm: form.tipos.join(", "), p_armas: form.armas.join(", "),
        p_psicologico_url: form.psicoUrl,
      });
      if (error) { toast.error("Erro: " + error.message); setSaving(false); return; }
      toast.success("Cliente cadastrado!");
    } else {
      const { error } = await supabase.rpc("update_cac_cadastro_by_token", {
        p_token: token, p_id: editandoId, p_nome: form.nome, p_cpf: form.cpf,
        p_endereco: form.endereco, p_numero: form.numero, p_complemento: form.complemento,
        p_bairro: form.bairro, p_cidade: form.cidade, p_estado: form.estado,
        p_tipo_sinarm: form.tipos.join(", "), p_armas: form.armas.join(", "),
      });
      if (error) { toast.error("Erro: " + error.message); setSaving(false); return; }
      toast.success("Atualizado!");
    }
    setSaving(false);
    setTela("lista");
    setForm(initForm());
    carregar();
  }

  function abrirEdicao(c: Cliente) {
    setForm({
      nome: c.nome, cpf: c.cpf || "", endereco: c.endereco || "", numero: c.numero || "",
      complemento: c.complemento || "", bairro: c.bairro || "", cidade: c.cidade || "",
      estado: c.estado || "", psicoFile: null, psicoUrl: c.psicologico_url || null,
      tipos: c.tipo_sinarm ? c.tipo_sinarm.split(", ").filter(Boolean) : [],
      armas: c.armas ? c.armas.split(", ").filter(Boolean) : [],
    });
    setEditandoId(c.id);
    setTela("editar");
  }

  async function excluir(id: string) {
    const { error } = await supabase.rpc("delete_cac_cadastro_by_token", { p_token: token, p_id: id });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Excluído.");
    setDeletandoId(null);
    carregar();
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (carregando) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--background)" }}>
      <div style={{ width:32, height:32, border:`3px solid ${GOLD}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!colaborador) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--background)", padding:24 }}>
      <div style={{ textAlign:"center", color:"#7a6a48" }}>
        <p style={{ fontSize:32, marginBottom:8 }}>✕</p>
        <p style={{ fontWeight:600, color:"#e8d5a0" }}>Link inválido</p>
        <p style={{ fontSize:13, marginTop:4 }}>Este link não existe ou foi removido.</p>
      </div>
    </div>
  );

  if (!colaborador.ativo) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--background)", padding:24 }}>
      <div style={{ textAlign:"center", color:"#7a6a48" }}>
        <p style={{ fontSize:32, marginBottom:8 }}>⚠</p>
        <p style={{ fontWeight:600, color:"#e8d5a0" }}>Link desativado</p>
        <p style={{ fontSize:13, marginTop:4 }}>Contate o administrador.</p>
      </div>
    </div>
  );

  const filtrados = clientes.filter(c =>
    !busca || c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.cpf||"").includes(busca)
  );

  // ── Tela do formulário ────────────────────────────────────────────────────
  if (tela === "novo" || tela === "editar") return (
    <div style={{ background:"var(--background)", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", padding:"24px 16px" }}>
      <div style={{ width:"100%", maxWidth:440, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(201,162,39,0.2)", borderRadius:20, padding:"28px 24px" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <p style={{ color:GOLD, fontSize:11, letterSpacing:"0.15em", fontWeight:600, textTransform:"uppercase", margin:0 }}>
            ✦ {tela === "novo" ? "Novo Cliente" : "Editar Cliente"}
          </p>
          <button onClick={() => { setTela("lista"); setForm(initForm()); }}
            style={{ background:"none", border:"none", color:"#7a6a48", cursor:"pointer", fontSize:20, lineHeight:1, padding:0 }}>✕</button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Nome */}
          <div>
            <label style={labelStyle}>Nome completo {!form.nome.trim() && <span style={{ color:"#ef4444" }}>*</span>}</label>
            <input value={form.nome} onChange={e => setForm(f=>({...f, nome:e.target.value.toUpperCase()}))} placeholder="Ex: JOÃO DA SILVA" style={inputStyle} />
          </div>
          {/* CPF */}
          <div>
            <label style={labelStyle}>CPF {!form.cpf.trim() && <span style={{ color:"#ef4444" }}>*</span>}</label>
            <input value={form.cpf} onChange={e => setForm(f=>({...f, cpf:maskCpf(e.target.value)}))} placeholder="000.000.000-00" style={inputStyle} inputMode="numeric" />
          </div>
          {/* Endereço */}
          <div>
            <label style={labelStyle}>Endereço {!form.endereco.trim() && <span style={{ color:"#ef4444" }}>*</span>}</label>
            <input value={form.endereco} onChange={e => setForm(f=>({...f, endereco:e.target.value.toUpperCase()}))} placeholder="RUA, AV..." style={inputStyle} />
          </div>
          {/* Nº + Complemento */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={labelStyle}>Nº {!form.numero.trim() && <span style={{ color:"#ef4444" }}>*</span>}</label>
              <input value={form.numero} onChange={e => setForm(f=>({...f, numero:e.target.value}))} placeholder="123" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Complemento</label>
              <input value={form.complemento} onChange={e => setForm(f=>({...f, complemento:e.target.value.toUpperCase()}))} placeholder="APTO, BLOCO..." style={inputStyle} />
            </div>
          </div>
          {/* Bairro */}
          <div>
            <label style={labelStyle}>Bairro {!form.bairro.trim() && <span style={{ color:"#ef4444" }}>*</span>}</label>
            <input value={form.bairro} onChange={e => setForm(f=>({...f, bairro:e.target.value.toUpperCase()}))} placeholder="EX: CENTRO" style={inputStyle} />
          </div>
          {/* Cidade + UF */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 80px", gap:10 }}>
            <div>
              <label style={labelStyle}>Cidade {!form.cidade.trim() && <span style={{ color:"#ef4444" }}>*</span>}</label>
              <input value={form.cidade} onChange={e => setForm(f=>({...f, cidade:e.target.value.toUpperCase()}))} placeholder="EX: MANAUS" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>UF</label>
              <input value={form.estado} onChange={e => setForm(f=>({...f, estado:e.target.value.toUpperCase()}))} placeholder="AM" style={inputStyle} maxLength={2} />
            </div>
          </div>
          {/* Tipo de Serviço */}
          <div>
            <label style={{ ...labelStyle, marginBottom:8, display:"block" }}>Tipo de Serviço {!form.tipos.length && <span style={{ color:"#ef4444" }}>*</span>}</label>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {TIPOS_SINARM.map(t => (
                <CheckboxOpt key={t} checked={form.tipos.includes(t)} onClick={() => toggle("tipos", t)} label={t} />
              ))}
            </div>
          </div>
          {/* Armas */}
          <div>
            <label style={{ ...labelStyle, marginBottom:8, display:"block" }}>Armas {!form.armas.length && <span style={{ color:"#ef4444" }}>*</span>}</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {ARMAS_OPTS.map(a => (
                <CheckboxOpt key={a} checked={form.armas.includes(a)} onClick={() => toggle("armas", a)} label={a} />
              ))}
            </div>
          </div>
          {/* Psicológico */}
          <div>
            <label style={{ ...labelStyle, marginBottom:8, display:"block" }}>Psicológico</label>
            <label style={{
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12,
              border:`2px dashed ${form.psicoUrl ? GOLD : "rgba(201,162,39,0.3)"}`,
              borderRadius:12, padding:"28px 16px", cursor:"pointer",
              background: form.psicoUrl ? "rgba(201,162,39,0.06)" : "rgba(255,255,255,0.02)",
              transition:"all .2s",
            }}>
              <input type="file" accept=".pdf,image/*" onChange={handlePsicoFile} style={{ display:"none" }} />
              {uploadingPsico ? (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span style={{ color:GOLD, fontSize:13, fontWeight:600 }}>Enviando...</span>
                </>
              ) : form.psicoUrl ? (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ color:"#e8d5a0", fontSize:13, fontWeight:600 }}>✓ {form.psicoFile?.name || "Arquivo enviado"}</span>
                  <span style={{ color:"#7a6a48", fontSize:11 }}>Toque para trocar o arquivo</span>
                </>
              ) : (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(201,162,39,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span style={{ color:"#7a6a48", fontSize:13 }}>Toque para selecionar PDF ou imagem</span>
                </>
              )}
            </label>
          </div>

          <button onClick={salvar} disabled={saving || uploadingPsico} style={{
            marginTop:6, padding:12, borderRadius:10, background:GOLD, color:"#0f172a",
            fontWeight:700, fontSize:14, border:"none", cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1, transition:"opacity .2s",
          }}>
            {uploadingPsico ? "Aguardando upload..." : saving ? "Salvando..." : tela === "novo" ? "Salvar Cadastro" : "Atualizar Cadastro"}
          </button>
        </div>
      </div>
      <p style={{ color:"#3a3020", fontSize:11, marginTop:20 }}>rwinvestimentos.com.br</p>
    </div>
  );

  // ── Tela de lista ─────────────────────────────────────────────────────────
  return (
    <div style={{ background:"var(--background)", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", padding:"24px 16px" }}>
      <div style={{ width:"100%", maxWidth:440 }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div>
            <p style={{ color:GOLD, fontSize:11, letterSpacing:"0.15em", fontWeight:600, textTransform:"uppercase", margin:0 }}>✦ Despachante</p>
            <p style={{ color:"#e8d5a0", fontSize:18, fontWeight:700, margin:"4px 0 0" }}>{colaborador.nome}</p>
          </div>
          <button onClick={() => { setForm(initForm()); setTela("novo"); }} style={{
            display:"flex", alignItems:"center", gap:6, padding:"10px 14px", borderRadius:10,
            background:GOLD, color:"#0f172a", fontWeight:700, fontSize:13, border:"none", cursor:"pointer",
          }}>
            + Novo Cliente
          </button>
        </div>

        {/* Busca */}
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou CPF..."
          style={{ ...inputStyle, marginBottom:12 }}
        />

        {/* Contador */}
        <p style={{ color:"#7a6a48", fontSize:12, marginBottom:12 }}>
          {filtrados.length} cliente{filtrados.length !== 1 ? "s" : ""}
        </p>

        {/* Lista */}
        {filtrados.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:"#7a6a48" }}>
            <p style={{ fontSize:13 }}>{busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {filtrados.map(c => (
              <div key={c.id} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(201,162,39,0.15)", borderRadius:14, padding:"14px 16px" }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ color:"#e8d5a0", fontWeight:700, fontSize:14, margin:"0 0 2px", textTransform:"uppercase" }}>{c.nome}</p>
                    {c.cpf && <p style={{ color:"#7a6a48", fontSize:12, margin:"0 0 4px" }}>{c.cpf}</p>}
                    {c.cidade && <p style={{ color:"#5a4e38", fontSize:11, margin:"0 0 6px" }}>{[c.endereco, c.numero, c.bairro, c.cidade, c.estado].filter(Boolean).join(", ")}</p>}
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {c.tipo_sinarm && c.tipo_sinarm.split(", ").map(t => (
                        <span key={t} style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(201,162,39,0.15)", color:GOLD, border:"1px solid rgba(201,162,39,0.3)", fontWeight:600 }}>{t}</span>
                      ))}
                      {c.armas && c.armas.split(", ").map(a => (
                        <span key={a} style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(201,162,39,0.15)", color:GOLD, border:"1px solid rgba(201,162,39,0.3)", fontWeight:600 }}>{a}</span>
                      ))}
                      {c.psicologico_url && (
                        <a href={c.psicologico_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(34,197,94,0.1)", color:"#4ade80", border:"1px solid rgba(34,197,94,0.2)", textDecoration:"none", fontWeight:600 }}>
                          📄 Psicológico
                        </a>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    <button onClick={() => abrirEdicao(c)} title="Editar" style={{ background:"none", border:"1px solid rgba(201,162,39,0.35)", borderRadius:8, padding:"7px 9px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    {deletandoId === c.id ? (
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={() => excluir(c.id)} style={{ background:"#ef4444", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer", color:"#fff", fontSize:11, fontWeight:700 }}>Sim</button>
                        <button onClick={() => setDeletandoId(null)} style={{ background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"6px 8px", cursor:"pointer", color:"#7a6a48", fontSize:11 }}>Não</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletandoId(c.id)} title="Excluir" style={{ background:"none", border:"1px solid rgba(239,68,68,0.35)", borderRadius:8, padding:"7px 9px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p style={{ color:"#3a3020", fontSize:11, marginTop:24 }}>rwinvestimentos.com.br</p>
    </div>
  );
}
