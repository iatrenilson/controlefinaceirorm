import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";
import rwLogo from "@/assets/rw-logo.png";
import { checkLeakedPassword } from "@/lib/check-leaked-password";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [leakedWarning, setLeakedWarning] = useState<string | null>(null);
  const { toast } = useToast();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
      setIsForgot(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (isForgot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <img src={rwLogo} alt="RW Investimentos" className="h-50 w-auto mx-auto" />
            </div>
            <CardTitle>Redefinir Senha</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Aguarde..." : "Enviar link de redefinição"}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-4">
              <button onClick={() => setIsForgot(false)} className="text-primary underline">Voltar ao login</button>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLeakedWarning(null);

    try {
      // Check for leaked password on signup
      if (!isLogin) {
        const result = await checkLeakedPassword(password);
        if (result.leaked) {
          setLeakedWarning(
            `Esta senha apareceu em ${result.count.toLocaleString("pt-BR")} vazamentos de dados. Escolha uma senha mais segura.`
          );
          setLoading(false);
          return;
        }
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Verifique seu e-mail para confirmar o cadastro.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <img src={rwLogo} alt="RW Investimentos" className="h-50 w-auto mx-auto" />
            </div>
          <CardTitle>{isLogin ? "Entrar" : "Criar Conta"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setLeakedWarning(null); }} required placeholder="••••••••" minLength={6} />
            </div>
            {leakedWarning && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{leakedWarning}</span>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verificando..." : isLogin ? "Entrar" : "Cadastrar"}
            </Button>
            {isLogin && (
              <button type="button" onClick={() => setIsForgot(true)} className="text-xs text-muted-foreground hover:text-primary underline w-full text-right">
                Esqueci minha senha
              </button>
            )}
          </form>
          <div className="flex items-center gap-3 my-4">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">ou</span>
            <Separator className="flex-1" />
          </div>
          <Button variant="outline" className="w-full gap-2" onClick={handleGoogleLogin} disabled={loadingGoogle}>
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {loadingGoogle ? "Aguarde..." : "Entrar com Google"}
          </Button>
          <p className="text-center text-sm text-muted-foreground mt-4">
            {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-primary underline">
              {isLogin ? "Cadastre-se" : "Faça login"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
