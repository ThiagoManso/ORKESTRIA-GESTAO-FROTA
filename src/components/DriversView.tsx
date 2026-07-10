import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { driverService, userService } from '../lib/services';
import { Driver, UserProfile } from '../types';
import { Plus, Search, User, Phone, CreditCard, Calendar, AlertCircle, Sparkles, UserCheck, Trash2, X, Pencil, ChevronRight } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function DriversView() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    licenseNumber: '',
    licenseCategory: 'B',
    licenseExpiry: '',
    phone: '',
    status: 'active' as const,
    isVirtual: false,
    userId: ''
  });

  useEffect(() => {
    if (!user) return;
    const unsubDrivers = driverService.subscribeToDrivers(setDrivers);
    const unsubUsers = userService.subscribeToUsers(setUsers);
    return () => {
      unsubDrivers();
      unsubUsers();
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (editingDriver) {
      await driverService.updateDriver(editingDriver.id, formData);
      setEditingDriver(null);
    } else {
      await driverService.addDriver(formData as any, user.uid);
    }
    
    setShowForm(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      licenseNumber: '',
      licenseCategory: 'B',
      licenseExpiry: '',
      phone: '',
      status: 'active',
      isVirtual: false,
      userId: ''
    });
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name || '',
      licenseNumber: driver.licenseNumber || '',
      licenseCategory: (driver as any).licenseCategory || 'B',
      licenseExpiry: driver.licenseExpiry || '',
      phone: driver.phone || '',
      status: driver.status || 'active',
      isVirtual: driver.isVirtual || false,
      userId: driver.userId || ''
    });
    setShowForm(true);
  };

  const isExpiring = (expiryDate: string) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    return expiry < today;
  };

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.licenseNumber.includes(searchTerm)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Motoristas</h2>
          <p className="text-slate-400 mt-1">Gerencie os condutores da sua frota e vincule com contas de usuário.</p>
        </div>
        <button 
          onClick={() => { setShowForm(true); setEditingDriver(null); resetForm(); }}
          className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-5 h-5" />
          Novo Motorista
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar por nome ou CNH..."
          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDrivers.map((driver) => (
          <motion.div 
            layout
            key={driver.id}
            className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all flex flex-col relative"
          >
            <div className="p-6 flex-1">
              <div className="flex justify-between items-start mb-4">
                <div className="relative">
                  <div className="bg-slate-800 p-3 rounded-xl group-hover:bg-emerald-500 transition-colors">
                    <User className="w-6 h-6 text-emerald-400 group-hover:text-slate-950 transition-colors" />
                  </div>
                  {driver.isVirtual && (
                    <div className="absolute -top-1 -right-1 bg-ork-accent p-1.5 rounded-full border-2 border-slate-900 shadow-lg">
                      <Sparkles className="w-2.5 h-2.5 text-slate-950" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                   <button 
                    onClick={() => handleEdit(driver)}
                    className="p-2 text-slate-500 hover:text-white transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => driverService.updateDriver(driver.id, { status: driver.status === 'active' ? 'inactive' : 'active' })}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all",
                      driver.status === 'active' ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "bg-slate-500/10 text-slate-500 hover:bg-slate-500/20"
                    )}
                  >
                    {driver.status === 'active' ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-bold text-white">{driver.name}</h3>
                {driver.userId && <UserCheck className="w-4 h-4 text-emerald-400" title="Usuário Vinculado" />}
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm font-medium">CNH: {driver.licenseNumber} {(driver as any).licenseCategory ? `(${(driver as any).licenseCategory})` : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm font-medium">{driver.phone}</span>
                </div>
                {driver.licenseExpiry && (
                  <div className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border",
                    isExpired(driver.licenseExpiry) ? "bg-red-500/10 border-red-500/20 text-red-500" :
                    isExpiring(driver.licenseExpiry) ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                    "bg-slate-800/50 border-slate-700 text-slate-400"
                  )}>
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">
                      Venc. CNH: {formatDate(driver.licenseExpiry)}
                    </span>
                  </div>
                )}
                {driver.isVirtual && (
                  <div className="bg-ork-accent/10 border border-ork-accent/20 text-ork-accent px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    Frota Terceirizada
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-800 flex justify-end">
               <button 
                onClick={() => driverService.deleteDriver(driver.id)}
                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                title="Excluir Motorista"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
        {filteredDrivers.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl">
            <User className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-20" />
            <p className="text-slate-500 font-bold text-sm tracking-widest uppercase">Nenhum motorista encontrado</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl my-auto flex flex-col max-h-[95vh]"
            >
              <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">{editingDriver ? 'Editar' : 'Novo'} Motorista</h2>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Configuração de condutor e frota</p>
                  </div>
                  <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Vincular Usuário de Sistema</label>
                       <div className="relative group">
                         <select 
                           className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-white outline-none focus:border-emerald-500 appearance-none transition-all font-medium pr-10"
                           value={formData.userId}
                           onChange={(e) => {
                             const selected = users.find(u => u.uid === e.target.value);
                             setFormData({
                               ...formData, 
                               userId: e.target.value,
                               name: selected ? (selected.name || selected.email.split('@')[0]) : formData.name
                             });
                           }}
                         >
                           <option value="" className="text-slate-900">Nenhum Usuário Vinculado</option>
                           {users.filter(u => u.status !== 'inactive').map(u => (
                             <option key={u.uid} value={u.uid} className="text-slate-900">
                               {u.name || u.email.split('@')[0]} ({u.role === 'admin' ? 'Admin' : 'Motorista'})
                             </option>
                           ))}
                         </select>
                         <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none rotate-90" />
                       </div>
                       <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider ml-1 italic">Vincule para permitir acesso ao Portal do Motorista</p>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Status</label>
                       <select 
                         className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-white outline-none focus:border-emerald-500 transition-all font-medium"
                         value={formData.status}
                         onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                       >
                         <option value="active" className="text-slate-900">Ativo</option>
                         <option value="inactive" className="text-slate-900">Inativo</option>
                       </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Nome Completo</label>
                    <input 
                      required
                      placeholder="Ex: João da Silva"
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-white outline-none focus:border-emerald-500 transition-all font-medium"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="flex items-center gap-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-800">
                    <input 
                      type="checkbox" 
                      id="isVirtualDriver"
                      checked={formData.isVirtual}
                      onChange={(e) => setFormData({...formData, isVirtual: e.target.checked})}
                      className="w-5 h-5 accent-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="isVirtualDriver" className="text-xs font-black text-white uppercase tracking-widest cursor-pointer flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-ork-accent" />
                      Motorista Virtual (Terceirizado)
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">CNH</label>
                      <input 
                        required
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-white outline-none focus:border-emerald-500 transition-all font-medium"
                        value={formData.licenseNumber}
                        onChange={e => setFormData({...formData, licenseNumber: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Categoria</label>
                      <select 
                        required
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-white outline-none focus:border-emerald-500 transition-all font-medium"
                        value={formData.licenseCategory}
                        onChange={e => setFormData({...formData, licenseCategory: e.target.value})}
                      >
                        {['A', 'B', 'AB', 'C', 'D', 'E'].map(cat => (
                          <option key={cat} value={cat} className="text-slate-900">{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Vencimento CNH</label>
                      <input 
                        required
                        type="date"
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-white outline-none focus:border-emerald-500 transition-all font-medium"
                        value={formData.licenseExpiry}
                        onChange={e => setFormData({...formData, licenseExpiry: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Telefone</label>
                      <input 
                        required
                        placeholder="(00) 00000-0000"
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-sm text-white outline-none focus:border-emerald-500 transition-all font-medium"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setShowForm(false)} 
                      className="flex-1 py-4 text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black uppercase tracking-widest py-4 rounded-2xl text-xs transition-all shadow-lg shadow-emerald-500/20"
                    >
                      {editingDriver ? 'Salvar Alterações' : 'Cadastrar Motorista'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
