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

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  };

  const migrated = () => {
    const FLAG = "cac_cadastros_migration_v2";
    if (localStorage.getItem(FLAG)) return Promise.resolve();
    return supabase.functions.invoke("run-migration", { body: { sql: MIGRATION_SQL } })
      .then(() => localStorage.setItem(FLAG, "1"))
      .catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Informe o nome completo."); return; }

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
      "",
      "Passarinho Assessoria Bélica — rwinvestimentos.com.br",
    ].filter(l => l !== null).join("\n");
    window.open(`https://wa.me/5592993161828?text=${encodeURIComponent(linhas)}`, "_blank");

    // Salva no Supabase em segundo plano
    setSaving(true);
    await migrated();
    const { error } = await supabase.from("cac_cadastros").insert({
      nome: nome.trim(),
      cpf: cpf.trim() || null,
      endereco: endereco.trim() || null,
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      bairro: bairro.trim() || null,
      tipo_sinarm: tipos.length ? tipos.join(", ") : null,
      armas: armas.length ? armas.join(", ") : null,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }

    // Reseta formulário
    setNome(""); setCpf(""); setEndereco(""); setNumero(""); setComplemento(""); setBairro("");
    setTipos([]); setArmas([]);
    toast.success("Cadastro enviado! Formulário pronto para novo cliente.");
  };

  const gold = "#c9a227";

  return (
    <div className="bg-background" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,162,39,0.2)", borderRadius: 20, padding: "28px 24px" }}>
        <p style={{ color: gold, fontSize: 11, letterSpacing: "0.15em", fontWeight: 600, textTransform: "uppercase", margin: "0 0 20px" }}>✦ Cadastro</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Nome */}
          <div>
            <label style={labelStyle}>Nome completo *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João da Silva" style={inputStyle} />
          </div>

          {/* CPF */}
          <div>
            <label style={labelStyle}>CPF</label>
            <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" style={inputStyle} />
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
            <label style={{ ...labelStyle, marginBottom: 8, display: "block" }}>Tipo de Serviço</label>
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
            <label style={{ ...labelStyle, marginBottom: 8, display: "block" }}>Armas</label>
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

          <button type="submit" disabled={saving}
            style={{ marginTop: 6, padding: "12px", borderRadius: 10, background: gold, color: "#0f172a", fontWeight: 700, fontSize: 14, border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, transition: "opacity .2s" }}>
            {saving ? "Enviando..." : "Enviar Cadastro"}
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
