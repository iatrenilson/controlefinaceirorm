import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinanceiroRecord {
  tipo: "receita" | "despesa";
  valor: number | string;
  data_vencimento: string;
}

interface FinanceiroChartProps {
  financeiro?: FinanceiroRecord[];
  data?: any[];
}

const fmt = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const FinanceiroChart: React.FC<FinanceiroChartProps> = ({ financeiro = [] }) => {
  const chartData = useMemo(() => {
    const map: Record<string, { mes: string; Receitas: number; Despesas: number }> = {};

    for (const r of financeiro) {
      if (!r.data_vencimento) continue;
      try {
        const key = r.data_vencimento.slice(0, 7);
        const label = format(parseISO(r.data_vencimento), "MMM/yy", { locale: ptBR });
        if (!map[key]) map[key] = { mes: label, Receitas: 0, Despesas: 0 };
        const val = Number(r.valor) || 0;
        if (r.tipo === "receita") map[key].Receitas += val;
        else map[key].Despesas += val;
      } catch {}
    }

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [financeiro]);

  if (chartData.length === 0) return null;

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Receitas vs Despesas por Mês</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" tick={{ fill: "hsl(220,10%,46%)", fontSize: 12 }} />
              <YAxis
                tick={{ fill: "hsl(220,10%,46%)", fontSize: 12 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(225,22%,11%)",
                  border: "1px solid hsl(225,15%,18%)",
                  borderRadius: "8px",
                  color: "hsl(210,20%,95%)",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [fmt(value), ""]}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="Receitas" fill="hsl(145,65%,42%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinanceiroChart;
