import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import NotificationBell from "@/components/NotificationBell";
import { Lock } from "lucide-react";

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

function RestrictedOverlay() {
  const whatsappLink = "https://wa.me/5592993161828";
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4 p-8">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <Lock className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          Sua conta está com acesso restrito. Entre em contato com o administrador para liberar o acesso.
        </p>
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp (92) 99316-1828
        </a>
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { isRestricted, loading } = useUserRole();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto flex flex-col">
          <div className="sticky top-0 z-40 flex justify-end items-center p-4 border-b bg-background/95 backdrop-blur-sm">
            <NotificationBell />
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            {!loading && isRestricted ? <RestrictedOverlay /> : children}
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
