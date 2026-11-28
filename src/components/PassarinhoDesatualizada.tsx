import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

// Passarinho desatualizada no Chrome (2026-11-27, o usuário pediu): o Chrome não deixa extensão fora da loja se
// atualizar sozinha. A ponte da extensão (site-ponte.js) põe a versão instalada em <html data-passarinho>; a versão
// nova é a de /passarinho/updates.json (a mesma do Firefox, publicada por publicar-firefox.mjs, que também gera o
// passarinho-chrome.zip). Firefox se atualiza sozinho pelo updates.json, então a faixa é só para o Chrome.
const maior = (a: string, b: string) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
};

export default function PassarinhoDesatualizada() {
  const [versoes, setVersoes] = useState<{ instalada: string; nova: string } | null>(null);
  const [comoFazer, setComoFazer] = useState(false);
  const [fechada, setFechada] = useState(false);

  useEffect(() => {
    if (/Firefox\//.test(navigator.userAgent)) return;
    let parar = false;
    const conferir = async () => {
      const instalada = document.documentElement.dataset.passarinho;
      if (!instalada) { setVersoes(null); return; }
      try {
        const r = await fetch("/passarinho/updates.json", { cache: "no-store" });
        const j = await r.json();
        const lista = Object.values(j?.addons ?? {})[0] as { updates?: { version: string }[] } | undefined;
        const nova = lista?.updates?.map(u => u.version).sort((a, b) => (maior(a, b) ? -1 : 1))[0];
        if (!parar) setVersoes(nova && maior(nova, instalada) ? { instalada, nova } : null);
      } catch { /* sem internet ou arquivo fora do ar: tenta de novo depois */ }
    };
    const t = setTimeout(conferir, 3000);
    const i = setInterval(conferir, 30000); // depois de atualizar, a faixa some sozinha
    return () => { parar = true; clearTimeout(t); clearInterval(i); };
  }, []);

  if (!versoes || fechada) return null;
  return (
    <div className="border-b border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 min-w-[12rem]">
          🐦 <b>Sua Passarinho está desatualizada</b> (versão {versoes.instalada}). A nova é a <b>{versoes.nova}</b>.
        </span>
        <a href="/passarinho/passarinho-chrome.zip" download={`passarinho-${versoes.nova}.zip`} onClick={() => setComoFazer(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400">
          <Download className="h-3.5 w-3.5" /> Baixar atualização
        </a>
        <button className="text-xs underline text-amber-200" onClick={() => setComoFazer(v => !v)}>
          {comoFazer ? "Esconder" : "Como instalar"}
        </button>
        <button className="text-muted-foreground hover:text-foreground" title="Fechar por agora" onClick={() => setFechada(true)}>
          <X className="h-4 w-4" />
        </button>
      </div>
      {comoFazer && (
        <ol className="mt-2 ml-5 list-decimal space-y-1 text-xs text-amber-100/90">
          <li>Clique em <b>Baixar atualização</b>.</li>
          <li>Abra a pasta onde a Passarinho está instalada no computador (a mesma que foi escolhida em "Carregar sem compactação").</li>
          <li>Extraia o arquivo baixado <b>dentro dessa pasta</b> e escolha <b>Substituir os arquivos</b>.</li>
          <li>Em até 1 minuto a Passarinho se atualiza sozinha e esta faixa some. Se não sumir, abra <b>chrome://extensions</b>, clique na setinha ↻ da Passarinho e aperte F5 aqui.</li>
        </ol>
      )}
    </div>
  );
}
