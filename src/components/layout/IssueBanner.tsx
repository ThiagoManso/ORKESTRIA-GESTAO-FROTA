import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useCollection } from '../../lib/useCollection';
import { RouteItem } from '../../types';

interface IssueBannerProps {
  onBannerClick?: () => void;
}

export default function IssueBanner({ onBannerClick }: IssueBannerProps) {
  const { data: routes } = useCollection<RouteItem>('routes');
  
  // Find routes that have a status of 'issue'
  const issueRoutes = routes?.filter(route => route.status === 'issue') || [];
  
  if (issueRoutes.length === 0) {
    return null;
  }
  
  return (
    <div 
      onClick={onBannerClick}
      className="bg-red-500 text-white px-4 py-3 cursor-pointer hover:bg-red-600 transition-colors flex items-center justify-between shadow-sm z-20 animate-in fade-in slide-in-from-top-4"
    >
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-1.5 rounded-full animate-pulse">
          <AlertTriangle size={20} className="text-white" />
        </div>
        <div>
          <span className="font-bold">Alerta de Acareação!</span>
          <span className="ml-2 text-red-50 text-sm hidden sm:inline">
            Existem {issueRoutes.length} rota(s) relatada(s) com problema ou extravio pelos motoristas.
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-sm font-semibold bg-white/10 px-3 py-1.5 rounded-lg">
        Verificar <ChevronRight size={16} />
      </div>
    </div>
  );
}
