import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Transaction } from "@/lib/transactions";

interface TransactionsTableProps {
  transactions: Transaction[];
}

const TransactionsTable = ({ transactions }: TransactionsTableProps) => {
  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Transações Recentes</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id} className="group">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className={`rounded-lg p-1.5 ${t.type === "income" ? "bg-success/10" : "bg-destructive/10"}`}>
                      {t.type === "income" ? (
                        <ArrowDownLeft className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                    {t.desc}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">{t.category}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{t.date}</TableCell>
                <TableCell className={`text-right font-mono font-medium ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                  {t.type === "income" ? "+" : ""}R$ {Math.abs(t.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default TransactionsTable;
