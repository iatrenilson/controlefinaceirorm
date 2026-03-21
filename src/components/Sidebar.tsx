import { Link } from "react-router-dom";
import { CreditCardIcon, HomeIcon, SettingsIcon, UsersIcon } from "./Icons";
import { ModeToggle } from "./mode-toggle";

export function Sidebar() {
  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
            <CreditCardIcon className="h-6 w-6" />
            <span className="">Controle Financeiro</span>
          </Link>
          <ModeToggle className="ml-auto" />
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            <Link
              to="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
            >
              <HomeIcon className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              to="/financeiro"
              className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-primary transition-all hover:text-primary"
            >
              <CreditCardIcon className="h-4 w-4" />
              Controle Financeiro
            </Link>
            <Link
              to="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
            >
              <UsersIcon className="h-4 w-4" />
              Usuários
            </Link>
            <Link
              to="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
            >
              <SettingsIcon className="h-4 w-4" />
              Configurações
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
