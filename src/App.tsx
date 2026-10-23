import { lazy, Suspense, useEffect } from "react";
import type { ComponentType } from "react";
import NotificationBell from "@/components/NotificationBell";
import DigitalClock from "@/components/DigitalClock";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppProvider, useAppContext } from "@/hooks/useAppContext";
import { PaywallScreen } from "@/components/PaywallScreen";
import { TrialBanner } from "@/components/TrialBanner";
import { supabase } from "@/integrations/supabase/client";

// Cada página vira um arquivo separado: o site abre baixando só a página aberta
// (antes baixava o site inteiro, ~2 MB, para abrir qualquer tela)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pagina = (importar: () => Promise<{ default: ComponentType<any> }>) =>
  lazy(() => importar()
    .then(m => { sessionStorage.removeItem("rw_recarregou"); return m; })
    .catch(() => {
      // Depois de publicar uma versão nova os arquivos antigos somem: recarrega uma vez para pegar os novos
      if (!sessionStorage.getItem("rw_recarregou")) {
        sessionStorage.setItem("rw_recarregou", "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }
      return {
        default: () => (
          <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
            <p className="text-muted-foreground">Não foi possível carregar esta tela. Confira a internet e recarregue a página.</p>
          </div>
        ),
      };
    }));

const Dashboard = pagina(() => import("./pages/Dashboard"));
const Index = pagina(() => import("./pages/Index"));
const Emprestimos = pagina(() => import("./pages/Emprestimos"));
const Relatorios = pagina(() => import("./pages/Relatorios"));
const Admin = pagina(() => import("./pages/Admin"));
const DelayEsportivo = pagina(() => import("./pages/DelayEsportivo"));
const DelayDashboard = pagina(() => import("./pages/DelayDashboard"));
const Configuracoes = pagina(() => import("./pages/Configuracoes"));
const Auth = pagina(() => import("./pages/Auth"));
const ResetPassword = pagina(() => import("./pages/ResetPassword"));
const Perfil = pagina(() => import("./pages/Perfil"));
const NotFound = pagina(() => import("./pages/NotFound"));
const DelayAddClient = pagina(() => import("./pages/DelayAddClient"));
const DelayViewer = pagina(() => import("./pages/DelayViewer"));
const Declaracoes = pagina(() => import("./pages/Declaracoes"));
const Laudos = pagina(() => import("./pages/Laudos"));
const CadastroPublico = pagina(() => import("./pages/CadastroPublico"));
const CarteiraCliente = pagina(() => import("./pages/CarteiraCliente"));
const CarteiraDIgital = pagina(() => import("./pages/CarteiraDIgital"));
const CadastrosAdmin = pagina(() => import("./pages/CadastrosAdmin"));
const DocsCR = pagina(() => import("./pages/DocsCR"));
const ImageToPdf = pagina(() => import("./pages/ImageToPdf"));
const ColaboradorPortal = pagina(() => import("./pages/ColaboradorPortal"));

const Carregando = () => (
  <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>
);

const AdminRoute = ({ children }: { children?: React.ReactNode }) => {
  const { isAdmin, loading } = useAppContext();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children ? <>{children}</> : <Admin />;
};

const DelayRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, isModerator, loading } = useAppContext();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!isAdmin && !isModerator) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const queryClient = new QueryClient();

const ProtectedLayout = () => {
  const { user, loading, isAdmin, isModerator, hasAccess, isTrialActive, isTrialExpired, hoursLeft, trialStartedAt } = useAppContext();

  // Track online presence
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("online-users");
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: user.id, email: user.email });
      }
    });
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!hasAccess && !isAdmin && !isModerator) {
    return <PaywallScreen isTrialExpired={isTrialExpired} hoursLeft={hoursLeft} />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full flex-col">
        {isTrialActive && trialStartedAt && (
          <TrialBanner trialStartedAt={trialStartedAt} />
        )}
        <div className="flex flex-1 w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <div className="sticky top-0 z-20 flex items-center justify-between h-12 border-b bg-card/80 backdrop-blur-sm px-2 lg:hidden">
            <SidebarTrigger />
            <div className="flex items-center gap-3">
              <DigitalClock />
              <NotificationBell />
            </div>
          </div>
          <div className="hidden lg:flex sticky top-0 z-20 items-center justify-end h-12 border-b bg-card/80 backdrop-blur-sm px-4 gap-4">
            <DigitalClock />
            <NotificationBell />
          </div>
          <Suspense fallback={<Carregando />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/financeiro" element={<Index />} />
            <Route path="/emprestimos" element={<Emprestimos />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/admin" element={<AdminRoute />} />
            <Route path="/delay-esportivo" element={<DelayRoute><DelayEsportivo /></DelayRoute>} />
            <Route path="/delay-dashboard" element={<DelayRoute><DelayDashboard /></DelayRoute>} />
            <Route path="/declaracoes" element={<DelayRoute><Declaracoes /></DelayRoute>} />
            <Route path="/laudos" element={<DelayRoute><Laudos /></DelayRoute>} />
            <Route path="/cadastros" element={<DelayRoute><CadastrosAdmin /></DelayRoute>} />
            <Route path="/docs-cr" element={<DelayRoute><DocsCR /></DelayRoute>} />
            <Route path="/imagem-para-pdf" element={<DelayRoute><ImageToPdf /></DelayRoute>} />
            <Route path="/carteira-digital" element={<DelayRoute><CarteiraDIgital /></DelayRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

const AppRoutes = () => {
  const { user, loading } = useAppContext();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <Suspense fallback={<Carregando />}>
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/adicionar-cliente" element={<DelayAddClient />} />
      <Route path="/visualizar-delay" element={<DelayViewer />} />
      <Route path="/carteira/:id" element={<CarteiraCliente />} />
      <Route path="/cadastro" element={<CadastroPublico />} />
      <Route path="/area/:token" element={<ColaboradorPortal />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
