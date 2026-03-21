import { Link } from 'react-router-dom';

export default function Dashboard() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Visão Geral</h1>
      <section className="mt-6">
        <h2 className="text-xl font-semibold">Controle Mensal</h2>
        <p>Gerencie suas despesas e receitas mensais.</p>
        <Link to="/mensal" className="text-blue-600 hover:underline">Acessar Controle Mensal</Link>
      </section>

      {/* Selector example */}
      <select className="mt-4 p-2 border rounded">
        <option>Opção 1</option>
        <option>Controle Mensal</option>
        <option>Outra Opção</option>
      </select>

      {/* Footer example */}
      <footer className="mt-8 text-center text-gray-500 text-sm">
        © 2023 Meu App. Todos os direitos reservados. Controle Mensal.
      </footer>
    </div>
  );
}