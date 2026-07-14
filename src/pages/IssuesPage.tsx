import React from 'react';
import { AlertCircle, MessageSquare, Paperclip, Clock, ShieldAlert } from 'lucide-react';

export default function IssuesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Acareação Digital</h1>
          <p className="text-slate-500 text-sm sm:text-base">Resolução de problemas, extravios e contestações.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto">
          <button className="flex-1 sm:flex-none px-6 py-2 bg-white text-slate-800 font-bold rounded-lg shadow-sm text-sm transition-all">Abertas (12)</button>
          <button className="flex-1 sm:flex-none px-6 py-2 text-slate-500 font-medium rounded-lg text-sm hover:text-slate-700 transition-all">Resolvidas</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 flex-1 min-h-[600px]">
        {/* Ticket List */}
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm h-[400px] lg:h-auto xl:col-span-1">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert size={18} className="text-amber-500" /> Tickets de Acareação
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/30">
            {[
              { id: '#437421', type: 'Extravio Parcial', status: 'Aberto', time: 'Há 2 horas', active: true },
              { id: '#437420', type: 'Cliente não reconhece entrega', status: 'Em análise', time: 'Há 5 horas', active: false },
              { id: '#437398', type: 'Avaria na embalagem', status: 'Aguardando doc', time: '1 dia atrás', active: false },
              { id: '#437350', type: 'Endereço não localizado', status: 'Em análise', time: '1 dia atrás', active: false },
            ].map(ticket => (
              <div 
                key={ticket.id} 
                className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${ticket.active ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-white hover:border-slate-200 hover:shadow-sm shadow-sm border border-slate-100'}`}
              >
                <div className="flex justify-between items-start mb-2.5">
                  <span className="font-mono text-sm font-bold text-slate-800">{ticket.id}</span>
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1"><Clock size={14}/>{ticket.time}</span>
                </div>
                <div className="text-sm text-slate-700 font-semibold mb-3 leading-snug">{ticket.type}</div>
                <div className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100/50">
                  {ticket.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ticket Detail */}
        <div className="lg:col-span-2 xl:col-span-3 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm flex-1">
          <div className="p-5 sm:p-6 border-b border-slate-200 bg-white">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Ticket #437421 - Extravio Parcial</h2>
                <p className="text-slate-500 text-sm flex items-center gap-2 flex-wrap">
                  Rota: <span className="font-mono text-primary font-bold cursor-pointer hover:underline bg-primary/5 px-2 py-0.5 rounded">#1824490002</span>
                  <span className="text-slate-300">•</span> 
                  Entregador: <span className="font-medium text-slate-700">Edvaldo N.</span>
                </p>
              </div>
              <button className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm">
                Resolver Acareação
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-xl text-sm border border-slate-100">
              <div>
                <span className="text-slate-500 block mb-1.5 font-semibold text-xs uppercase tracking-wider">Problema alegado</span>
                <span className="font-bold text-slate-800 text-base">Faltando 1 volume na entrega.</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1.5 font-semibold text-xs uppercase tracking-wider">Comprovações</span>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-100"><AlertCircle size={16}/> GPS OK</span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-100"><AlertCircle size={16}/> Assinatura</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 p-5 sm:p-6 overflow-y-auto bg-slate-50/50 flex flex-col gap-6">
            {/* Chat/History Area */}
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary font-bold text-sm border border-primary/20">CS</div>
              <div className="bg-white p-5 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex-1 max-w-3xl">
                <div className="text-xs font-semibold text-slate-400 mb-3">Suporte (Você) • 10:24</div>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">Acareação aberta. Solicitado ao entregador que retorne ao local ou justifique a falta do volume 2/2.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-600 font-bold text-sm border border-slate-300">EN</div>
              <div className="bg-white p-5 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex-1 max-w-3xl">
                <div className="text-xs font-semibold text-slate-400 mb-3">Edvaldo (Entregador) • 11:05</div>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">O volume 2 não foi carregado no hub. Tenho foto do romaneio e do veículo fechado antes de sair.</p>
                <div className="mt-4 flex gap-2">
                  <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-sm">
                    <Paperclip size={16} className="text-slate-400" /> foto_romaneio.jpg
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex gap-3">
            <input 
              type="text" 
              placeholder="Digite uma mensagem para o entregador..." 
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
            />
            <button className="px-5 py-3 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm">
              <MessageSquare size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
