import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";

interface EmprestimosChartProps {
  clientes: any[];
}

const COLORS = [
  "hsl(145, 65%, 42%)",
  "hsl(45, 90%, 50%)",
  "hsl(0, 70%, 55%)",
  "hsl(200, 70%, 50%)",
  "hsl(280, 60%, 55%)",
];

const EmprestimosChart = ({ clientes }: EmprestimosChartProps) => {
  const barData = clientes.slice(0, 8).map((c) => ({
    nome: c.nome?.length > 10 ? c.nome.substring(0, 10) + "..." : c.nome,
    capital: Number(c.valor),
    juros: Number(c.valor) * (Number(c.juros) / 100),
  }));

  const totalCapital = clientes.reduce((a, c) => a + Number(c.valor), 0);
  const totalJuros = clientes.reduce((a, c) => a + Number(c.valor) * (Number(c.juros) / 100), 0);

  const pieData = [
    { name: "Capital", value: totalCapital },
    { name: "Juros", value: totalJuros },
  ];

  if (clientes.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">📊 Empréstimos por Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum empréstimo cadastrado ainda.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">📊 Capital vs Juros por Cliente</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="nome" tick={{ fill: "hsl(220, 10%, 46%)", fontSize: 11 }} />
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
                <Bar dataKey="capital" fill="hsl(145, 65%, 42%)" name="Capital" radius={[4, 4, 0, 0]} />
                <Bar dataKey="juros" fill="hsl(45, 90%, 50%)" name="Juros" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">🥧 Distribuição Capital vs Juros</CardTitle>
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
                  formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, ""]}
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

export default EmprestimosChart;
