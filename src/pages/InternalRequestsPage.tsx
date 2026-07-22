import React, { useState, useEffect } from 'react';
import { Package, MapPin, FileText, Send, CheckCircle, Calendar, Plus, Clock, Check, Copy, Repeat, List, Trash2, Pause, Play } from 'lucide-react';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ExternalRequest, SystemUser, RecurringRequest } from '../types';
import FleetAvailabilityPanel from '../components/FleetAvailabilityPanel';
import { useRecurrenceEngine } from '../hooks/useRecurrenceEngine';

interface InternalRequestsPageProps {
  currentUser: SystemUser;
}

export default function InternalRequestsPage({ currentUser }: InternalRequestsPageProps) {
  useRecurrenceEngine(currentUser?.id); // Trigger automatic recurrences generation

  const [activeTab, setActiveTab] = useState<'history' | 'recurrences'>('history');
  const [requests, setRequests] = useState<ExternalRequest[]>([]);
  const [templates, setTemplates] = useState<RecurringRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Form state
  const [type, setType] = useState<'coleta' | 'entrega'>('coleta');
  const [address, setAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [observations, setObservations] = useState('');
  const [reference, setReference] = useState(''); // OS or Order number
  const [contactPhone, setContactPhone] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [weekDays, setWeekDays] = useState<number[]>([]); // 0-6 (Sun-Sat)

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

  // Fetch user's recurring templates
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;

    const q = query(
      collection(db, 'request_templates'),
      where('userId', '==', currentUser.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTemplates: RecurringRequest[] = [];
      snapshot.forEach((doc) => {
        fetchedTemplates.push({ id: doc.id, ...doc.data() } as RecurringRequest);
      });
      
      fetchedTemplates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTemplates(fetchedTemplates);
    }, (error) => {
      console.error("Error fetching templates: ", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const resetForm = () => {
    setType('coleta');
    setAddress('');
    setDropoffAddress('');
    setObservations('');
    setReference('');
    setContactPhone('');
    setScheduledDate('');
    setIsRecurring(false);
    setFrequency('weekly');
    setWeekDays([]);
    setIsSubmitted(false);
    setIsModalOpen(false);
  };

  const handleToggleWeekDay = (day: number) => {
    if (weekDays.includes(day)) {
      setWeekDays(weekDays.filter(d => d !== day));
    } else {
      setWeekDays([...weekDays, day]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference || !address || !scheduledDate) {
      alert("Por favor, preencha os campos obrigatórios.");
      return;
    }

    if (isRecurring && frequency === 'weekly' && weekDays.length === 0) {
      alert("Por favor, selecione pelo menos um dia da semana para a recorrência.");
      return;
    }

    setIsSubmitting(true);
    try {
      let recurrenceId = '';
      
      // Salva o template de recorrência se ativado
      if (isRecurring) {
        let monthDay = 1;
        if (scheduledDate) {
          const parts = scheduledDate.split('-');
          if (parts.length === 3) {
            monthDay = parseInt(parts[2], 10);
          }
        }
        
        const newTemplate = {
          type,
          address,
          dropoffAddress: type === 'coleta' ? dropoffAddress : '',
          observations,
          osNumber: type === 'coleta' ? reference : '',
          orderNumber: type === 'entrega' ? reference : '',
          contactPhone,
          requesterName: currentUser.name,
          userId: currentUser.id,
          frequency,
          weekDays: frequency === 'weekly' ? weekDays : [],
          monthDay: frequency === 'monthly' ? monthDay : 1,
          active: true,
          createdAt: new Date().toISOString()
        };
        const docRef = await addDoc(collection(db, 'request_templates'), newTemplate);
        recurrenceId = docRef.id;
      }

      // Salva o chamado atual para a data selecionada
      const newRequest = {
        type,
        address,
        dropoffAddress: type === 'coleta' ? dropoffAddress : '',
        observations,
        osNumber: type === 'coleta' ? reference : '',
        orderNumber: type === 'entrega' ? reference : '',
        contactPhone,
        scheduledDate,
        requesterName: currentUser.name,
        userId: currentUser.id,
        status: 'pending',
        read: false,
        createdAt: new Date().toISOString(),
        ...(recurrenceId ? { recurrenceId } : {})
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

  const toggleTemplateActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'request_templates', id), { active: !currentStatus });
    } catch (error) {
      console.error("Error toggling template:", error);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta regra de recorrência? Os chamados já gerados não serão apagados.")) {
      try {
        await deleteDoc(doc(db, 'request_templates', id));
      } catch (error) {
        console.error("Error deleting template:", error);
      }
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

  const formatWeekDays = (days?: number[]) => {
    if (!days || days.length === 0) return '';
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days.sort((a,b) => a-b).map(d => dayNames[d]).join(', ');
  };

  const weekDaysOptions = [
    { value: 1, label: 'Seg' },
    { value: 2, label: 'Ter' },
    { value: 3, label: 'Qua' },
    { value: 4, label: 'Qui' },
    { value: 5, label: 'Sex' },
    { value: 6, label: 'Sáb' },
    { value: 0, label: 'Dom' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Meus Chamados</h1>
          <p className="text-slate-500 mt-1">Acompanhe suas solicitações de logística.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex-1 sm:flex-none ${activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <List size={16} /> Histórico
            </button>
            <button
              onClick={() => setActiveTab('recurrences')}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex-1 sm:flex-none ${activeTab === 'recurrences' ? 'bg-white text-brand-cyan shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Repeat size={16} /> Padrões
            </button>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-cyan hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Novo</span>
          </button>
        </div>
      </div>

      <FleetAvailabilityPanel targetDateStr={new Date().toLocaleDateString('pt-BR')} />

      {activeTab === 'history' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col mt-6">
          {/* Visualização Desktop (Tabela) */}
          <div className="hidden md:block overflow-x-auto flex-1">
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
                        {req.recurrenceId && <Repeat size={12} className="inline ml-2 text-brand-cyan" title="Gerado automaticamente" />}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-700">
                        {req.type === 'coleta' ? req.osNumber : req.orderNumber}
                      </td>
                      <td className="py-4 px-6 text-slate-600 max-w-xs truncate" title={req.address}>
                        {req.address}
                        {req.type === 'coleta' && req.dropoffAddress && (
                          <div className="text-xs text-slate-400 mt-1" title={req.dropoffAddress}>
                            <MapPin size={10} className="inline mr-1" />
                            Pós-Coleta: {req.dropoffAddress}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">
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
          <div className="md:hidden divide-y divide-slate-100 flex-1 overflow-y-auto">
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
                      {req.recurrenceId && <Repeat size={12} className="inline ml-1 text-brand-cyan" title="Gerado automaticamente" />}
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
                    {req.type === 'coleta' && req.dropoffAddress && (
                      <div className="text-xs text-slate-400 mt-1">
                        <MapPin size={10} className="inline mr-1" />
                        Pós-Coleta: {req.dropoffAddress}
                      </div>
                    )}
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
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <div className="bg-brand-cyan/10 border border-brand-cyan/20 p-4 rounded-xl flex items-start gap-3">
            <Repeat className="text-brand-cyan mt-0.5" size={20} />
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Robô de Agendamento Ativo</h3>
              <p className="text-sm text-slate-600">
                Os padrões abaixo são lidos automaticamente pelo sistema. Um novo chamado "Pendente" é criado com 7 dias de antecedência para as datas que coincidirem com as regras.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-xl">
                <Repeat size={48} className="text-slate-300 mb-4 mx-auto" />
                <p className="text-lg font-medium text-slate-600">Nenhum Padrão Recorrente</p>
                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  Quando criar um novo chamado, marque a opção "Tornar este chamado recorrente" para que o sistema passe a gerá-lo automaticamente.
                </p>
              </div>
            ) : (
              templates.map(template => (
                <div key={template.id} className={`bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden transition-all ${template.active ? 'border-slate-200' : 'border-slate-200 opacity-60 grayscale'}`}>
                  <div className="p-4 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                        {template.type === 'coleta' ? <Package size={12} /> : <MapPin size={12} />}
                        {template.type}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => toggleTemplateActive(template.id, template.active)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors" title={template.active ? "Pausar regra" : "Reativar regra"}>
                          {template.active ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <button onClick={() => deleteTemplate(template.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Excluir regra">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="font-bold text-slate-800 text-lg mb-1 truncate">
                      {template.type === 'coleta' ? template.osNumber : template.orderNumber}
                    </h3>
                    <p className="text-sm text-slate-500 line-clamp-2 mb-4 h-10">
                      {template.address}
                    </p>
                    
                    <div className="bg-slate-50 rounded-lg p-3 text-sm">
                      <div className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                        <Repeat size={14} className="text-brand-cyan" /> 
                        {template.frequency === 'daily' && 'Todos os dias'}
                        {template.frequency === 'weekly' && 'Semanalmente'}
                        {template.frequency === 'monthly' && 'Mensalmente'}
                      </div>
                      <div className="text-slate-600">
                        {template.frequency === 'weekly' && formatWeekDays(template.weekDays)}
                        {template.frequency === 'monthly' && `Todo dia ${template.monthDay}`}
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 font-medium">
                    Status: {template.active ? <span className="text-emerald-600 font-bold">Gerando ativamente</span> : <span className="text-amber-600 font-bold">Pausado</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data Inicial / Agendada <span className="text-red-500">*</span></label>
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
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Endereço Completo {type === 'coleta' && '(Onde coletar)'} <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3.5 text-slate-400" size={18} />
                      <input 
                        type="text" required value={address} onChange={(e) => setAddress(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                        placeholder="Rua, Número, Bairro, Cidade"
                      />
                    </div>
                  </div>

                  {type === 'coleta' && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Local de Entrega Pós-Coleta (Opcional)</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 text-slate-400" size={18} />
                        <input 
                          type="text" value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                          placeholder="Ex: Galpão Central, Matriz, etc."
                        />
                      </div>
                    </div>
                  )}

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

                  {/* Recurrence Setup */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isRecurring} 
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan"
                      />
                      <span className="font-semibold text-slate-800">Tornar este chamado recorrente</span>
                    </label>

                    {isRecurring && (
                      <div className="pt-2 border-t border-slate-200 space-y-4 animate-in fade-in">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Frequência</label>
                          <select 
                            value={frequency} 
                            onChange={(e) => setFrequency(e.target.value as any)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                          >
                            <option value="daily">Diário</option>
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensal (Todo dia X)</option>
                          </select>
                        </div>
                        
                        {frequency === 'weekly' && (
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Dias da Semana</label>
                            <div className="flex flex-wrap gap-2">
                              {weekDaysOptions.map(day => (
                                <button
                                  key={day.value}
                                  type="button"
                                  onClick={() => handleToggleWeekDay(day.value)}
                                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${
                                    weekDays.includes(day.value) 
                                      ? 'bg-brand-cyan text-white border-brand-cyan' 
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  {day.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {frequency === 'monthly' && (
                          <div className="text-sm text-slate-600 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                            A recorrência será gerada todos os meses no mesmo dia selecionado em "Data Inicial / Agendada".
                          </div>
                        )}
                        
                        <div className="text-xs text-slate-500 flex items-start gap-2 mt-2">
                          <Repeat size={14} className="shrink-0 mt-0.5 text-brand-cyan" />
                          <p>O sistema criará automaticamente chamados para o roteirizador com até 7 dias de antecedência baseados nesta regra.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button type="button" onClick={resetForm} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-cyan hover:bg-cyan-600 text-white font-bold rounded-xl transition-colors disabled:opacity-70 shadow-sm">
                      {isSubmitting ? 'Enviando...' : <><Send size={18} /> Confirmar Chamado</>}
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
