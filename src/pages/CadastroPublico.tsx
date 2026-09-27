import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS public.cac_cadastros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  tipo_sinarm TEXT,
  armas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.cac_cadastros ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cac_cadastros' AND policyname='cac_cad_insert') THEN
    CREATE POLICY "cac_cad_insert" ON public.cac_cadastros FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cac_cadastros' AND policyname='cac_cad_select') THEN
    CREATE POLICY "cac_cad_select" ON public.cac_cadastros FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
  END IF;
END $$;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS tipo_sinarm TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS armas TEXT;
ALTER TABLE public.cac_cadastros ADD COLUMN IF NOT EXISTS psicologico_url TEXT;
INSERT INTO storage.buckets (id, name, public) VALUES ('psicologicos', 'psicologicos', true) ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='psico_select') THEN
    CREATE POLICY "psico_select" ON storage.objects FOR SELECT USING (bucket_id = 'psicologicos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='psico_insert') THEN
    CREATE POLICY "psico_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'psicologicos');
  END IF;
END $$;
`.trim();

const TIPOS_SINARM = ["SINARM CAC", "SINARM POSSE", "SINARM PORTE"] as const;
const ARMAS_OPTS   = ["Pistola", "Revólver", "Rifle", "Espingarda"] as const;

export default function CadastroPublico() {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [tipos, setTipos] = useState<string[]>([]);
  const [armas, setArmas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [psicoFile, setPsicoFile] = useState<File | null>(null);
  const [psicoUrl, setPsicoUrl] = useState<string | null>(null);
  const [psicoExt, setPsicoExt] = useState<string>("pdf");
  const [uploadingPsico, setUploadingPsico] = useState(false);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  };

  const maskCpf = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };

  const migrated = () => {
    const FLAG = "cac_cadastros_migration_v3";
    if (localStorage.getItem(FLAG)) return Promise.resolve();
    return supabase.functions.invoke("run-migration", { body: { sql: MIGRATION_SQL } })
      .then(() => localStorage.setItem(FLAG, "1"))
      .catch(() => {});
  };

  const handlePsicoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop() || "pdf";
    setPsicoFile(file);
    setPsicoUrl(null);
    setPsicoExt(ext);
    setUploadingPsico(true);
    await migrated();
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("psicologicos").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("psicologicos").getPublicUrl(path);
      setPsicoUrl(publicUrl);
    } else {
      toast.error("Erro ao enviar arquivo: " + error.message);
      setPsicoFile(null);
    }
    setUploadingPsico(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim())    { toast.error("Informe o nome completo."); return; }
    if (!tipos.length)   { toast.error("Selecione ao menos um Tipo de Serviço."); return; }
    if (!armas.length)   { toast.error("Selecione ao menos uma Arma."); return; }

    // Monta e abre WhatsApp ANTES de qualquer await (evita bloqueio do navegador)
    const linhas = [
      "✅ *Confirmação de Cadastro*",
      "",
      `*Nome:* ${nome.trim()}`,
      cpf.trim()      ? `*CPF:* ${cpf.trim()}` : null,
      endereco.trim() ? `*Endereço:* ${endereco.trim()}${numero.trim() ? `, Nº ${numero.trim()}` : ""}${complemento.trim() ? ` - ${complemento.trim()}` : ""}` : null,
      bairro.trim()   ? `*Bairro:* ${bairro.trim()}` : null,
      tipos.length    ? `*Tipo:* ${tipos.join(", ")}` : null,
      armas.length    ? `*Armas:* ${armas.join(", ")}` : null,
      psicoUrl        ? `*Psicológico:* ${psicoUrl}?download=${encodeURIComponent(`${nome.trim().toUpperCase()} - Psicológico.${psicoExt}`)}` : null,
    ].filter(l => l !== null).join("\n");
    window.open(`https://wa.me/5592993161828?text=${encodeURIComponent(linhas)}`, "_blank");

    // Captura snapshot antes de resetar
    const snap = {
      nome: nome.trim(), cpf: cpf.trim() || null,
      endereco: endereco.trim() || null, numero: numero.trim() || null,
      complemento: complemento.trim() || null, bairro: bairro.trim() || null,
      tipo_sinarm: tipos.length ? tipos.join(", ") : null,
      armas: armas.length ? armas.join(", ") : null,
      psicologico_url: psicoUrl || null,
    };

    // Reseta imediatamente — independente do WhatsApp ser enviado ou não
    setNome(""); setCpf(""); setEndereco(""); setNumero(""); setComplemento(""); setBairro("");
    setTipos([]); setArmas([]); setPsicoFile(null); setPsicoUrl(null); setPsicoExt("pdf");
    toast.success("Cadastro concluído! Formulário pronto para novo cliente.");

    // Salva no Supabase em segundo plano
    migrated().then(() =>
      supabase.from("cac_cadastros").insert(snap).then(({ error }) => {
        if (error) toast.error("Erro ao salvar cadastro: " + error.message);
      })
    );
  };

  const gold = "#c9a227";

  return (
    <div className="bg-background" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,162,39,0.2)", borderRadius: 20, padding: "28px 24px" }}>
        <p style={{ color: gold, fontSize: 11, letterSpacing: "0.15em", fontWeight: 600, textTransform: "uppercase", margin: "0 0 20px" }}>✦ Cadastro</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div>

          {/* Nome */}
          <div>
            <label style={labelStyle}>Nome completo *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João da Silva" style={inputStyle} />
          </div>

          {/* CPF */}
          <div>
            <label style={labelStyle}>CPF</label>
            <input value={cpf} onChange={e => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" style={inputStyle} inputMode="numeric" />
          </div>

          {/* Endereço */}
          <div>
            <label style={labelStyle}>Endereço</label>
            <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, Av..." style={inputStyle} />
          </div>

          {/* Nº + Complemento */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Nº</label>
              <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="123" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Complemento</label>
              <input value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Apto, Bloco..." style={inputStyle} />
            </div>
          </div>

          {/* Bairro */}
          <div>
            <label style={labelStyle}>Bairro</label>
            <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Ex: Centro" style={inputStyle} />
          </div>

          {/* Tipo de Serviço */}
          <div>
            <label style={{ ...labelStyle, marginBottom: 8, display: "block" }}>Tipo de Serviço <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TIPOS_SINARM.map(t => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <div
                    onClick={() => toggleItem(tipos, setTipos, t)}
                    style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      border: `2px solid ${tipos.includes(t) ? gold : "rgba(201,162,39,0.3)"}`,
                      background: tipos.includes(t) ? gold : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all .15s", cursor: "pointer",
                    }}>
                    {tipos.includes(t) && (
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                        <path d="M1 4L4 7L10 1" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ color: tipos.includes(t) ? "#e8d5a0" : "#7a7060", fontSize: 13, fontWeight: tipos.includes(t) ? 600 : 400, transition: "color .15s" }}>
                    {t}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Armas */}
          <div>
            <label style={{ ...labelStyle, marginBottom: 8, display: "block" }}>Armas <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {ARMAS_OPTS.map(a => (
                <label key={a} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <div
                    onClick={() => toggleItem(armas, setArmas, a)}
                    style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      border: `2px solid ${armas.includes(a) ? gold : "rgba(201,162,39,0.3)"}`,
                      background: armas.includes(a) ? gold : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all .15s", cursor: "pointer",
                    }}>
                    {armas.includes(a) && (
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                        <path d="M1 4L4 7L10 1" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ color: armas.includes(a) ? "#e8d5a0" : "#7a7060", fontSize: 13, fontWeight: armas.includes(a) ? 600 : 400, transition: "color .15s" }}>
                    {a}
                  </span>
                </label>
              ))}
            </div>
          </div>

          </div>{/* fim campos */}

          {/* ── PSICOLÓGICO ── */}
          <div>
            <label style={{ ...labelStyle, marginBottom: 8, display: "block" }}>Psicológico</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
                border: `2px dashed ${psicoUrl ? gold : "rgba(201,162,39,0.3)"}`,
                borderRadius: 12, padding: "28px 16px", cursor: "pointer",
                background: psicoUrl ? "rgba(201,162,39,0.06)" : "rgba(255,255,255,0.02)",
                transition: "all .2s",
              }}>
                <input type="file" accept=".pdf,image/*" onChange={handlePsicoFile} style={{ display: "none" }} />
                {uploadingPsico ? (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span style={{ color: gold, fontSize: 13, fontWeight: 600 }}>Enviando...</span>
                  </>
                ) : psicoUrl ? (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span style={{ color: "#e8d5a0", fontSize: 13, fontWeight: 600 }}>✓ {psicoFile?.name}</span>
                    <span style={{ color: "#7a6a48", fontSize: 11 }}>Toque para trocar o arquivo</span>
                  </>
                ) : (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(201,162,39,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span style={{ color: "#7a6a48", fontSize: 13 }}>Toque para selecionar PDF ou imagem</span>
                  </>
                )}
              </label>
            </div>
          </div>

          <button type="submit" disabled={saving || uploadingPsico}
            style={{ marginTop: 6, padding: "12px", borderRadius: 10, background: gold, color: "#0f172a", fontWeight: 700, fontSize: 14, border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, transition: "opacity .2s" }}>
            {uploadingPsico ? "Aguardando upload..." : saving ? "Enviando..." : "Enviar Cadastro"}
          </button>
        </form>
      </div>

      <p style={{ color: "#3a3020", fontSize: 11, marginTop: 20 }}>rwinvestimentos.com.br</p>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  color: "#7a6a48", fontSize: 11, display: "block", marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(201,162,39,0.2)",
  background: "rgba(255,255,255,0.05)",
  color: "#e8d5a0",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
