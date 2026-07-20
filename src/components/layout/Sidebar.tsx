import React from 'react';
import { 
  LayoutDashboard, 
  Map, 
  Users, 
  Truck,
  DollarSign, 
  AlertCircle, 
  Settings,
  Package,
  X,
  MapPin
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ViewState, SystemUser } from '../../types';

interface SidebarProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  currentUser?: SystemUser | null;
}

export default function Sidebar({ currentView, onViewChange, isOpen, setIsOpen, currentUser }: SidebarProps) {
  const menuItems: { id: ViewState; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Torre de Controle', icon: LayoutDashboard },
    { id: 'routes', label: 'Rotas', icon: Map },
    { id: 'requests', label: 'Banco de Demandas', icon: Package },
    { id: 'map', label: 'Mapa de Operação', icon: MapPin },
    { id: 'drivers', label: 'Entregadores', icon: Users },
    { id: 'vehicles', label: 'Veículos', icon: Truck },
    { id: 'financial', label: 'Financeiro', icon: DollarSign },
    { id: 'issues', label: 'Acareação', icon: AlertCircle },
    { id: 'my_requests', label: 'Meus Chamados', icon: Package },
    { id: 'users', label: 'Usuários', icon: Users },
  ];
  
  const filteredMenuItems = menuItems.filter(item => {
    const userPermissions = currentUser?.permissions || [];
    return !currentUser || userPermissions.includes(item.id);
  });

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white p-2.5 rounded-xl shadow-sm">
              <Package size={24} />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-[var(--color-brand-cyan)] via-[var(--color-brand-blue)] to-[var(--color-brand-purple)] text-transparent bg-clip-text">
              ORKESTRIA
            </span>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">
            Menu Principal
          </div>
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all text-sm font-medium",
                  isActive 
                    ? "bg-primary/10 text-primary shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon size={18} className={isActive ? "text-primary" : "text-slate-400"} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-100">
          {(!currentUser || (currentUser.permissions || []).includes('settings')) && (
            <button 
              onClick={() => onViewChange('settings')}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-colors text-sm font-medium",
                currentView === 'settings' 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Settings size={18} className={currentView === 'settings' ? "text-primary" : "text-slate-400"} />
              Configurações
            </button>
          )}
        </div>
      </div>
    </>
  );
}
