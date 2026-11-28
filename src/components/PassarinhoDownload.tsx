import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Botão de baixar a Passarinho ao lado do sino (2026-11-27, o usuário pediu): sempre à mão, em qualquer computador.
// A versão nova vem de /passarinho/updates.json (escrito por publicar-firefox.mjs, que também gera o zip do Chrome).
// A instalada vem de <html data-passarinho> (site-ponte.js, só a partir da 3.54; antes disso o site não tem como saber).
const maior = (a: string, b: string) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
};

export default function PassarinhoDownload() {
  const [nova, setNova] = useState<{ versao: string; xpi: string } | null>(null);
  const [instalada, setInstalada] = useState<string>("");
  const firefox = /Firefox\//.test(navigator.userAgent);

  useEffect(() => {
    let parar = false;
    const conferir = async () => {
      setInstalada(document.documentElement.dataset.passarinho || "");
      try {
        const j = await (await fetch("/passarinho/updates.json", { cache: "no-store" })).json();
        const lista = (Object.values(j?.addons ?? {})[0] as { updates?: { version: string; update_link: string }[] })?.updates ?? [];
        const u = [...lista].sort((a, b) => (maior(a.version, b.version) ? -1 : 1))[0];
        if (!parar && u) setNova({ versao: u.version, xpi: u.update_link.replace(/^https?:\/\/[^/]+/, "") });
      } catch { /* tenta de novo depois */ }
    };
    const t = setTimeout(conferir, 2500);
    const i = setInterval(conferir, 60000);
    return () => { parar = true; clearTimeout(t); clearInterval(i); };
  }, []);

  const desatualizada = !!(nova && instalada && maior(nova.versao, instalada));

  return (
    <Popover onOpenChange={o => o && setInstalada(document.documentElement.dataset.passarinho || "")}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" title="Baixar a Passarinho">
          <Download className="h-5 w-5" />
          {desatualizada && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-background" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-sm space-y-3">
        <div>
          <p className="font-semibold">🐦 Passarinho {nova ? `versão ${nova.versao}` : ""}</p>
          <p className="text-xs text-muted-foreground">
            {instalada
              ? desatualizada
                ? <>Neste computador está a <b className="text-amber-400">{instalada}</b>: baixe a nova.</>
                : <>Neste computador já está a {instalada} (em dia).</>
              : "Neste navegador o site não encontrou a Passarinho (ou ela é anterior à 3.54)."}
          </p>
        </div>
        {firefox ? (
          <>
            <Button asChild className="w-full gap-2"><a href={nova?.xpi || "/passarinho/updates.json"}><Download className="h-4 w-4" /> Instalar no Firefox</a></Button>
            <p className="text-xs text-muted-foreground">No Firefox ela se atualiza sozinha depois de instalada.</p>
          </>
        ) : (
          <>
            <Button asChild className="w-full gap-2">
              <a href="/passarinho/passarinho-chrome.zip" download={`passarinho-${nova?.versao || "chrome"}.zip`}><Download className="h-4 w-4" /> Baixar para o Chrome</a>
            </Button>
            <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
              <li>Abra a pasta onde a Passarinho está instalada no computador (a mesma escolhida em "Carregar sem compactação").</li>
              <li>Extraia o arquivo baixado <b>dentro dessa pasta</b> e escolha <b>Substituir os arquivos</b>.</li>
              <li>Em até 1 minuto ela se atualiza sozinha. Se não, abra <b>chrome://extensions</b> e clique na setinha ↻ da Passarinho.</li>
              <li>Primeira instalação: extraia numa pasta nova, abra chrome://extensions, ligue o <b>Modo do desenvolvedor</b> e clique em <b>Carregar sem compactação</b> escolhendo essa pasta.</li>
            </ol>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
