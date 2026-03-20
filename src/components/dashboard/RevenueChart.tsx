import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: "Jan", receitas: 4200, despesas: 2800 },
  { month: "Fev", receitas: 5100, despesas: 3200 },
  { month: "Mar", receitas: 4800, despesas: 2900 },
  { month: "Abr", receitas: 6300, despesas: 3500 },
  { month: "Mai", receitas: 5900, despesas: 3100 },
  { month: "Jun", receitas: 7200, despesas: 3800 },
  { month: "Jul", receitas: 6800, despesas: 3400 },
  { month: "Ago", receitas: 7500, despesas: 4000 },
  { month: "Set", receitas: 8100, despesas: 3700 },
  { month: "Out", receitas: 7900, despesas: 4200 },
  { month: "Nov", receitas: 8600, despesas: 4100 },
  { month: "Dez", receitas: 9200, despesas: 4500 },
];

const RevenueChart = () => {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Receitas vs Despesas</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="receitas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(145, 65%, 42%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(145, 65%, 42%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="despesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(260, 60%, 58%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(260, 60%, 58%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(220, 10%, 46%)", fontSize: 12 }} />
              <YAxis className="text-xs" tick={{ fill: "hsl(220, 10%, 46%)", fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(225, 22%, 11%)",
                  border: "1px solid hsl(225, 15%, 18%)",
                  borderRadius: "8px",
                  color: "hsl(210, 20%, 95%)",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, ""]}
              />
              <Area type="monotone" dataKey="receitas" stroke="hsl(145, 65%, 42%)" fillOpacity={1} fill="url(#receitas)" strokeWidth={2} name="Receitas" />
              <Area type="monotone" dataKey="despesas" stroke="hsl(260, 60%, 58%)" fillOpacity={1} fill="url(#despesas)" strokeWidth={2} name="Despesas" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueChart;
