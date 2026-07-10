import React, { useState, useEffect } from 'react';
import { purchaseRequestService } from '../lib/services';
import { PurchaseRequest } from '../types';
import { ShoppingCart, Search, Filter, Copy, CheckCircle2, Clock, MapPin, FileText, Check, CopyIcon, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';

export function PurchaseRequestsView() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewDetails, setViewDetails] = useState<PurchaseRequest | null>(null);

  useEffect(() => {
    const unsub = purchaseRequestService.subscribeToRequests(setRequests);
    return () => unsub();
  }, []);

  const handleStatusChange = async (id: string, obj: { status: PurchaseRequest['status'] }) => {
    await purchaseRequestService.updateRequest(id, obj);
    setViewDetails(null);
  };

  const filtered = requests.filter(r => {
    const spec = r.specification || '';
    const reqBy = r.requestedBy || '';
    const dep = r.department || '';

    const matchSearch = spec.toLowerCase().includes(searchTerm.toLowerCase()) || 
      reqBy.toLowerCase().includes(searchTerm.toLowerCase()) || 
      dep.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'quoting': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'approved': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'completed': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'pending': return 'Pendente';
      case 'quoting': return 'Em Cotação';
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Rejeitado';
      case 'completed': return 'Concluído';
      default: return status;
    }
  };

  const publicLink = `${window.location.origin}/?public=compras`;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tighter">Módulo de Compras</h2>
          <p className="text-ork-text-muted mt-1">Gestão de solicitações e orçamentos dos setores.</p>
        </div>
        
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-3 items-center gap-4">
          <div className="text-xs text-slate-400">
            Link Público para Pedidos:
          </div>
          <button 
             onClick={() => {
               navigator.clipboard.writeText(publicLink);
               alert("Link copiado!");
             }}
             title="Copiar Link"
             className="flex items-center gap-2 px-3 py-1.5 bg-ork-primary/10 text-ork-primary hover:bg-ork-primary/20 transition-colors rounded-lg text-xs font-bold uppercase tracking-wider"
          >
             <CopyIcon className="w-3 h-3" />
             Copiar Link
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            type="text"
            placeholder="Buscar por solicitante, setor ou item..."
            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white outline-none focus:border-ork-primary transition-colors"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {['all', 'pending', 'quoting', 'approved', 'completed'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status === 'all' ? 'all' : status)}
              className={cn(
                "px-4 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all border",
                statusFilter === status 
                  ? "bg-ork-primary text-white border-ork-primary" 
                  : "bg-slate-900/50 text-slate-400 border-slate-800 hover:bg-slate-800"
              )}
            >
              {status === 'all' ? 'Todas' : getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {filtered.map(req => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => setViewDetails(req)}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-ork-primary/50 transition-colors cursor-pointer group flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-ork-primary/10 transition-colors">
                    <ShoppingCart className="w-5 h-5 text-slate-400 group-hover:text-ork-primary transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold max-w-[200px] truncate">{req.specification}</h3>
                    <p className="text-xs text-slate-500">{req.department}</p>
                  </div>
                </div>
                <div className={cn("px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider border", getStatusColor(req.status))}>
                  {getStatusLabel(req.status)}
                </div>
              </div>

              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="w-5 flex justify-center text-slate-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
                  <span className="truncate">{req.requestedBy}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="w-5 flex justify-center text-slate-500"><Clock className="w-4 h-4" /></span>
                  <span>Criado: {formatDate(req.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="w-5 flex justify-center text-amber-500/50"><Calendar className="w-4 h-4" /></span>
                  <span className="text-amber-500/80 font-medium">Urgência: {formatDate(req.urgencyDate || '')}</span>
                </div>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              Nenhuma solicitação encontrada com estes filtros.
            </div>
          )}
        </AnimatePresence>
      </div>

      {viewDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-black text-white italic tracking-tight mb-2">
                    Detalhes da Compra
                  </h3>
                  <div className="flex gap-2">
                    <span className={cn("px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider border", getStatusColor(viewDetails.status))}>
                      {getStatusLabel(viewDetails.status)}
                    </span>
                    <span className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-[10px] font-black uppercase tracking-wider">
                      {formatDate(viewDetails.createdAt)}
                    </span>
                  </div>
                </div>
                <button onClick={() => setViewDetails(null)} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-800 space-y-1">
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Solicitante</p>
                  <p className="text-white font-medium">{viewDetails.requestedBy}</p>
                  <p className="text-sm text-slate-400">{viewDetails.department}</p>
                </div>
                
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-800 space-y-1">
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Prazo / Urgência</p>
                  <p className="text-white font-medium">{viewDetails.urgencyDate ? formatDate(viewDetails.urgencyDate) : 'Não informado'}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-3">Especificações</p>
                  <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-800">
                    <p className="text-white whitespace-pre-wrap font-medium">{viewDetails.specification}</p>
                  </div>
                </div>

                {viewDetails.notes && (
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-3">Observações</p>
                    <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-800">
                      <p className="text-white whitespace-pre-wrap text-sm">{viewDetails.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950/50">
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-4">Atualizar Status</p>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => handleStatusChange(viewDetails.id, { status: 'pending' })}
                  className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-colors", viewDetails.status === 'pending' ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-amber-500/20 hover:text-amber-500")}
                >
                  Pendente
                </button>
                <button 
                  onClick={() => handleStatusChange(viewDetails.id, { status: 'quoting' })}
                  className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-colors", viewDetails.status === 'quoting' ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-blue-500/20 hover:text-blue-500")}
                >
                  Em Cotação
                </button>
                <button 
                  onClick={() => handleStatusChange(viewDetails.id, { status: 'approved' })}
                  className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-colors", viewDetails.status === 'approved' ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-500")}
                >
                  Aprovado
                </button>
                <button 
                  onClick={() => handleStatusChange(viewDetails.id, { status: 'completed' })}
                  className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-colors", viewDetails.status === 'completed' ? "bg-slate-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white")}
                >
                  Concluído
                </button>
                <button 
                  onClick={() => handleStatusChange(viewDetails.id, { status: 'rejected' })}
                  className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-colors ml-auto", viewDetails.status === 'rejected' ? "bg-red-500 text-white" : "bg-slate-800 text-red-500 hover:bg-red-500/20 hover:text-red-500")}
                >
                  Rejeitado
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
