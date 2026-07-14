import React from 'react';
import { DollarSign, FileText, Download, TrendingDown, CreditCard, Activity } from 'lucide-react';

export default function FinancialPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Controle Financeiro</h1>
          <p className="text-slate-500 text-sm sm:text-base">Gestão de repasses, pagamentos e custos logísticos.</p>
        </div>
        <button className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors shadow-sm">
          <Download size={18} /> Exportar Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <div className="bg-gradient-to-br from-[var(--color-brand-cyan)] via-[var(--color-brand-blue)] to-[var(--color-brand-purple)] text-white p-6 sm:p-8 rounded-2xl shadow-md flex flex-col">
          <div className="text-white/80 text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider">
            <DollarSign size={18} /> Custo Total (Mês)
          </div>
          <div className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight">R$ 1.245.890</div>
          <div className="flex items-center text-sm font-medium text-emerald-300 bg-black/20 self-start px-3 py-1 rounded-lg backdrop-blur-sm mt-auto">
            <TrendingDown size={16} className="mr-1.5" /> 15% vs mês anterior
          </div>
        </div>
        
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="text-slate-500 text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider">
            <CreditCard size={18} className="text-slate-400" /> Repasses Pendentes
          </div>
          <div className="text-3xl sm:text-4xl font-bold text-slate-800 mb-2 tracking-tight">R$ 124.500</div>
          <div className="text-sm font-medium text-slate-500 mt-auto bg-slate-50 px-3 py-2 rounded-lg self-start">Para 184 entregadores</div>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:col-span-2 xl:col-span-1">
          <div className="text-slate-500 text-sm font-semibold mb-4 flex items-center gap-2 uppercase tracking-wider">
            <Activity size={18} className="text-slate-400" /> Custo Médio por Entrega
          </div>
          <div className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4 tracking-tight">R$ 7,90</div>
          <div className="flex items-center text-sm font-medium text-emerald-600 bg-emerald-50 self-start px-3 py-1 rounded-lg mt-auto">
            <TrendingDown size={16} className="mr-1.5" /> -R$ 0,45
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-[400px]">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-lg text-slate-800">Próximos Pagamentos</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-300 border-2 border-dashed border-slate-200 shadow-inner">
            <FileText size={32} />
          </div>
          <h4 className="text-slate-800 text-lg font-bold mb-2">Nenhum repasse urgente</h4>
          <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
            Todos os repasses para parceiros e autônomos desta semana já foram processados e faturados com sucesso.
          </p>
          <button className="mt-8 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm">
            Ver Histórico Completo
          </button>
        </div>
      </div>
    </div>
  );
}
