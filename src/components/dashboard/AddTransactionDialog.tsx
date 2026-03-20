import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { Transaction, incomeCategories, expenseCategories } from "@/lib/transactions";

interface AddTransactionDialogProps {
  onAdd: (t: Transaction) => void;
}

const AddTransactionDialog = ({ onAdd }: AddTransactionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("income");
  const [desc, setDesc] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const categories = type === "income" ? incomeCategories : expenseCategories;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc || !value || !category || !date) return;

    const numValue = parseFloat(value);
    const [y, m, d] = date.split("-");
    const formattedDate = `${d}/${m}/${y}`;

    onAdd({
      id: Date.now(),
      desc,
      category: type === "income" ? "Receita" : category,
      date: formattedDate,
      value: type === "income" ? numValue : -numValue,
      type,
    });

    setDesc("");
    setValue("");
    setCategory("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>
        <Tabs value={type} onValueChange={(v) => { setType(v as "income" | "expense"); setCategory(""); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="income" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Receita
            </TabsTrigger>
            <TabsTrigger value="expense" className="gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" /> Despesa
            </TabsTrigger>
          </TabsList>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input placeholder="Ex: Salário, Aluguel..." value={desc} onChange={(e) => setDesc(e.target.value.toUpperCase())} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">
              Adicionar {type === "income" ? "Receita" : "Despesa"}
            </Button>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddTransactionDialog;
