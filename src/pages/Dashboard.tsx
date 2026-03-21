import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function Dashboard() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 lg:px-6 h-14 flex items-center justify-between shadow-sm bg-background">
        <Link to="#" className="flex items-center justify-center" prefetch={false}>
          <CreditCardIcon className="h-6 w-6" />
          <span className="sr-only">Controle Financeiro</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link to="/dashboard" className="text-sm font-medium hover:underline underline-offset-4" prefetch={false}>
            Dashboard
          </Link>
          <Link to="/financeiro" className="text-sm font-medium hover:underline underline-offset-4" prefetch={false}>
            Controle Financeiro
          </Link>
        </nav>
        <div className="ml-4">
          <ModeToggle />
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <section className="w-full max-w-6xl mx-auto py-8">
          <h1 className="text-3xl font-bold mb-6">Bem-vindo ao Controle Financeiro</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Balanço Total</CardTitle>
                <CardDescription>Seu balanço geral atual.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">R$ 10.500,00</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Receitas do Mês</CardTitle>
                <CardDescription>Total de receitas neste mês.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">R$ 3.200,00</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Despesas do Mês</CardTitle>
                <CardDescription>Total de despesas neste mês.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">R$ 1.800,00</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Transações Recentes</CardTitle>
                <CardDescription>Suas últimas transações.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex justify-between items-center">
                    <span>Salário</span>
                    <span className="text-green-600">+ R$ 3.000,00</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span>Aluguel</span>
                    <span className="text-red-600">- R$ 1.500,00</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span>Supermercado</span>
                    <span className="text-red-600">- R$ 300,00</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Link to="/financeiro" className="text-sm font-medium text-primary hover:underline" prefetch={false}>
                  Ver todas as transações
                </Link>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Adicionar Nova Transação</CardTitle>
                <CardDescription>Registre uma nova receita ou despesa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Descrição" />
                <Input type="number" placeholder="Valor" />
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Tipo de Transação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button className="w-full">Adicionar Transação</Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t bg-background">
        <p className="text-xs text-gray-500 dark:text-gray-400">&copy; 2024 Controle Financeiro. Todos os direitos reservados.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link to="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Termos de Serviço
          </Link>
          <Link to="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Privacidade
          </Link>
        </nav>
      </footer>
    </div>
  );
}

function CreditCardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}