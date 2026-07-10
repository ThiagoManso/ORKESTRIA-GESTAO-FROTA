import { Car, LayoutDashboard, Wrench, Calendar, LogOut, Navigation as RoutesIcon, User, AlertTriangle, Send, BarChart3, Menu as MenuIcon, X, Truck, Users, ShoppingCart as ShoppingCartIcon } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { cn, isAdminEmail } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ activeTab, setActiveTab, isCollapsed, setIsCollapsed }: SidebarProps) {
  const { logout, user, profile } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard, role: 'admin' },
    { id: 'usage', label: 'Uso de Frota', icon: RoutesIcon, role: 'any' },
    { id: 'vehicles', label: 'Veículos', icon: Car, role: 'admin' },
    { id: 'drivers', label: 'Motoristas', icon: User, role: 'admin' },
    { id: 'collections', label: 'Coletas', icon: Send, role: 'admin' },
    { id: 'collections-dash', label: 'Dash Coletas', icon: BarChart3, role: 'admin' },
    { id: 'maintenance', label: 'Manutenções', icon: Wrench, role: 'admin' },
    { id: 'fines', label: 'Multas', icon: AlertTriangle, role: 'admin' },
    { id: 'schedules', label: 'Agenda', icon: Calendar, role: 'admin' },
    { id: 'users', label: 'Usuários', icon: Users, role: 'admin' },
    { id: 'purchases', label: 'Compras', icon: ShoppingCartIcon, role: 'purchasing' },
    { id: 'driver-portal', label: 'Portal Motorista', icon: Truck, role: 'any' },
  ];

  const isDeveloper = isAdminEmail(user?.email);
  const filteredItems = menuItems.filter(item => 
    item.role === 'any' || item.role === profile?.role || (profile?.role === 'admin' && item.role !== 'driver') || isDeveloper
  );

  return (
    <>
      {/* Floating Hamburger Toggle for Desktop */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "fixed top-6 left-6 z-[45] p-3 bg-ork-surface border border-ork-border rounded-2xl text-white shadow-2xl transition-all hover:scale-110 active:scale-95 group hidden lg:flex",
          !isCollapsed && "opacity-0 pointer-events-none"
        )}
      >
        <MenuIcon size={20} className="group-hover:text-ork-primary transition-colors" />
      </button>

      {/* Overlay for mobile/hidden state */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCollapsed(true)}
            className="fixed inset-0 bg-ork-bg/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        initial={false}
        animate={{ 
          x: isCollapsed ? -300 : 0
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="bg-ork-surface border-r border-ork-border flex flex-col h-screen w-72 fixed left-0 top-0 z-50 overflow-hidden shadow-[30px_0_60px_rgba(0,0,0,0.5)]"
      >
        <div className="p-8">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full border-4 border-ork-primary border-t-transparent animate-[spin_3s_linear_infinite]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-ork-secondary shadow-[0_0_10px_#2D9CFF]" />
                </div>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tighter">
                Orkestria <span className="text-ork-primary font-light">OS</span>
              </h1>
            </div>
            
            <button 
              onClick={() => setIsCollapsed(true)}
              className="p-2 hover:bg-white/5 rounded-xl text-ork-text-muted hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-[9px] font-black text-ork-text-muted uppercase tracking-[0.3em] mb-8">Navigation System</p>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsCollapsed(true);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative",
                activeTab === item.id 
                  ? "bg-ork-primary/10 text-white font-semibold" 
                  : "text-ork-text-muted hover:text-white"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 shrink-0 transition-colors",
                activeTab === item.id ? "text-ork-primary" : "group-hover:text-ork-primary"
              )} />
              <span className="text-sm tracking-wide">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto border-t border-ork-border">
          <div className="flex items-center gap-4 mb-8 px-2">
            <div className="relative shrink-0">
              <img 
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}`} 
                className="w-10 h-10 rounded-2xl border border-ork-border shadow-lg" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-ork-accent rounded-full border-2 border-ork-surface shadow-[0_0_10px_rgba(0,209,178,0.5)]" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate mb-0.5">{user?.displayName}</p>
              <p className="text-[10px] text-ork-text-muted truncate uppercase tracking-widest font-black">
                {isDeveloper || profile?.role === 'admin' ? 'Administrador' : 'Motorista'}
              </p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-xs font-black uppercase tracking-[0.2em] text-ork-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Desconectar</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
}
