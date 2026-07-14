import React, { useState } from 'react';
import { Bell, Search, User, Menu, Share2, Check } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=external-request`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-10 sticky top-0">
      <div className="flex items-center flex-1 gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>
        
        <div className="hidden sm:flex items-center bg-slate-100 rounded-full px-4 py-2 w-full max-w-md focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-white transition-all border border-transparent focus-within:border-primary/20">
          <Search size={18} className="text-slate-400 mr-2 flex-shrink-0" />
          <input 
            type="text" 
            placeholder="Buscar rotas, entregadores ou clientes..." 
            className="bg-transparent border-none outline-none w-full text-sm text-slate-700 placeholder-slate-400"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-6">
        <button 
          onClick={handleShare}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          title="Compartilhar Link Público de Solicitações"
        >
          {copied ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} />}
          {copied ? 'Link Copiado!' : 'Compartilhar Link'}
        </button>

        <button 
          onClick={handleShare}
          className="sm:hidden relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
        >
          {copied ? <Check size={20} className="text-emerald-500" /> : <Share2 size={20} />}
        </button>

        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors sm:hidden">
          <Search size={20} />
        </button>
        
        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-4 sm:pl-6 border-l border-slate-200">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-semibold text-slate-700">Administrador</span>
            <span className="text-xs text-slate-500">Operações SP</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] flex items-center justify-center text-white shadow-sm ring-2 ring-white">
            <User size={18} />
          </div>
        </div>
      </div>
    </header>
  );
}
