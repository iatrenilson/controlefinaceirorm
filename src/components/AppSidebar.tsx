import { Landmark, LayoutDashboard, LogOut, Receipt, Settings, ShieldCheck, User, BarChart3, Timer, PieChart, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import rwLogo from "@/assets/rw-logo.png";
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
  { title: "Controle Mensal", url: "/financeiro", icon: Receipt },
  { title: "Clientes EmprÃ©stimos", url: "/emprestimos", icon: Landmark },
  { title: "RelatÃ³rios", url: "/relatorios", icon: BarChart3 },
];

export function AppSidebar() {
  const { isAdmin, isModerator, isRestricted, loading: roleLoading } = useUserRole();
  const { signOut } = useAuth();

  const showDelaySection = isAdmin || isModerator;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-0">
        {/* Logo */}
        <div className="px-1 py-2 flex items-center justify-center">
          <img src={rwLogo} alt="RW Investimentos" className="h-48 w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10" />
        </div>

        {/* Profile & Settings */}
        <div className="px-2 pb-2 flex items-center justify-between">
          <SidebarMenu className="flex-1">
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Meu Perfil">
                {isRestricted ? (
                  <div className="flex items-center gap-2 opacity-50 cursor-not-allowed px-2 py-1.5">
                    <User className="h-4 w-4" />
                    <span>Meu Perfil</span>
                    <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
                  </div>
                ) : (
                  <NavLink to="/perfil" end activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary">
                    <User className="h-4 w-4" />
                    <span>Meu Perfil</span>
                  </NavLink>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="ConfiguraÃ§Ãµes">
                {isRestricted ? (
                  <div className="flex items-center gap-2 opacity-50 cursor-not-allowed px-2 py-1.5">
                    <Settings className="h-4 w-4" />
                    <span>ConfiguraÃ§Ãµes</span>
                    <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
                  </div>
                ) : (
                  <NavLink to="/configuracoes" end activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary">
                    <Settings className="h-4 w-4" />
                    <span>ConfiguraÃ§Ãµes</span>
                  </NavLink>
                )}
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
                    {isRestricted ? (
                      <div className="flex items-center gap-2 opacity-50 cursor-not-allowed px-2 py-1.5">
                        <item.icon className="h-[18px] w-[18px]" />
                        <span>{item.title}</span>
                        <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
                      </div>
                    ) : (
                      <NavLink to={item.url} end activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary">
                        <item.icon className="h-[18px] w-[18px]" />
                        <span>{item.title}</span>
                      </NavLink>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin / Moderator Nav */}
        {roleLoading ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary/80">AdministraÃ§Ã£o</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem><Skeleton className="h-8 w-full rounded-md" /></SidebarMenuItem>
                <SidebarMenuItem><Skeleton className="h-8 w-full rounded-md" /></SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : showDelaySection && !isRestricted ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary/80">AdministraÃ§Ã£o</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Painel Admin">
                      <NavLink to="/admin" end activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary">
                        <ShieldCheck className="h-[18px] w-[18px]" />
                        <span>Controle de Usuários</span>
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
        ) : null}
      </SidebarContent>

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
