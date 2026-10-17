import { useCallback, useRef, useState } from "react";
import { ImageIcon, Trash2, Download, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
}

async function salvarPDFBlob(blob: Blob, filename: string): Promise<boolean> {
  if (typeof (window as any).showSaveFilePicker === "function") {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      toast.success("PDF salvo com sucesso!");
      return true;
    } catch (e: any) {
      if (e?.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast.success("PDF baixado!");
  return true;
}

export default function ImageToPdf() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [converting, setConverting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragOverRef = useRef<string | null>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type === "image/png" || f.type === "image/jpeg");
    if (!arr.length) return;
    const items: ImageItem[] = arr.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      name: f.name,
    }));
    setImages(prev => [...prev, ...items]);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const remove = (id: string) => {
    setImages(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    setImages(prev => {
      const idx = prev.findIndex(i => i.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const convert = async () => {
    if (!images.length) return;
    setConverting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210, H = 297;

      for (let i = 0; i < images.length; i++) {
        if (i > 0) doc.addPage();
        const img = images[i];
        await new Promise<void>((resolve, reject) => {
          const el = new Image();
          el.onload = () => {
            const ratio = Math.min(W / el.naturalWidth, H / el.naturalHeight);
            const w = el.naturalWidth * ratio;
            const h = el.naturalHeight * ratio;
            const x = (W - w) / 2;
            const y = (H - h) / 2;
            const fmt = img.file.type === "image/png" ? "PNG" : "JPEG";
            doc.addImage(el, fmt, x, y, w, h);
            resolve();
          };
          el.onerror = reject;
          el.src = img.previewUrl;
        });
      }

      const blob = doc.output("blob");
      await salvarPDFBlob(blob, "imagens.pdf");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao converter imagens.");
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Imagem para PDF</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Converta PNG ou JPG em um único PDF. Arraste para reordenar.</p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border/60 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
      >
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">Clique ou arraste imagens PNG / JPG aqui</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={e => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* List */}
      {images.length > 0 && (
        <div className="space-y-2">
          {images.map((img, idx) => (
            <div key={img.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-2 pr-3">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <img src={img.previewUrl} alt={img.name} className="h-12 w-12 object-cover rounded" />
              <span className="flex-1 text-xs truncate text-muted-foreground">{img.name}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => move(img.id, -1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === images.length - 1} onClick={() => move(img.id, 1)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(img.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <Button onClick={convert} disabled={converting} className="gap-2 w-full sm:w-auto">
          <Download className="h-4 w-4" />
          {converting ? "Convertendo…" : `Gerar PDF (${images.length} imagem${images.length > 1 ? "ns" : ""})`}
        </Button>
      )}
    </div>
  );
}
