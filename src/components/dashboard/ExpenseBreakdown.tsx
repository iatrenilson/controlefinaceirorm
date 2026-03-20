import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const categories = [
  { name: "Moradia", value: 2800, total: 9200, color: "bg-primary" },
  { name: "Alimentação", value: 1500, total: 9200, color: "bg-accent" },
  { name: "Transporte", value: 950, total: 9200, color: "bg-warning" },
  { name: "Lazer", value: 720, total: 9200, color: "bg-destructive" },
  { name: "Saúde", value: 580, total: 9200, color: "bg-success" },
  { name: "Outros", value: 2650, total: 9200, color: "bg-muted-foreground" },
];

const ExpenseBreakdown = () => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Despesas por Categoria</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {categories.map((cat) => {
          const pct = Math.round((cat.value / cat.total) * 100);
          return (
            <div key={cat.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{cat.name}</span>
                <span className="font-mono text-muted-foreground">
                  R$ {cat.value.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${cat.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ExpenseBreakdown;
