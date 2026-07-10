import React, { useState } from 'react';
import { collectionRequestService } from '../lib/services';
import { MapPin, Box, FileText, Send, CheckCircle2, Sparkles, Share2, Check, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function PublicRequestForm() {
  const [formData, setFormData] = useState({
    title: '',
    address: '',
    observations: '',
    type: 'coleta' as 'coleta' | 'entrega',
    scheduledDate: new Date().toISOString().split('T')[0]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const handleShareSummary = () => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const now = new Date().toLocaleDateString('pt-BR');
    
    // Format scheduled date for summary
    const [year, month, day] = formData.scheduledDate.split('-');
    const formattedScheduledDate = `${day}/${month}/${year}`;
    
    const summary = `*SOLICITAÇÃO DE ${formData.type.toUpperCase()}*\n` +
      `📅 *Criado em:* ${now} às ${time}\n` +
      `🗓️ *Data Prevista:* ${formattedScheduledDate}\n` +
      `🏢 *Item/Cliente:* ${formData.title}\n` +
      `📍 *Endereço:* ${formData.address}\n` +
      `📝 *Observações:* ${formData.observations || 'Nenhuma'}\n\n` +
      `_Enviado via Portal de Solicitações Orkestria_`;
    
    navigator.clipboard.writeText(summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.address) return;

    setIsSubmitting(true);
    try {
      await collectionRequestService.addRequest({
        ...formData,
        status: 'pending',
        priority: 'medium'
      }, "public");
      setSubmitted(true);
    } catch (error: any) {
      console.error("Error submitting public request:", error);
      let errorMsg = "Erro ao enviar solicitação. Tente novamente.";
      
      try {
        // Try to parse the JSON error from handleFirestoreError
        const parsed = JSON.parse(error.message);
        if (parsed.error.includes("Missing or insufficient permissions")) {
          errorMsg = "Erro de permissão no servidor. Por favor, contate o administrador.";
        } else if (parsed.error) {
          errorMsg = `Erro: ${parsed.error}`;
        }
      } catch (e) {
        // Not a JSON error, keep default
      }
      
      alert(errorMsg);
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
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full -mr-10 -mt-10" />
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="text-emerald-500 w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-white uppercase italic mb-4 tracking-tight">Solicitado!</h2>
          <p className="text-ork-text-muted font-medium mb-10">Sua solicitação de coleta foi enviada com sucesso e já está disponível em nosso painel de controle.</p>
          
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
              {copiedSummary ? (
                <>
                  <Check size={16} />
                  Resumo Copiado!
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  Compartilhar Resumo
                </>
              )}
            </button>

            <button 
              onClick={() => {
                setSubmitted(false);
                setFormData({ 
                  title: '', 
                  address: '', 
                  observations: '',
                  type: 'coleta',
                  scheduledDate: new Date().toISOString().split('T')[0]
                });
              }}
              className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all text-white/70"
            >
              Enviar Nova Solicitação
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
            <Sparkles className="w-3 h-3 text-ork-primary" />
            <span className="text-[10px] font-black uppercase text-ork-primary tracking-widest leading-none">Portal de Solicitações</span>
          </div>
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4 leading-none">
            Solicitar <span className="text-ork-primary">Nova {formData.type === 'coleta' ? 'Coleta' : 'Entrega'}</span>
          </h1>
          <p className="text-ork-text-muted text-sm font-medium">Preencha os detalhes abaixo para agendar um serviço.</p>
        </header>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-ork-surface border border-ork-border p-8 rounded-[3rem] shadow-2xl relative overflow-hidden"
        >
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-ork-primary/5 blur-3xl rounded-full -ml-10 -mb-10 pointer-events-none" />
          
          <form onSubmit={handleSubmit} className="space-y-8 relative">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({...formData, type: 'coleta'})}
                className={cn(
                  "py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border",
                  formData.type === 'coleta' 
                    ? "bg-ork-primary border-ork-primary text-white shadow-lg shadow-ork-primary/20" 
                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                )}
              >
                Coleta
              </button>
              <button
                type="button"
                onClick={() => setFormData({...formData, type: 'entrega'})}
                className={cn(
                  "py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border",
                  formData.type === 'entrega' 
                    ? "bg-ork-primary border-ork-primary text-white shadow-lg shadow-ork-primary/20" 
                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                )}
              >
                Entrega
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-[0.2em] ml-2">O que vamos {formData.type === 'coleta' ? 'coletar' : 'entregar'}?</label>
              <div className="relative group">
                <Box className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-ork-text-muted group-focus-within:text-ork-primary transition-colors" />
                <input 
                  type="text"
                  required
                  placeholder="Ex: 5 Caixas de Papelão, Peças Eletrônicas..."
                  className="w-full bg-ork-bg border border-ork-border rounded-2xl py-5 pl-14 pr-6 text-white outline-none focus:border-ork-primary transition-all font-medium text-lg placeholder:text-ork-text-muted/30"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-[0.2em] ml-2">Local da {formData.type === 'coleta' ? 'Coleta' : 'Entrega'}</label>
              <div className="relative group">
                <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-ork-text-muted group-focus-within:text-ork-primary transition-colors" />
                <input 
                  type="text"
                  required
                  placeholder="Endereço Completo..."
                  className="w-full bg-ork-bg border border-ork-border rounded-2xl py-5 pl-14 pr-6 text-white outline-none focus:border-ork-primary transition-all font-medium text-lg placeholder:text-ork-text-muted/30"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-[0.2em] ml-2">Data da {formData.type === 'coleta' ? 'Coleta' : 'Entrega'}</label>
              <div className="relative group">
                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-ork-text-muted group-focus-within:text-ork-primary transition-colors" />
                <input 
                  type="date"
                  required
                  className="w-full bg-ork-bg border border-ork-border rounded-2xl py-5 pl-14 pr-6 text-white outline-none focus:border-ork-primary transition-all font-medium text-lg [color-scheme:dark]"
                  value={formData.scheduledDate}
                  onChange={e => setFormData({...formData, scheduledDate: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-[0.2em] ml-2">Observações / Detalhes</label>
              <div className="relative group">
                <FileText className="absolute left-5 top-6 w-5 h-5 text-ork-text-muted group-focus-within:text-ork-primary transition-colors" />
                <textarea 
                  placeholder="Instruções de acesso, falar com alguém específico, horários disponíveis..."
                  className="w-full bg-ork-bg border border-ork-border rounded-2xl py-5 pl-14 pr-6 text-white outline-none focus:border-ork-primary transition-all font-medium text-lg min-h-[160px] resize-none placeholder:text-ork-text-muted/30"
                  value={formData.observations}
                  onChange={e => setFormData({...formData, observations: e.target.value})}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-6 bg-ork-primary text-white rounded-[1.5rem] font-black uppercase tracking-[0.3em] italic text-sm shadow-[0_10px_30px_rgba(123,92,255,0.4)] hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(123,92,255,0.5)] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:translate-y-0"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Enviar Solicitação
                </>
              )}
            </button>
          </form>
        </motion.div>

        <footer className="mt-12 text-center opacity-30">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white">Logistics Central • v2.0</p>
        </footer>
      </div>
    </div>
  );
}
