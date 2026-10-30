import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Arquivo do computador sendo arrastado (não um item da própria página sendo reordenado)
export const arrastandoArquivo = (e: { dataTransfer: DataTransfer | null }) =>
  !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");

// Arquivo solto fora de uma área que recebe arquivos: o navegador abriria o arquivo no lugar do site e o que estava
// preenchido seria perdido. As áreas de arrastar tratam o arquivo antes (e marcam o evento), então não passam por aqui.
export function protegerContraArquivoSolto() {
  const fora = (e: DragEvent) => {
    if (e.defaultPrevented || !arrastandoArquivo(e)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "none";
  };
  window.addEventListener("dragover", fora);
  window.addEventListener("drop", fora);
}

// Confere o arquivo contra o "accept" de um <input type="file"> (".pdf", "image/*", "application/pdf"...)
export function arquivoAceito(f: File, aceitar?: string) {
  if (!aceitar) return true;
  const nome = f.name.toLowerCase(), tipo = (f.type || "").toLowerCase();
  return aceitar.split(",").map(s => s.trim().toLowerCase()).filter(Boolean).some(a =>
    a.startsWith(".") ? nome.endsWith(a) : a.endsWith("/*") ? tipo.startsWith(a.slice(0, -1)) : tipo === a);
}

// Área que também recebe arquivo arrastado do computador. Com onArquivos, entrega os arquivos soltos; sem ele, passa o
// arquivo para o <input type="file"> de dentro da área como se tivesse sido escolhido pelo clique (o onChange dele faz o
// resto). Itens da página sendo arrastados para reordenar não são afetados.
export function ArrastarArquivo({ children, onArquivos, aceitar, varios, desativado, className }: {
  children: ReactNode;
  onArquivos?: (arquivos: File[]) => void;
  aceitar?: string;      // sem onArquivos, vale o accept do input
  varios?: boolean;      // sem onArquivos, vale o multiple do input
  desativado?: boolean;  // enviando: não aceita outro arquivo
  className?: string;
}) {
  const [arrastando, setArrastando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const soltar = (e: React.DragEvent) => {
    if (!arrastandoArquivo(e)) return;
    e.preventDefault(); e.stopPropagation(); setArrastando(false);
    if (desativado) return;
    const input = onArquivos ? null : ref.current?.querySelector<HTMLInputElement>('input[type="file"]') ?? null;
    if (!onArquivos && !input) return;
    const todos = Array.from(e.dataTransfer.files);
    const aceitos = todos.filter(f => arquivoAceito(f, aceitar ?? input?.accept));
    if (!aceitos.length) { if (todos.length) toast.error("Arquivo não aceito aqui: arraste um PDF ou uma foto."); return; }
    const escolhidos = (varios ?? input?.multiple) ? aceitos : aceitos.slice(0, 1);
    if (onArquivos) { onArquivos(escolhidos); return; }
    const dt = new DataTransfer();
    escolhidos.forEach(f => dt.items.add(f));
    input!.files = dt.files;
    input!.dispatchEvent(new Event("change", { bubbles: true }));
  };
  return (
    <div ref={ref} className={cn("relative", className)}
      onDragOver={e => {
        if (!arrastandoArquivo(e)) return;
        e.preventDefault(); e.stopPropagation();
        e.dataTransfer.dropEffect = desativado ? "none" : "copy";
        if (!arrastando && !desativado) setArrastando(true);
      }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false); }}
      onDrop={soltar}>
      {children}
      {arrastando && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-primary bg-primary/20">
          <span className="rounded-md bg-background/90 px-2 py-0.5 text-xs font-semibold text-primary">Solte o arquivo aqui</span>
        </div>
      )}
    </div>
  );
}
