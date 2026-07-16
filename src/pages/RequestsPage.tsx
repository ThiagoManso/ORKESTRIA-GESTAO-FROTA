import React, { useState } from 'react';
import { useCollection } from '../lib/useCollection';
import { ExternalRequest } from '../types';
import { Package, MapPin, CheckCircle, Clock, Search, Trash2 } from 'lucide-react';

export default function RequestsPage() {
  const { data: requests, update, remove, loading } = useCollection<ExternalRequest>('external_requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'converted'>('all');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-cyan"></div>
      </div>
    );
  }

  const filteredRequests = requests?.filter(req => {
    const matchesSearch = 
      req.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.osNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;

    return matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleMarkConverted = async (id: string) => {
    await update(id, { status: 'converted' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta solicitação?')) {
      await remove(id);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Solicitações de Clientes</h1>
          <p className="text-slate-500">Gerencie as coletas e entregas solicitadas via link público.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por endereço, nome ou pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none shadow-sm font-medium text-slate-700"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendentes</option>
              <option value="converted">Convertidos em Rota</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50/50">
          {filteredRequests?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <Package size={48} className="text-slate-300" />
              <p className="text-lg font-medium text-slate-500">Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRequests?.map(request => (
                <div key={request.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${request.type === 'coleta' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {request.type === 'coleta' ? <Package size={20} /> : <MapPin size={20} />}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 capitalize">{request.type}</span>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock size={12} />
                          {new Date(request.createdAt).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      request.status === 'pending' 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {request.status === 'pending' ? 'Pendente' : 'Na Rota'}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 text-sm">
                    <div>
                      <span className="text-slate-400 block text-xs">Endereço:</span>
                      <span className="font-medium text-slate-700">{request.address}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400 block text-xs">Nº Pedido/OS:</span>
                        <span className="font-medium text-slate-700">{request.orderNumber || request.osNumber || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-xs">Telefone:</span>
                        <span className="font-medium text-slate-700">{request.contactPhone || '-'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-xs">Solicitante:</span>
                      <span className="font-medium text-slate-700">{request.requesterName || '-'}</span>
                    </div>
                    {request.observations && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-slate-400 block text-xs">Observações:</span>
                        <span className="text-slate-600 italic">{request.observations}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex gap-2">
                    {request.status === 'pending' && (
                      <button 
                        onClick={() => handleMarkConverted(request.id)}
                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                        title="Marcar manualmente como resolvido"
                      >
                        <CheckCircle size={16} /> Resolvido
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(request.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
