import React, { useState } from 'react';
import { Package, MapPin, FileText, Send, CheckCircle, ArrowLeft } from 'lucide-react';

export default function ExternalRequestPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [requestData, setRequestData] = useState({
    type: 'coleta' as 'coleta' | 'entrega',
    address: '',
    observations: '',
    osNumber: '', // For coleta
    orderNumber: '', // For entrega
    requesterName: '',
    contactPhone: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call to save request
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100 animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Solicitação Enviada!</h2>
          <p className="text-slate-600 mb-8">
            Sua solicitação de {requestData.type} foi registrada com sucesso e enviada para a central de operações.
          </p>
          <button 
            onClick={() => {
              setIsSubmitted(false);
              setRequestData({
                type: 'coleta',
                address: '',
                observations: '',
                osNumber: '',
                orderNumber: '',
                requesterName: '',
                contactPhone: '',
              });
            }}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
          >
            Fazer Nova Solicitação
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center justify-center bg-gradient-to-br from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white p-3 rounded-2xl shadow-sm mb-4">
            <Package size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
            Solicitação de Logística
          </h1>
          <p className="mt-2 text-slate-500">
            Preencha os dados abaixo para solicitar uma coleta ou entrega.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            <div className="space-y-6">
              
              {/* Type Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Tipo de Solicitação</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center text-center transition-all ${requestData.type === 'coleta' ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                    <input 
                      type="radio" 
                      name="type" 
                      value="coleta" 
                      checked={requestData.type === 'coleta'}
                      onChange={() => setRequestData({...requestData, type: 'coleta'})}
                      className="sr-only"
                    />
                    <Package size={24} className={requestData.type === 'coleta' ? 'text-primary mb-2' : 'text-slate-400 mb-2'} />
                    <span className={`font-semibold ${requestData.type === 'coleta' ? 'text-primary' : 'text-slate-600'}`}>Coleta</span>
                  </label>
                  
                  <label className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center text-center transition-all ${requestData.type === 'entrega' ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                    <input 
                      type="radio" 
                      name="type" 
                      value="entrega" 
                      checked={requestData.type === 'entrega'}
                      onChange={() => setRequestData({...requestData, type: 'entrega'})}
                      className="sr-only"
                    />
                    <MapPin size={24} className={requestData.type === 'entrega' ? 'text-primary mb-2' : 'text-slate-400 mb-2'} />
                    <span className={`font-semibold ${requestData.type === 'entrega' ? 'text-primary' : 'text-slate-600'}`}>Entrega</span>
                  </label>
                </div>
              </div>

              {/* Conditional Fields based on Type */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                {requestData.type === 'coleta' ? (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      OS (Nº da NF, Pedido ou Ordem de Compra) <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      value={requestData.osNumber}
                      onChange={(e) => setRequestData({...requestData, osNumber: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                      placeholder="Ex: NF-12345"
                    />
                    <p className="text-xs text-slate-500 mt-2">Necessário para retirada da mercadoria na coleta.</p>
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
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                      placeholder="Ex: PED-98765"
                    />
                  </div>
                )}
              </div>

              {/* Address */}
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
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                    placeholder="Rua, Número, Bairro, Cidade - Estado"
                  />
                </div>
              </div>

              {/* Requester Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome do Solicitante</label>
                  <input 
                    type="text" 
                    value={requestData.requesterName}
                    onChange={(e) => setRequestData({...requestData, requesterName: e.target.value})}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telefone / WhatsApp</label>
                  <input 
                    type="text" 
                    value={requestData.contactPhone}
                    onChange={(e) => setRequestData({...requestData, contactPhone: e.target.value})}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              {/* Observations */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Observações (Opcional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <textarea 
                    rows={3}
                    value={requestData.observations}
                    onChange={(e) => setRequestData({...requestData, observations: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all resize-none"
                    placeholder="Instruções para o motorista, horário limite, etc."
                  />
                </div>
              </div>

            </div>

            <div className="mt-8">
              <button 
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-md hover:shadow-lg"
              >
                <Send size={20} />
                Enviar Solicitação
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
