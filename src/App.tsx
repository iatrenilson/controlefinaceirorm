import { useEffect, lazy, Suspense } from "react";
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

const Dashboard    = lazy(() => import("./pages/Dashboard"));
const Index        = lazy(() => import("./pages/Index"));
const Emprestimos  = lazy(() => import("./pages/Emprestimos"));
const Relatorios   = lazy(() => import("./pages/Relatorios"));
const Admin        = lazy(() => import("./pages/Admin"));
const DelayEsportivo = lazy(() => import("./pages/DelayEsportivo"));
const DelayDashboard = lazy(() => import("./pages/DelayDashboard"));
const Configuracoes  = lazy(() => import("./pages/Configuracoes"));
const Auth           = lazy(() => import("./pages/Auth"));
const ResetPassword  = lazy(() => import("./pages/ResetPassword"));
const Perfil         = lazy(() => import("./pages/Perfil"));
const NotFound       = lazy(() => import("./pages/NotFound"));
const DelayAddClient = lazy(() => import("./pages/DelayAddClient"));
const DelayViewer    = lazy(() => import("./pages/DelayViewer"));
const Declaracoes    = lazy(() => import("./pages/Declaracoes"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <p className="text-muted-foreground">Carregando...</p>
  </div>
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
          <Suspense fallback={<PageLoader />}>
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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/adicionar-cliente" element={<DelayAddClient />} />
        <Route path="/visualizar-delay" element={<DelayViewer />} />
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
