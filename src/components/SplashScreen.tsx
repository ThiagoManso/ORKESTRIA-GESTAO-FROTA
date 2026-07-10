import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, Shield, Navigation, Gauge } from 'lucide-react';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  const messages = [
    "Iniciando Kernel Orkestria...",
    "Vinculando telemetria de frota...",
    "Sincronizando protocolos de rede...",
    "Carregando Orkestria OS...",
    "Sistema pronto..."
  ];

  useEffect(() => {
    const duration = 2500; // Reduced to 2.5s for better UX
    const interval = 30; 
    const step = 100 / (duration / interval);

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + step;
      });
    }, interval);

    const messageTimer = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 500);

    const finishTimer = setTimeout(() => {
      onComplete();
    }, duration + 100);

    return () => {
      clearInterval(timer);
      clearInterval(messageTimer);
      clearTimeout(finishTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className="fixed inset-0 z-[100] bg-[#02040a] flex flex-col items-center justify-center p-6 overflow-hidden cursor-pointer"
      onClick={onComplete} // Allow skip
    >
      {/* Interactive Cyber Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        {/* Grid System */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(123, 92, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(123, 92, 255, 0.05) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            transform: 'perspective(1000px) rotateX(60deg) translateY(-20%)',
            maskImage: 'linear-gradient(to bottom, transparent, black, transparent)'
          }}
        />
        
        {/* Scanlines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] pointer-events-none" />
        
        {/* Floating Data Points */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * 100 + '%', 
              y: '-10%',
              opacity: 0 
            }}
            animate={{ 
              y: '110%',
              opacity: [0, 0.8, 0],
              transition: { 
                duration: 5 + Math.random() * 10, 
                repeat: Infinity, 
                delay: Math.random() * 5 
              }
            }}
            className="absolute w-[1px] h-12 bg-gradient-to-b from-transparent via-ork-primary to-transparent"
          />
        ))}

        {/* Binary Rain Effect Overlay */}
        <div className="absolute inset-0 opacity-[0.03] select-none text-[8px] font-mono leading-[8px] p-2 break-all overflow-hidden">
          {Array(40).fill(0).map((_, i) => (
            <div key={i} className="whitespace-nowrap translate-x-[-50%]" style={{ animation: `matrixSlide ${2 + Math.random() * 5}s linear infinite` }}>
              {Array(200).fill(0).map(() => Math.round(Math.random())).join('')}
            </div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 flex flex-col items-center max-w-lg w-full"
      >
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-20">
          <div className="relative mb-8">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="w-32 h-32 rounded-2xl border border-ork-primary/30 flex items-center justify-center bg-ork-primary/5 backdrop-blur-xl"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Truck className="w-12 h-12 text-white" />
            </div>
            
            {/* Corner Accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-ork-primary translate-x-[-2px] translate-y-[-2px]" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-ork-secondary translate-x-[2px] translate-y-[2px]" />
          </div>

          <div className="text-center group">
            <h1 className="text-7xl font-black tracking-[-0.08em] leading-none text-white transition-all duration-700 group-hover:tracking-[-0.05em] relative">
              ORKESTRIA
              <span className="absolute -top-6 -right-12 px-2 py-1 bg-ork-primary text-white text-[8px] font-black rounded-sm tracking-[0.2em] transform rotate-12">OS v2.4</span>
            </h1>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="h-[1px] w-8 bg-ork-border" />
              <p className="text-sm font-black text-ork-secondary uppercase tracking-[0.6em] italic">Gestão de Frota</p>
              <div className="h-[1px] w-8 bg-ork-border" />
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="w-full space-y-6 px-12">
          <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-ork-primary shadow-[0_0_20px_rgba(123,92,255,0.6)]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <AnimatePresence mode="wait">
              <motion.p
                key={messageIndex}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="text-[9px] font-black uppercase tracking-[0.4em] text-ork-text-muted"
              >
                {messages[messageIndex]}
              </motion.p>
            </AnimatePresence>
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-ork-primary animate-pulse" />
              <p className="text-[10px] font-mono font-bold text-white/50">{Math.round(progress)}% SECURE BOOT</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Decorative footer */}
      <div className="absolute bottom-12 flex flex-col items-center gap-2 opacity-30">
        <div className="h-[1px] w-48 bg-gradient-to-r from-transparent via-ork-border to-transparent" />
        <p className="text-[8px] font-black uppercase tracking-[0.8em] text-ork-text-muted">Distributed Network Control Layer</p>
      </div>
    </div>
  );
}
