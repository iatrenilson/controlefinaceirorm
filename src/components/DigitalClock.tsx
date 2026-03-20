import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

const DigitalClock = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const date = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono">
      <Clock className="h-3.5 w-3.5 hidden sm:block" />
      <span>{date}</span>
      <span className="text-primary font-semibold">{time}</span>
    </div>
  );
};

export default DigitalClock;
