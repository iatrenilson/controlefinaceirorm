import { ClipboardList } from "lucide-react";

const Laudos = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4">
          <ClipboardList className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">Laudos</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Gerenciamento de laudos</p>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
          <ClipboardList className="h-16 w-16 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold text-muted-foreground">Em construção</h2>
          <p className="text-sm text-muted-foreground/70">Esta seção estará disponível em breve.</p>
        </div>
      </main>
    </div>
  );
};

export default Laudos;
