import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { checkLeakedPassword } from "@/lib/check-leaked-password";
import rwLogo from "@/assets/rw-logo.png";

// Check hash IMMEDIATELY at module load time, before Supabase can consume it
const hashAtLoad = window.location.hash;
const hasRecoveryInHash = hashAtLoad.includes("type=recovery");

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(hasRecoveryInHash);
  const [checking, setChecking] = useState(!hasRecoveryInHash);
  const [leakedWarning, setLeakedWarning] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // If we already detected recovery from the hash, just wait for session to be ready
    if (hasRecoveryInHash) {
      // Give Supabase a moment to process the token and establish the session
      const waitForSession = async () => {
        // Wait for the session to be established (Supabase processes the hash)
        let attempts = 0;
        const checkSession = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setReady(true);
            setChecking(false);
            return;
          }
          attempts++;
          if (attempts < 20) {
            timeoutRef.current = setTimeout(checkSession, 250);
          } else {
            setChecking(false);
          }
        };
        checkSession();
      };
      waitForSession();
    }

    // Also listen for PASSWORD_RECOVERY event as fallback
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecking(false);
      }
    });

    // If no recovery detected from hash, give a grace period for the auth event
    if (!hasRecoveryInHash) {
      timeoutRef.current = setTimeout(() => {
        setChecking(false);
      }, 3000);
    }

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLeakedWarning(null);

    try {
      const result = await checkLeakedPassword(password);
      if (result.leaked) {
        setLeakedWarning(
          `Esta senha apareceu em ${result.count.toLocaleString("pt-BR")} vazamentos de dados. Escolha uma senha mais segura.`
        );
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Senha redefinida!", description: "Você já pode usar sua nova senha." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            <img src={rwLogo} alt="RW Investimentos" className="h-20 w-auto mx-auto" />
          </div>
          <CardTitle>Nova Senha</CardTitle>
        </CardHeader>
        <CardContent>
          {checking ? (
            <p className="text-center text-muted-foreground">Verificando link...</p>
          ) : ready ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label>Nova Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setLeakedWarning(null); }}
                    required
                    placeholder="••••••••"
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {leakedWarning && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{leakedWarning}</span>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verificando..." : "Redefinir Senha"}
              </Button>
            </form>
          ) : (
            <p className="text-center text-muted-foreground">Link inválido ou expirado. Solicite um novo link de redefinição.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
