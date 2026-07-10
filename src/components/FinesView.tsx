import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { fineService, vehicleService, driverService } from '../lib/services';
import { Fine, Vehicle, Driver } from '../types';
import { Plus, Search, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function FinesView() {
  const { user } = useAuth();
  const [fines, setFines] = useState<Fine[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    vehicleId: '',
    driverId: '',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    description: '',
    status: 'pending' as const
  });

  useEffect(() => {
    if (!user) return;
    const unsubFines = fineService.subscribeToFines(setFines);
    const unsubVehicles = vehicleService.subscribeToVehicles(setVehicles);
    const unsubDrivers = driverService.subscribeToDrivers(setDrivers);
    
    return () => {
      unsubFines();
      unsubVehicles();
      unsubDrivers();
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await fineService.addFine(formData, user.uid);
    setShowAddForm(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      vehicleId: '',
      driverId: '',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      description: '',
      status: 'pending'
    });
  };

  const getVehiclePlate = (id: string) => {
    const v = vehicles.find(v => v.id === id);
    return v ? v.plate.toUpperCase() : '---';
  };

  const getDriverName = (id: string) => {
    const d = drivers.find(d => d.id === id);
    return d ? d.name : '---';
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Multas</h2>
          <p className="text-slate-400 mt-1">Controle de infrações de trânsito e status de pagamento.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-red-500/20"
        >
          <Plus className="w-5 h-5" />
          Registrar Multa
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-bottom border-slate-800 bg-slate-950/30">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Veículo</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Motorista</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {fines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Nenhuma multa registrada.</td>
                </tr>
              ) : fines.map((fine) => (
                <tr key={fine.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4 text-sm whitespace-nowrap">{formatDate(fine.date)}</td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-800 text-white font-mono text-[10px] px-2 py-1 rounded border border-slate-700">
                      {getVehiclePlate(fine.vehicleId)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-white font-medium">{getDriverName(fine.driverId)}</td>
                  <td className="px-6 py-4 text-xs text-slate-400 max-w-xs truncate">{fine.description}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-[10px] uppercase font-black px-2 py-0.5 rounded-full",
                      fine.status === 'paid' ? "bg-emerald-500/10 text-emerald-500" :
                      fine.status === 'appealing' ? "bg-amber-500/10 text-amber-500" :
                      "bg-red-500/10 text-red-500"
                    )}>
                      {fine.status === 'paid' ? 'Paga' : fine.status === 'appealing' ? 'Em Recurso' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-white text-right">{formatCurrency(fine.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl my-auto flex flex-col max-h-[95vh]"
            >
              <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar">
                <h2 className="text-2xl font-bold text-white mb-6">Registrar Multa</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Veículo</label>
                      <select 
                        required
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                        value={formData.vehicleId}
                        onChange={e => setFormData({...formData, vehicleId: e.target.value})}
                      >
                        <option value="">Selecione</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Motorista</label>
                      <select 
                        required
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                        value={formData.driverId}
                        onChange={e => setFormData({...formData, driverId: e.target.value})}
                      >
                        <option value="">Selecione</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data da Infração</label>
                      <input 
                        required
                        type="date"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor (R$)</label>
                      <input 
                        required
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                        value={formData.amount || ''}
                        onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição da Infração</label>
                    <textarea 
                      required
                      placeholder="Ex: Excesso de velocidade (Art. 218)..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none min-h-[100px]"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  <div className="flex gap-3 pt-6">
                    <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 px-6 py-4 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 px-6 py-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all">Salvar</button>
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
