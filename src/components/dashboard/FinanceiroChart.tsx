import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinanceiroChartProps {
  financeiro: any[];
}

const COLORS = [
  "hsl(145, 65%, 42%)",
  "hsl(0, 70%, 55%)",
  "hsl(45, 90%, 50%)",
  "hsl(200, 70%, 50%)",
];

const FinanceiroChart = ({ financeiro }: FinanceiroChartProps) => {
  // Group by month
  const monthlyData: Record<string, { receitas: number; despesas: number }> = {};
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  financeiro.forEach((f) => {
    const date = parseISO(f.data_vencimento);
    const monthIdx = date.getMonth();
    const key = months[monthIdx];
    if (!monthlyData[key]) monthlyData[key] = { receitas: 0, despesas: 0 };
    if (f.tipo === "receita") monthlyData[key].receitas += Number(f.valor);
    else monthlyData[key].despesas += Number(f.valor);
  });

  const barData = months.map((m) => ({
    month: m,
    receitas: monthlyData[m]?.receitas || 0,
    despesas: monthlyData[m]?.despesas || 0,
  }));

  // Status distribution
  const statusCounts = financeiro.reduce(
    (acc, f) => {
      if (f.status === "paga") acc.pagas += 1;
      else acc.emAberto += 1;
      return acc;
    },
    { pagas: 0, emAberto: 0 }
  );

  const pieData = [
    { name: "Pagas", value: statusCounts.pagas },
    { name: "Em Aberto", value: statusCounts.emAberto },
  ].filter((d) => d.value > 0);

  if (financeiro.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">📊 Controle Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhuma transação financeira cadastrada ainda.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">📊 Receitas vs Despesas por Mês</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fill: "hsl(220, 10%, 46%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(220, 10%, 46%)", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(225, 22%, 11%)",
                    border: "1px solid hsl(225, 15%, 18%)",
                    borderRadius: "8px",
                    color: "hsl(210, 20%, 95%)",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, ""]}
                />
                <Legend />
                <Bar dataKey="receitas" fill="hsl(145, 65%, 42%)" name="Receitas" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" fill="hsl(0, 70%, 55%)" name="Despesas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">🥧 Status das Contas</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(225, 22%, 11%)",
                    border: "1px solid hsl(225, 15%, 18%)",
                    borderRadius: "8px",
                    color: "hsl(210, 20%, 95%)",
                    fontSize: "12px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceiroChart;
