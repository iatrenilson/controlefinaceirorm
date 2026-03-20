export interface Transaction {
  id: number;
  desc: string;
  category: string;
  date: string;
  value: number;
  type: "income" | "expense";
}

export const initialTransactions: Transaction[] = [
  { id: 1, desc: "Salário", category: "Receita", date: "01/02/2026", value: 8500, type: "income" },
  { id: 2, desc: "Aluguel", category: "Moradia", date: "05/02/2026", value: -2800, type: "expense" },
  { id: 3, desc: "Supermercado", category: "Alimentação", date: "08/02/2026", value: -620, type: "expense" },
  { id: 4, desc: "Freelance Design", category: "Receita", date: "10/02/2026", value: 2200, type: "income" },
  { id: 5, desc: "Uber", category: "Transporte", date: "12/02/2026", value: -85, type: "expense" },
  { id: 6, desc: "Netflix", category: "Lazer", date: "15/02/2026", value: -55.9, type: "expense" },
  { id: 7, desc: "Farmácia", category: "Saúde", date: "18/02/2026", value: -120, type: "expense" },
  { id: 8, desc: "Dividendos", category: "Receita", date: "20/02/2026", value: 450, type: "income" },
];

export const incomeCategories = ["Salário", "Freelance", "Investimentos", "Outros"];
export const expenseCategories = ["Moradia", "Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Outros"];
