import { useEffect } from "react";
import NotificationBell from "@/components/NotificationBell";
import DigitalClock from "@/components/DigitalClock";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./pages/Dashboard";
import Index from "./pages/Index";
import Emprestimos from "./pages/Emprestimos";
import Relatorios from "./pages/Relatorios";
import Admin from "./pages/Admin";
import DelayEsportivo from "./pages/DelayEsportivo";
import DelayDashboard from "./pages/DelayDashboard";
import Configuracoes from "./pages/Configuracoes";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Perfil from "./pages/Perfil";
import NotFound from "./pages/NotFound";
import DelayAddClient from "./pages/DelayAddClient";
import DelayViewer from "./pages/DelayViewer";

const AdminRoute = ({ children }: { children?: React.ReactNode }) => {
  const { isAdmin, loading } = useUserRole();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children ? <>{children}</> : <Admin />;
};

const DelayRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, isModerator, loading } = useUserRole();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!isAdmin && !isModerator) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const queryClient = new QueryClient();

const ProtectedLayout = () => {
  const { user, loading } = useAuth();

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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </SidebarProvider>
  );
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/adicionar-cliente" element={<DelayAddClient />} />
      <Route path="/visualizar-delay" element={<DelayViewer />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
