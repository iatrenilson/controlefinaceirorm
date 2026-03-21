import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";

import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import Emprestimos from "./pages/Emprestimos";
import Relatorios from "./pages/Relatorios";
import Admin from "./pages/Admin";
import Perfil from "./pages/Perfil";
import Configuracoes from "./pages/Configuracoes";
import DelayEsportivo from "./pages/DelayEsportivo";
import DelayDashboard from "./pages/DelayDashboard";
import DelayAddClient from "./pages/DelayAddClient";
import DelayViewer from "./pages/DelayViewer";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto flex flex-col">
          <div className="flex justify-end items-center p-4 border-b">
            <NotificationBell />
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/adicionar-cliente" element={<DelayAddClient />} />
          <Route path="/adicionar-cliente/:token" element={<DelayAddClient />} />
          <Route path="/visualizar-delay" element={<DelayViewer />} />
          <Route path="/visualizar-delay/:token" element={<DelayViewer />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout><Index /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financeiro"
            element={
              <ProtectedRoute>
                <AppLayout><Index /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/emprestimos"
            element={
              <ProtectedRoute>
                <AppLayout><Emprestimos /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/relatorios"
            element={
              <ProtectedRoute>
                <AppLayout><Relatorios /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/delay"
            element={
              <ProtectedRoute>
                <AppLayout><DelayEsportivo /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/delay-esportivo"
            element={
              <ProtectedRoute>
                <AppLayout><DelayEsportivo /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/delay-dashboard"
            element={
              <ProtectedRoute>
                <AppLayout><DelayDashboard /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AppLayout><Admin /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <AppLayout><Perfil /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <ProtectedRoute>
                <AppLayout><Configuracoes /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
      <ShadcnToaster />
    </QueryClientProvider>
  );
}

export default App;
