import React, { useState } from 'react';
import { purchaseRequestService } from '../lib/services';
import { ShoppingCart, Calendar, CheckCircle2, Share2, Check, User, Building, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function PublicPurchaseRequestForm() {
  const [formData, setFormData] = useState({
    requestedBy: '',
    department: '',
    specification: '',
    urgencyDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const handleShareSummary = () => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const now = new Date().toLocaleDateString('pt-BR');
    
    const [year, month, day] = formData.urgencyDate.split('-');
    const formattedDate = `${day}/${month}/${year}`;
    
    const summary = `*SOLICITAÇÃO DE COMPRAS*\n` +
      `📅 *Criado em:* ${now} às ${time}\n` +
      `🗓️ *Data Limite:* ${formattedDate}\n` +
      `👤 *Solicitante:* ${formData.requestedBy}\n` +
      `🏢 *Setor:* ${formData.department}\n` +
      `📦 *Especificação:* ${formData.specification}\n` +
      `📝 *Observações:* ${formData.notes || 'Nenhuma'}\n\n` +
      `_Enviado via Portal de Compras_`;
    
    navigator.clipboard.writeText(summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.requestedBy || !formData.specification || !formData.department) return;

    setIsSubmitting(true);
    try {
      await purchaseRequestService.addRequest({
        ...formData,
        status: 'pending'
      });
      setSubmitted(true);
    } catch (error: any) {
      console.error("Error submitting request:", error);
      alert("Erro ao enviar solicitação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-ork-bg flex items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-ork-surface border border-ork-border p-12 rounded-[3rem] shadow-2xl max-w-md w-full relative overflow-hidden"
        >
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="text-emerald-500 w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-white uppercase italic mb-4 tracking-tight">Solicitado!</h2>
          <p className="text-ork-text-muted font-medium mb-10">O pedido foi enviado para o setor de compras.</p>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={handleShareSummary}
              className={cn(
                "w-full py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3",
                copiedSummary 
                  ? "bg-emerald-500 text-white" 
                  : "bg-ork-primary text-white shadow-xl shadow-ork-primary/20 hover:-translate-y-1"
              )}
            >
              {copiedSummary ? <><Check size={16} /> Resumo Copiado!</> : <><Share2 size={16} /> Compartilhar Resumo</>}
            </button>

            <button 
              onClick={() => {
                setSubmitted(false);
                setFormData({
                  requestedBy: '',
                  department: '',
                  specification: '',
                  urgencyDate: new Date().toISOString().split('T')[0],
                  notes: ''
                });
              }}
              className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all text-white/70"
            >
              Enviar Novo Pedido
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ork-bg flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-from)_0%,_transparent_40%)] from-ork-primary/10">
      <div className="w-full max-w-xl">
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-ork-primary/10 border border-ork-primary/20 rounded-full mb-6">
            <ShoppingCart className="w-3 h-3 text-ork-primary" />
            <span className="text-[10px] font-black uppercase text-ork-primary tracking-widest leading-none">Compras</span>
          </div>
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4 leading-none">
            Solicitação de <span className="text-ork-primary">Compra/Orçamento</span>
          </h1>
        </header>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-ork-surface border border-ork-border p-8 rounded-[3rem] shadow-2xl relative overflow-hidden"
        >
          <form onSubmit={handleSubmit} className="space-y-6 relative">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-[0.2em] ml-2">Quem está solicitando?</label>
              <div className="relative group">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-ork-text-muted" />
                <input 
                  type="text"
                  required
                  placeholder="Nome do Solicitante"
                  className="w-full bg-ork-bg border border-ork-border rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-ork-primary transition-all font-medium text-lg"
                  value={formData.requestedBy}
                  onChange={e => setFormData({...formData, requestedBy: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-[0.2em] ml-2">Qual seu setor?</label>
              <div className="relative group">
                <Building className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-ork-text-muted" />
                <input 
                  type="text"
                  required
                  placeholder="Ex: TI, Manutenção, Logística..."
                  className="w-full bg-ork-bg border border-ork-border rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-ork-primary transition-all font-medium text-lg"
                  value={formData.department}
                  onChange={e => setFormData({...formData, department: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-[0.2em] ml-2">O que precisa ser comprado/orçado?</label>
              <div className="relative group">
                <ShoppingCart className="absolute left-5 top-5 w-5 h-5 text-ork-text-muted" />
                <textarea 
                  required
                  placeholder="Especifique os itens, quantidades e detalhes..."
                  className="w-full bg-ork-bg border border-ork-border rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-ork-primary transition-all font-medium text-lg min-h-[120px] resize-none"
                  value={formData.specification}
                  onChange={e => setFormData({...formData, specification: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-[0.2em] ml-2">Data Limite / Urgência</label>
              <div className="relative group">
                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-ork-text-muted" />
                <input 
                  type="date"
                  required
                  className="w-full bg-ork-bg border border-ork-border rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-ork-primary transition-all font-medium text-lg [color-scheme:dark]"
                  value={formData.urgencyDate}
                  onChange={e => setFormData({...formData, urgencyDate: e.target.value})}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-5 mt-4 bg-ork-primary text-white rounded-[1.5rem] font-black uppercase tracking-[0.3em] shadow-[0_10px_30px_rgba(123,92,255,0.4)] hover:-translate-y-1 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Enviando..." : "Enviar Solicitação"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
