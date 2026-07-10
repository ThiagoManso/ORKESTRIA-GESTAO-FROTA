import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, MapPin, CheckCircle2, TrendingUp, X } from 'lucide-react';
import { CollectionRequest } from '../types';
import { cn } from '../lib/utils';

interface UberAlertProps {
  request: CollectionRequest | null;
  onAccept: (id: string) => void;
  onClose: () => void;
}

export function UberAlert({ request, onAccept, onClose }: UberAlertProps) {
  useEffect(() => {
    if (!request) return;

    // Sound effect (optional, browser restrictions may apply)
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
      audio.play().catch(() => console.log("Sound blocked by browser"));
    } catch (e) {
      console.log("Audio error", e);
    }
  }, [request]);

  return (
    <AnimatePresence>
      {request && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ork-bg/90 backdrop-blur-xl"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            className="relative w-full max-w-sm sm:max-w-md bg-ork-surface border-2 border-ork-primary p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] shadow-[0_0_100px_rgba(123,92,255,0.4)] overflow-hidden"
          >
            {/* Pulsing background effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.1, 0.2, 0.1],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-ork-primary rounded-full blur-[100px]"
              />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="bg-ork-primary p-6 rounded-full mb-8 shadow-[0_0_30px_#7B5CFF] animate-bounce">
                <Bell className="w-10 h-10 text-white" />
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase mb-2">
                {request.status === 'accepted' ? 'Coleta Atualizada!' : 'Nova Coleta!'}
              </h2>
              <div className="bg-ork-primary/20 px-4 py-1.5 rounded-full mb-8">
                <p className="text-ork-primary text-xs font-black uppercase tracking-[0.3em]">
                  {request.status === 'accepted' ? 'Mudanças na Rota' : 'Oportunidade Próxima'}
                </p>
              </div>

              <div className="w-full bg-white/5 border border-white/10 p-6 rounded-3xl mb-8 text-left">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-ork-accent/10 p-2 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-ork-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white leading-tight">{request.title}</h3>
                    <p className="text-[10px] font-black text-ork-accent uppercase tracking-widest mt-1">
                      {request.priority === 'high' ? 'Prioridade Máxima' : 'Rota Otimizada'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-ork-bg/50 p-4 rounded-2xl border border-white/5">
                  <MapPin className="w-5 h-5 text-ork-secondary shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-slate-300 leading-relaxed text-left">
                    {request.address}
                  </p>
                </div>

                {request.observations && (
                  <div className="mt-4 bg-ork-primary/10 p-4 rounded-2xl border border-ork-primary/20">
                    <p className="text-[8px] font-black text-ork-primary uppercase tracking-widest mb-1">Observações do Despacho</p>
                    <p className="text-[11px] font-medium text-white/90 leading-relaxed">
                      {request.observations}
                    </p>
                  </div>
                )}
              </div>

              <div className="w-full space-y-4">
                <button
                  onClick={() => onAccept(request.id)}
                  className="w-full h-20 sm:h-24 bg-ork-primary hover:bg-ork-primary/90 text-white font-black rounded-full transition-all shadow-[0_15px_40px_rgba(123,92,255,0.4)] flex flex-col items-center justify-center group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <span className="text-2xl uppercase tracking-[0.2em]">
                    {request.status === 'accepted' ? 'OK, Entendido' : 'Aceitar Agora'}
                  </span>
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-4 text-ork-text-muted text-xs font-black uppercase tracking-[0.3em] hover:text-white transition-colors"
                >
                  Recusar Solicitação
                </button>
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
