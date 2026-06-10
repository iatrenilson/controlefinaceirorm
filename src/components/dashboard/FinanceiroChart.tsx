import React from 'react';

interface FinanceiroChartProps {
  data?: any[]; // tornando opcional para este exemplo
}

export const FinanceiroChart: React.FC<FinanceiroChartProps> = ({ data }) => {
  return (
    <div className="p-4 border rounded-lg shadow-sm bg-white">
      <h3 className="text-lg font-semibold mb-4">Gráfico de Controle Mensal</h3>
      {/* Chart visualization here */}
      <div className="h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-sm rounded">
        Placeholder para o Gráfico Mensal
      </div>
    </div>
  );
};
