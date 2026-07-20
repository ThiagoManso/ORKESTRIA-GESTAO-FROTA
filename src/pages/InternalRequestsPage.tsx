import React, { useState } from 'react';
import { Package, MapPin, FileText, Send, CheckCircle, Calendar, Plus, Clock, Check } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { collection, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCollection } from '../lib/useCollection';
import { ExternalRequest, SystemUser } from '../types';

interface InternalRequestsPageProps {
  currentUser: SystemUser;
}

export default function InternalRequestsPage({ currentUser }: InternalRequestsPageProps) {
  const geocodingLibrary = useMapsLibrary('geocoding');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: requests, loading } = useCollection<ExternalRequest>(
    'external_requests',
    query(
      collection(db, 'external_requests'),
      where('userId', '==', currentUser.id)
    )
  );

  const sortedRequests = requests?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const [requestData, setRequestData] = useState({
    type: 'coleta' as 'coleta' | 'entrega',
    address: '',
    observations: '',
    osNumber: '', 
    orderNumber: '', 
    contactPhone: '',
    scheduledDate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let lat = null;
      let lng = null;
      
      if (geocodingLibrary && requestData.address) {
        try {
          const geocoder = new geocodingLibrary.Geocoder();
          const response = await geocoder.geocode({ address: requestData.address });
          if (response.results && response.results[0]) {
            lat = response.results[0].geometry.location.lat();
            lng = response.results[0].geometry.location.lng();
          }
        } catch (geocodeError) {
          console.warn("Geocoding failed for address:", requestData.address, geocodeError);
        }
      }

      await addDoc(collection(db, 'external_requests'), {
        ...requestData,
        requesterName: currentUser.name,
        userId: currentUser.id, // Linking to internal user
        lat,
        lng,
        status: 'pending',
        read: false,
        createdAt: new Date().toISOString()
      });
      setIsSubmitted(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setIsSubmitted(false);
        setRequestData({
          type: 'coleta',
          address: '',
          observations: '',
          osNumber: '',
          orderNumber: '',
          contactPhone: '',
          scheduledDate: '',
        });
      }, 3000);
    } catch (error) {
      console.error("Error saving request: ", error);
      alert("Houve um erro ao enviar sua solicitação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><Check size={14} /> Concluído</span>;
      case 'on_route':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Clock size={14} /> Em Rota</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Clock size={14} /> Pendente</span>;
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Meus Chamados</h1>
          <p className="text-slate-500 mt-1">Acompanhe suas solicitações de coleta e entrega.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-cyan hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus size={20} />
          Novo Chamado
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data do Pedido</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Referência</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Endereço</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Agendamento</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : !sortedRequests || sortedRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 flex flex-col items-center">
                    <Package size={48} className="text-slate-300 mb-4" />
                    <p className="text-lg font-medium text-slate-600">Nenhum chamado encontrado</p>
                    <p className="text-sm">Você ainda não fez nenhuma solicitação.</p>
                  </td>
                </tr>
              ) : (
                sortedRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-sm text-slate-600">
                      {new Date(req.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                        {req.type === 'coleta' ? <Package size={12} /> : <MapPin size={12} />}
                        {req.type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm font-medium text-slate-700">
                      {req.type === 'coleta' ? req.osNumber : req.orderNumber}
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600 max-w-xs truncate" title={req.address}>
                      {req.address}
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600">
                      {req.scheduledDate.split('-').reverse().join('/')}
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(req.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Novo Chamado */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
            {isSubmitted ? (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={40} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Solicitação Enviada!</h2>
                <p className="text-slate-600">Sua solicitação foi registrada com sucesso.</p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-cyan/10 text-brand-cyan rounded-lg">
                      <Package size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Nova Solicitação</h2>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Tipo */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Tipo de Solicitação</label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center text-center transition-all ${requestData.type === 'coleta' ? 'border-brand-cyan bg-cyan-50/30' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input 
                          type="radio" 
                          name="type" 
                          value="coleta" 
                          checked={requestData.type === 'coleta'}
                          onChange={() => setRequestData({...requestData, type: 'coleta'})}
                          className="sr-only"
                        />
                        <Package size={24} className={requestData.type === 'coleta' ? 'text-brand-cyan mb-2' : 'text-slate-400 mb-2'} />
                        <span className={`font-semibold ${requestData.type === 'coleta' ? 'text-brand-cyan' : 'text-slate-600'}`}>Coleta</span>
                      </label>
                      <label className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center text-center transition-all ${requestData.type === 'entrega' ? 'border-brand-cyan bg-cyan-50/30' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input 
                          type="radio" 
                          name="type" 
                          value="entrega" 
                          checked={requestData.type === 'entrega'}
                          onChange={() => setRequestData({...requestData, type: 'entrega'})}
                          className="sr-only"
                        />
                        <MapPin size={24} className={requestData.type === 'entrega' ? 'text-brand-cyan mb-2' : 'text-slate-400 mb-2'} />
                        <span className={`font-semibold ${requestData.type === 'entrega' ? 'text-brand-cyan' : 'text-slate-600'}`}>Entrega</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Campos dinâmicos */}
                    {requestData.type === 'coleta' ? (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          OS / NF / Pedido <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          required
                          value={requestData.osNumber}
                          onChange={(e) => setRequestData({...requestData, osNumber: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all"
                          placeholder="Ex: NF-12345"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Número do Pedido <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          required
                          value={requestData.orderNumber}
                          onChange={(e) => setRequestData({...requestData, orderNumber: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all"
                          placeholder="Ex: PED-98765"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Data Agendada <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3.5 text-slate-400" size={18} />
                        <input 
                          type="date" 
                          required
                          value={requestData.scheduledDate}
                          onChange={(e) => setRequestData({...requestData, scheduledDate: e.target.value})}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Endereço Completo <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3.5 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        required
                        value={requestData.address}
                        onChange={(e) => setRequestData({...requestData, address: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all"
                        placeholder="Rua, Número, Bairro, Cidade - Estado"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telefone / WhatsApp para Contato</label>
                    <input 
                      type="text" 
                      value={requestData.contactPhone}
                      onChange={(e) => setRequestData({...requestData, contactPhone: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all"
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Observações</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3.5 text-slate-400" size={18} />
                      <textarea 
                        rows={2}
                        value={requestData.observations}
                        onChange={(e) => setRequestData({...requestData, observations: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all resize-none"
                        placeholder="Instruções adicionais..."
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-cyan hover:bg-cyan-600 text-white font-bold rounded-xl transition-colors disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <Send size={18} />
                      )}
                      Enviar
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
