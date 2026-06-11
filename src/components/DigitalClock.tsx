import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "clock_override";

function loadOverride(): { date: string; time: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

const DigitalClock = () => {
  const [now, setNow] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [override, setOverride] = useState<{ date: string; time: string } | null>(loadOverride);
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("");

  // Tick automático apenas quando sem override
  useEffect(() => {
    if (override) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [override]);

  // Inicializa os campos draft quando o popover abre
  useEffect(() => {
    if (!open) return;
    if (override) {
      setDraftDate(override.date);
      setDraftTime(override.time);
    } else {
      const n = new Date();
      setDraftDate(n.toISOString().slice(0, 10));
      const h = n.getHours().toString().padStart(2, "0");
      const m = n.getMinutes().toString().padStart(2, "0");
      setDraftTime(`${h}:${m}`);
    }
  }, [open]);

  // Valores exibidos
  let displayDate: string;
  let displayTime: string;
  if (override) {
    const [y, mo, d] = override.date.split("-");
    displayDate = `${d}/${mo}/${y}`;
    displayTime = override.time;
  } else {
    displayDate = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const h = now.getHours().toString().padStart(2, "0");
    const m = now.getMinutes().toString().padStart(2, "0");
    displayTime = `${h}:${m}`;
  }

  function salvarManual() {
    if (!draftDate || !draftTime) return;
    const val = { date: draftDate, time: draftTime };
    setOverride(val);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
    setOpen(false);
  }

  function ativarAutomatico() {
    setOverride(null);
    localStorage.removeItem(STORAGE_KEY);
    setNow(new Date());
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono hover:opacity-80 transition-opacity cursor-pointer">
          <Clock className="h-3.5 w-3.5 hidden sm:block" />
          <span>{displayDate}</span>
          <span className={`font-semibold ${override ? "text-amber-400" : "text-primary"}`}>
            {displayTime}
          </span>
          {override && <span className="text-amber-400 text-[8px] leading-none">●</span>}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-60 p-4" align="end">
        <p className="text-sm font-semibold mb-3">Configurar Relógio</p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block text-muted-foreground">Data</Label>
            <Input
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block text-muted-foreground">Hora</Label>
            <Input
              type="time"
              value={draftTime}
              onChange={(e) => setDraftTime(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={salvarManual}
              disabled={!draftDate || !draftTime}
            >
              Salvar Manual
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={ativarAutomatico}
            >
              Automático
            </Button>
          </div>
          {override && (
            <p className="text-[10px] text-amber-400 text-center">
              ● Modo manual ativo
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DigitalClock;
