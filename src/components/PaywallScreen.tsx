import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, LogOut, MessageCircle, ShieldCheck, Clock, Loader2, Copy, Check, CheckCircle2 } from "lucide-react";
import { WHATSAPP_LINK } from "@/lib/constants";

const rwLogo = "/logo-passarinho.png";

interface PaywallScreenProps {
  hoursLeft?: number;
  isTrialExpired?: boolean;
}

interface PixData {
  payment_id: number;
  qr_code: string;
  qr_code_base64: string;
}

export const PaywallScreen = ({ hoursLeft = 0, isTrialExpired = true }: PaywallScreenProps) => {
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [paid, setPaid] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleWhatsApp = () => {
    window.open(WHATSAPP_LINK, "_blank");
  };

  // Poll subscription status every 5s after PIX is generated
  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("subscriptions")
        .select("subscription_expires_at")
        .eq("user_id", user.id)
        .single();
      if (data?.subscription_expires_at && new Date(data.subscription_expires_at) > new Date()) {
        setPaid(true);
        if (pollRef.current) clearInterval(pollRef.current);
        setTimeout(() => window.location.reload(), 2500);
      }
    }, 5000);
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleBuyNow = async () => {
    setLoadingPayment(true);
    setPixData(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment");
      if (error || !data?.qr_code) throw new Error(error?.message || "Erro ao criar pagamento");
      setPixData(data);
      startPolling();
    } catch (err) {
      console.error("Payment error:", err);
      alert("Erro ao gerar PIX. Tente novamente ou entre em contato via WhatsApp.");
    } finally {
      setLoadingPayment(false);
    }
  };

  const copyPix = () => {
    if (!pixData?.qr_code) return;
    navigator.clipboard.writeText(pixData.qr_code);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const features = [
    "Gestão completa de empréstimos",
    "Controle Pessoal Mensal",
    "Relatórios e históricos",
    "Suporte prioritário",
  ];

  // Payment confirmed screen
  if (paid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <img src={rwLogo} alt="RW Investimentos" className="h-20 w-auto mx-auto" />
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-5">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
          <p className="text-muted-foreground text-sm">Seu acesso foi ativado por 30 dias. Redirecionando...</p>
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md text-center space-y-5">
        {/* Logo */}
        <img src={rwLogo} alt="RW Investimentos" className="h-20 w-auto mx-auto" />

        {/* Lock icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-5">
            <Lock className="h-10 w-10 text-destructive" />
          </div>
        </div>

        {/* Title */}
        {isTrialExpired ? (
          <div className="space-y-2">
            <Badge variant="destructive" className="text-sm px-3 py-1">Período de teste encerrado</Badge>
            <h1 className="text-2xl font-bold">Sua avaliação gratuita expirou</h1>
            <p className="text-muted-foreground text-sm">
              Seu período gratuito de 24 horas chegou ao fim. Adquira um plano para continuar usando o RW Investimentos.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Badge variant="outline" className="text-sm px-3 py-1 border-yellow-500 text-yellow-500">
              <Clock className="h-3 w-3 mr-1 inline" />
              Avaliação gratuita ativa
            </Badge>
            <h1 className="text-2xl font-bold">Você está no período de teste</h1>
            <p className="text-muted-foreground text-sm">
              Restam <span className="font-bold text-foreground">{Math.floor(hoursLeft)}h {Math.floor((hoursLeft % 1) * 60)}min</span> de avaliação gratuita.
            </p>
          </div>
        )}

        {/* Features */}
        <div className="rounded-xl border bg-card p-4 text-left space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">O que está incluído no plano</p>
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>

        {/* Price */}
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Plano Mensal</p>
          <p className="text-3xl font-bold text-primary mt-1">R$ 29,90<span className="text-base font-normal text-muted-foreground">/mês</span></p>
          <p className="text-xs text-muted-foreground mt-1">Acesso renovado automaticamente após o pagamento</p>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <style>{`
            @keyframes mp-shimmer {
              0% { transform: translateX(-150%) skewX(-20deg); }
              100% { transform: translateX(350%) skewX(-20deg); }
            }
            @keyframes mp-glow {
              0%, 100% { box-shadow: 0 0 8px 2px rgba(0,158,227,0.5); }
              50% { box-shadow: 0 0 22px 8px rgba(0,158,227,0.85); }
            }
            .mp-btn { animation: mp-glow 2s ease-in-out infinite; }
            .mp-btn:hover { filter: brightness(1.08); transform: scale(1.02); }
            .mp-btn:active { transform: scale(0.98); }
            .mp-shimmer { animation: mp-shimmer 2.2s ease-in-out infinite; animation-delay: 0.8s; }
          `}</style>

          {/* PIX QR Code section — shown after clicking buy */}
          {pixData ? (
            <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3 text-center">
              <p className="text-sm font-semibold text-primary">Escaneie o QR Code PIX</p>
              <p className="text-xs text-muted-foreground">
                Abra o app do seu banco, acesse <strong>PIX → Pagar → QR Code</strong> e escaneie
              </p>

              {/* QR Code */}
              <div className="flex justify-center">
                {pixData.qr_code_base64 ? (
                  <img
                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="rounded-lg border"
                    width={200}
                    height={200}
                  />
                ) : (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(pixData.qr_code)}`}
                    alt="QR Code PIX"
                    className="rounded-lg border"
                    width={200}
                    height={200}
                  />
                )}
              </div>

              {/* Copy PIX */}
              <button
                onClick={copyPix}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-border bg-muted px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                {copiedPix ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                {copiedPix ? "Copiado!" : "Copiar código PIX (Copia e Cola)"}
              </button>

              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                <Loader2 className="h-3 w-3 animate-spin" />
                Aguardando confirmação do pagamento...
              </div>

              {/* Generate new */}
              <button
                onClick={handleBuyNow}
                className="text-xs text-muted-foreground underline underline-offset-2"
                disabled={loadingPayment}
              >
                Gerar novo código
              </button>
            </div>
          ) : (
            /* Buy button */
            <button
              className="mp-btn w-full relative overflow-hidden flex items-center justify-center gap-3 rounded-xl px-4 py-4 text-white font-bold text-base transition-all duration-200 disabled:opacity-60 disabled:animate-none"
              style={{ background: "linear-gradient(135deg, #00b4d8 0%, #009EE3 50%, #0077b6 100%)" }}
              onClick={handleBuyNow}
              disabled={loadingPayment}
            >
              {!loadingPayment && (
                <span
                  className="mp-shimmer pointer-events-none absolute top-0 left-0 h-full w-1/3"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)" }}
                />
              )}
              {loadingPayment ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/b/b8/MercadoPago_logo.svg"
                  alt="Mercado Pago"
                  className="h-6 object-contain brightness-0 invert"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <span className="relative z-10 tracking-wide">
                {loadingPayment ? "Gerando PIX..." : "Gerar PIX — R$ 29,90"}
              </span>
            </button>
          )}

          {/* WhatsApp */}
          <Button
            className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
            size="lg"
            onClick={handleWhatsApp}
          >
            <MessageCircle className="h-5 w-5" />
            Tire suas dúvidas via WhatsApp
          </Button>

          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            size="sm"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
};
