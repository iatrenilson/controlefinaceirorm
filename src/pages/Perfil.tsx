import { useState, useEffect, useRef } from "react";
import { Camera, Loader2, Save, User, Mail, ArrowLeft, Phone, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const Perfil = () => {
  const { user, loading: authLoading } = useAuth();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [complemento, setComplemento] = useState("");
  const [pontoReferencia, setPontoReferencia] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome, email, avatar_url, telefone, endereco, complemento, ponto_referencia")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setNome(data.nome || "");
        setEmail(data.email || user.email || "");
        setTelefone(data.telefone || "");
        setEndereco(data.endereco || "");
        setComplemento(data.complemento || "");
        setPontoReferencia(data.ponto_referencia || "");
        // If avatar_url is a storage path (no http), create signed URL
        if (data.avatar_url && !data.avatar_url.startsWith("http")) {
          const { data: signedData } = await supabase.storage
            .from("avatars")
            .createSignedUrl(data.avatar_url, 3600);
          setAvatarUrl(signedData?.signedUrl || null);
        } else if (data.avatar_url) {
          // Legacy public URL - try to get signed URL from path
          const match = data.avatar_url.match(/avatars\/(.+?)(\?|$)/);
          if (match) {
            const { data: signedData } = await supabase.storage
              .from("avatars")
              .createSignedUrl(match[1], 3600);
            setAvatarUrl(signedData?.signedUrl || null);
          } else {
            setAvatarUrl(data.avatar_url);
          }
        }
      } else {
        setEmail(user.email || "");
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the path, not the public URL (bucket is private)
      await supabase
        .from("profiles")
        .update({ avatar_url: filePath })
        .eq("user_id", user.id);

      // Get signed URL for display
      const { data: signedData } = await supabase.storage
        .from("avatars")
        .createSignedUrl(filePath, 3600);

      setAvatarUrl(signedData?.signedUrl || null);
      toast.success("Foto atualizada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar foto. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ nome, email, telefone, endereco, complemento, ponto_referencia: pontoReferencia })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar perfil. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const initials = nome
    ? nome.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden border-b bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
        <div className="relative px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/configuracoes"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-primary">Configurações</p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Meu Perfil</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
        {/* Avatar Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <Avatar className="h-28 w-28 border-4 border-primary/20">
                  <AvatarImage src={avatarUrl || undefined} alt={nome} />
                  <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : (
                    <Camera className="h-6 w-6 text-primary" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadAvatar}
                />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">{nome || "Sem nome"}</p>
                <p className="text-sm text-muted-foreground">{email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Telefone
              </Label>
              <Input
                id="telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco" className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Endereço
              </Label>
              <Input
                id="endereco"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro, cidade"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  placeholder="Apto, bloco, sala..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pontoReferencia">Ponto de Referência</Label>
                <Input
                  id="pontoReferencia"
                  value={pontoReferencia}
                  onChange={(e) => setPontoReferencia(e.target.value)}
                  placeholder="Próximo a..."
                />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Perfil;
