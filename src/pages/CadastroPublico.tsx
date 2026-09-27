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
`.trim();

export default function CadastroPublico() {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [saving, setSaving] = useState(false);

  const migrated = () => {
    const FLAG = "cac_cadastros_migration_v1";
    if (localStorage.getItem(FLAG)) return Promise.resolve();
    return supabase.functions.invoke("run-migration", { body: { sql: MIGRATION_SQL } })
      .then(() => localStorage.setItem(FLAG, "1"))
      .catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Informe o nome completo."); return; }
    setSaving(true);
    await migrated();
    const { error } = await supabase.from("cac_cadastros").insert({
      nome: nome.trim(),
      cpf: cpf.trim() || null,
      endereco: endereco.trim() || null,
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      bairro: bairro.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao enviar: " + error.message); return; }

    // Abre WhatsApp com confirmação do cadastro
    const linhas = [
      "✅ *Confirmação de Cadastro*",
      "",
      `*Nome:* ${nome.trim()}`,
      cpf.trim()         ? `*CPF:* ${cpf.trim()}`                : null,
      endereco.trim()    ? `*Endereço:* ${endereco.trim()}${numero.trim() ? `, Nº ${numero.trim()}` : ""}${complemento.trim() ? ` - ${complemento.trim()}` : ""}` : null,
      bairro.trim()      ? `*Bairro:* ${bairro.trim()}`           : null,
      "",
      "Passarinho Assessoria Bélica — rwinvestimentos.com.br",
    ].filter(l => l !== null).join("\n");

    const url = `https://wa.me/5592993161828?text=${encodeURIComponent(linhas)}`;
    window.open(url, "_blank");

    // Reseta formulário para novo cadastro
    setNome(""); setCpf(""); setEndereco(""); setNumero(""); setComplemento(""); setBairro("");
    toast.success("Cadastro enviado! Formulário pronto para novo cliente.");
  };

  const gold = "#c9a227";

  return (
    <div className="bg-background" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,162,39,0.2)", borderRadius: 20, padding: "28px 24px" }}>
        <>
            <p style={{ color: gold, fontSize: 11, letterSpacing: "0.15em", fontWeight: 600, textTransform: "uppercase", margin: "0 0 20px" }}>✦ Cadastro</p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ color: "#7a6a48", fontSize: 11, display: "block", marginBottom: 4 }}>Nome completo *</label>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João da Silva"
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#7a6a48", fontSize: 11, display: "block", marginBottom: 4 }}>CPF</label>
                <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00"
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ color: "#7a6a48", fontSize: 11, display: "block", marginBottom: 4 }}>Endereço</label>
                <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, Av..."
                  style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ color: "#7a6a48", fontSize: 11, display: "block", marginBottom: 4 }}>Nº</label>
                  <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="123"
                    style={inputStyle} />
                </div>
                <div>
                  <label style={{ color: "#7a6a48", fontSize: 11, display: "block", marginBottom: 4 }}>Complemento</label>
                  <input value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Apto, Bloco..."
                    style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ color: "#7a6a48", fontSize: 11, display: "block", marginBottom: 4 }}>Bairro</label>
                <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Ex: Centro"
                  style={inputStyle} />
              </div>
              <button type="submit" disabled={saving}
                style={{ marginTop: 6, padding: "12px", borderRadius: 10, background: gold, color: "#0f172a", fontWeight: 700, fontSize: 14, border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, transition: "opacity .2s" }}>
                {saving ? "Enviando..." : "Enviar Cadastro"}
              </button>
            </form>
          </>
      </div>

      <p style={{ color: "#3a3020", fontSize: 11, marginTop: 20 }}>rwinvestimentos.com.br</p>
    </div>
  );
}

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
