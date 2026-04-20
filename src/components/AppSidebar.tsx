import { Landmark, LayoutDashboard, LogOut, Receipt, Settings, ShieldCheck, User, BarChart3, Timer, PieChart, Crown, RefreshCw, Clock, FileText } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/hooks/useSubscription";
import { PixPaymentDialog } from "@/components/PixPaymentDialog";
import { Skeleton } from "@/components/ui/skeleton";
const rwLogo = "/rw-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Controle Financeiro", url: "/financeiro", icon: Receipt },
  { title: "Clientes Empréstimos", url: "/emprestimos", icon: Landmark },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

function PlanCard() {
  const { isTrialActive, isTrialExpired, hoursLeft, subscriptionExpiresAt, trialStartedAt, loading } = useSubscription();
  const { isAdmin, isModerator, loading: roleLoading } = useUserRole();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (loading || roleLoading) return null;
  if (isAdmin || isModerator) return null;

  const now = new Date();
  const isActive = !!subscriptionExpiresAt && new Date(subscriptionExpiresAt) > now;

  // Only show card if: trial active/expired, plan expired, or expires within 24h
  const expiresInMs = subscriptionExpiresAt ? new Date(subscriptionExpiresAt).getTime() - now.getTime() : 0;
  const expiresWithin24h = isActive && expiresInMs < 24 * 60 * 60 * 1000;
  const shouldShow = isTrialActive || isTrialExpired || !isActive || expiresWithin24h;
  if (!shouldShow) return null;

  // Compute expiry label
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const trialEndDate = trialStartedAt
    ? new Date(new Date(trialStartedAt).getTime() + 24 * 60 * 60 * 1000)
    : null;

  const color = isActive ? "#22c55e" : isTrialActive ? "#eab308" : "#ef4444";
  const bgColor = isActive ? "rgba(34,197,94,0.07)" : isTrialActive ? "rgba(234,179,8,0.07)" : "rgba(239,68,68,0.07)";
  const borderColor = isActive ? "rgba(34,197,94,0.28)" : isTrialActive ? "rgba(234,179,8,0.28)" : "rgba(239,68,68,0.28)";

  const planLabel = isActive ? "Plano Mensal Ativo" : isTrialActive ? "Trial Ativo" : "Sem Plano Ativo";

  return (
    <div
      className="mx-2 mb-2 rounded-lg border px-2.5 py-2 flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden"
      style={{ background: bgColor, borderColor }}
    >
      {/* Left: icon + info */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Crown className="h-3 w-3 flex-shrink-0" style={{ color }} />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold truncate" style={{ color }}>
            {isActive ? "Mensal" : isTrialActive ? "Trial" : "Sem plano"}
          </p>
          <p className="text-[9px] text-muted-foreground truncate">
            {isActive && subscriptionExpiresAt
              ? `Expira ${fmtDate(subscriptionExpiresAt)}`
              : isTrialActive && trialEndDate
              ? `${Math.floor(hoursLeft)}h ${Math.floor((hoursLeft % 1) * 60)}min restantes`
              : "Expirado"}
          </p>
        </div>
      </div>

      {/* Right: renew button */}
      <button
        onClick={() => setDialogOpen(true)}
        className="flex-shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-80"
        style={{ background: "#009EE3" }}
      >
        <RefreshCw className="h-2.5 w-2.5" />
        {isActive ? "Renovar" : "Assinar"}
      </button>

      <PixPaymentDialog open={dialogOpen} onOpenChange={setDialogOpen} currentExpiresAt={subscriptionExpiresAt} />
    </div>
  );
}

export function AppSidebar() {
  const { isAdmin, isModerator, loading: roleLoading } = useUserRole();
  const { signOut } = useAuth();

  const showDelaySection = isAdmin || isModerator;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-0">
        {/* Logo */}
        <div className="px-1 py-2 flex items-center justify-center">
          <img src={rwLogo} alt="RW Investimentos" className="h-20 sm:h-32 lg:h-48 w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10" />
        </div>

        {/* Profile & Settings */}
        <div className="px-2 pb-2 flex items-center justify-between">
          <SidebarMenu className="flex-1">
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Meu Perfil">
                <NavLink to="/perfil" end activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary">
                  <User className="h-4 w-4" />
                  <span>Meu Perfil</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Configurações">
                <NavLink to="/configuracoes" end activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary">
                  <Settings className="h-4 w-4" />
                  <span>Configurações</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="shrink-0 group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </div>
        </div>

        {/* Main Nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary/80">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink to={item.url} end activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary">
                      <item.icon className="h-[18px] w-[18px]" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin / Moderator Nav */}
        {roleLoading ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary/80">Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem><Skeleton className="h-8 w-full rounded-md" /></SidebarMenuItem>
                <SidebarMenuItem><Skeleton className="h-8 w-full rounded-md" /></SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : showDelaySection ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary/80">Administração</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Painel Admin">
                        <NavLink to="/admin" end activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary">
                          <ShieldCheck className="h-[18px] w-[18px]" />
                          <span>Painel Admin</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Delay Esportivo">
                      <NavLink to="/delay-esportivo" end activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary">
                        <Timer className="h-[18px] w-[18px]" />
                        <span>Delay Esportivo</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Dashboard Delay">
                      <NavLink to="/delay-dashboard" end activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary">
                        <PieChart className="h-[18px] w-[18px]" />
                        <span>Dashboard Delay</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Sinarm CAC */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary/80">Sinarm CAC</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Clientes / Declarações">
                      <NavLink to="/declaracoes" end activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary">
                        <FileText className="h-[18px] w-[18px]" />
                        <span>Clientes / Declarações</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>

      {/* Plan card above footer */}
      <PlanCard />

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sair" onClick={() => signOut()} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <LogOut className="h-[18px] w-[18px]" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
