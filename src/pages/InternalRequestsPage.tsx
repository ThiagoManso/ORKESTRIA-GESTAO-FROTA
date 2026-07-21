import React, { useState, useEffect } from 'react';
import { Package, MapPin, FileText, Send, CheckCircle, Calendar, Plus, Clock, Check, Copy } from 'lucide-react';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ExternalRequest, SystemUser } from '../types';
import FleetAvailabilityPanel from '../components/FleetAvailabilityPanel';

interface InternalRequestsPageProps {
  currentUser: SystemUser;
}

export default function InternalRequestsPage({ currentUser }: InternalRequestsPageProps) {
  const [requests, setRequests] = useState<ExternalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Form state
  const [type, setType] = useState<'coleta' | 'entrega'>('coleta');
  const [address, setAddress] = useState('');
  const [observations, setObservations] = useState('');
  const [reference, setReference] = useState(''); // OS or Order number
  const [contactPhone, setContactPhone] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');

  // Fetch user's requests
  useEffect(() => {
    if (!currentUser || !currentUser.id) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'external_requests'),
      where('userId', '==', currentUser.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRequests: ExternalRequest[] = [];
      snapshot.forEach((doc) => {
        fetchedRequests.push({ id: doc.id, ...doc.data() } as ExternalRequest);
      });
      
      // Sort newest first
      fetchedRequests.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA; // Descending
      });

      setRequests(fetchedRequests);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching requests: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const resetForm = () => {
    setType('coleta');
    setAddress('');
    setObservations('');
    setReference('');
    setContactPhone('');
    setScheduledDate('');
    setIsSubmitted(false);
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference || !address || !scheduledDate) {
      alert("Por favor, preencha os campos obrigatórios.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newRequest = {
        type,
        address,
        observations,
        osNumber: type === 'coleta' ? reference : '',
        orderNumber: type === 'entrega' ? reference : '',
        contactPhone,
        scheduledDate,
        requesterName: currentUser.name,
        userId: currentUser.id,
        status: 'pending',
        read: false,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'external_requests'), newRequest);
      setIsSubmitted(true);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Houve um erro ao enviar sua solicitação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyWhatsApp = () => {
    const formattedDate = scheduledDate.split('-').reverse().join('/');
    const text = `*NOVO CHAMADO DE LOGÍSTICA* 🚛\n*Tipo:* ${type === 'coleta' ? 'Coleta' : 'Entrega'}\n*Referência:* ${reference}\n*Solicitante:* ${currentUser.name}\n*Telefone:* ${contactPhone || 'Não informado'}\n*Data Agendada:* ${formattedDate}\n*Endereço:* ${address}\n*Observações:* ${observations || 'Nenhuma'}`;
    
    navigator.clipboard.writeText(text);
    alert('Texto copiado com sucesso! Agora é só colar no WhatsApp.');
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  const formatScheduledDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    if (dateStr.includes('-')) {
      return dateStr.split('-').reverse().join('/');
    }
    return dateStr;
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Meus Chamados</h1>
          <p className="text-slate-500 mt-1">Acompanhe suas solicitações de logística.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-cyan hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus size={20} />
          Novo Chamado
        </button>
      </div>

      <FleetAvailabilityPanel targetDateStr={new Date().toLocaleDateString('pt-BR')} />

      {/* Tabela e Cards Responsivos */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Visualização Desktop (Tabela) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6">Criado em</th>
                <th className="py-4 px-6">Tipo</th>
                <th className="py-4 px-6">Referência</th>
                <th className="py-4 px-6">Endereço</th>
                <th className="py-4 px-6">Agendado para</th>
                <th className="py-4 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">Carregando seus chamados...</td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Package size={48} className="text-slate-300 mb-4 mx-auto" />
                    <p className="text-lg font-medium text-slate-600">Nenhum chamado encontrado</p>
                    <p className="text-sm">Você ainda não fez nenhuma solicitação.</p>
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 text-slate-600">{formatDate(req.createdAt)}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                        {req.type === 'coleta' ? <Package size={14} /> : <MapPin size={14} />}
                        {req.type}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-700">
                      {req.type === 'coleta' ? req.osNumber : req.orderNumber}
                    </td>
                    <td className="py-4 px-6 text-slate-600 max-w-xs truncate" title={req.address}>
                      {req.address}
                    </td>
                    <td className="py-4 px-6 text-slate-600">
                      {formatScheduledDate(req.scheduledDate)}
                    </td>
                    <td className="py-4 px-6">
                      {req.status === 'completed' && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><Check size={14} /> Concluído</span>}
                      {req.status === 'on_route' && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Clock size={14} /> Em Rota</span>}
                      {(req.status === 'pending' || !req.status) && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Clock size={14} /> Pendente</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Visualização Mobile (Cards) */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-8 text-center text-slate-500">Carregando seus chamados...</div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Package size={48} className="text-slate-300 mb-4 mx-auto" />
              <p className="text-lg font-medium text-slate-600">Nenhum chamado encontrado</p>
              <p className="text-sm">Você ainda não fez nenhuma solicitação.</p>
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize mb-1.5">
                      {req.type === 'coleta' ? <Package size={12} /> : <MapPin size={12} />}
                      {req.type}
                    </span>
                    <div className="font-bold text-slate-800">{req.type === 'coleta' ? req.osNumber : req.orderNumber}</div>
                  </div>
                  <div>
                    {req.status === 'completed' && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-emerald-100 text-emerald-700"><Check size={12} /> Concluído</span>}
                    {req.status === 'on_route' && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-blue-100 text-blue-700"><Clock size={12} /> Em Rota</span>}
                    {(req.status === 'pending' || !req.status) && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-amber-100 text-amber-700"><Clock size={12} /> Pendente</span>}
                  </div>
                </div>
                
                <div className="text-sm text-slate-600 line-clamp-2">
                  <MapPin size={14} className="inline mr-1 text-slate-400" />
                  {req.address}
                </div>
                
                <div className="flex justify-between items-center text-xs text-slate-500 mt-1 pt-2 border-t border-slate-50">
                  <div>Criado: {formatDate(req.createdAt)}</div>
                  <div className="font-medium text-slate-700">Para: {formatScheduledDate(req.scheduledDate)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Novo Chamado */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
            {isSubmitted ? (
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={40} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Solicitação Enviada!</h2>
                <p className="text-slate-600 mb-8">Sua solicitação foi registrada com sucesso no sistema.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button onClick={handleCopyWhatsApp} className="flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold rounded-xl transition-colors w-full sm:w-auto shadow-sm">
                    <Copy size={20} /> Copiar WhatsApp
                  </button>
                  <button onClick={resetForm} className="flex items-center justify-center px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors w-full sm:w-auto">
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-cyan/10 text-brand-cyan rounded-lg">
                      <Package size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Novo Chamado</h2>
                  </div>
                  <button onClick={resetForm} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Seleção de Tipo */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">O que você precisa?</label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center text-center transition-all ${type === 'coleta' ? 'border-brand-cyan bg-cyan-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input type="radio" className="sr-only" checked={type === 'coleta'} onChange={() => setType('coleta')} />
                        <Package size={24} className={type === 'coleta' ? 'text-brand-cyan mb-2' : 'text-slate-400 mb-2'} />
                        <span className={`font-semibold ${type === 'coleta' ? 'text-brand-cyan' : 'text-slate-600'}`}>Preciso de Coleta</span>
                      </label>
                      <label className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center text-center transition-all ${type === 'entrega' ? 'border-brand-cyan bg-cyan-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input type="radio" className="sr-only" checked={type === 'entrega'} onChange={() => setType('entrega')} />
                        <MapPin size={24} className={type === 'entrega' ? 'text-brand-cyan mb-2' : 'text-slate-400 mb-2'} />
                        <span className={`font-semibold ${type === 'entrega' ? 'text-brand-cyan' : 'text-slate-600'}`}>Preciso de Entrega</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        {type === 'coleta' ? 'OS / NF do material' : 'Número do Pedido'} <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" required value={reference} onChange={(e) => setReference(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                        placeholder="Ex: 12345"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data Agendada <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3.5 text-slate-400" size={18} />
                        <input 
                          type="date" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Endereço Completo <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3.5 text-slate-400" size={18} />
                      <input 
                        type="text" required value={address} onChange={(e) => setAddress(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                        placeholder="Rua, Número, Bairro, Cidade"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telefone para Contato</label>
                    <input 
                      type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Observações Adicionais</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3.5 text-slate-400" size={18} />
                      <textarea 
                        rows={2} value={observations} onChange={(e) => setObservations(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan resize-none"
                        placeholder="Instruções para o entregador..."
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button type="button" onClick={resetForm} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-cyan hover:bg-cyan-600 text-white font-bold rounded-xl transition-colors disabled:opacity-70">
                      {isSubmitting ? 'Enviando...' : <><Send size={18} /> Enviar Chamado</>}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
