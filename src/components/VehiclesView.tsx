import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { vehicleService } from '../lib/services';
import { Vehicle } from '../types';
import { Plus, Search, Settings2, Trash2, Calendar, ShieldCheck, AlertCircle, Car } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { serverTimestamp } from 'firebase/firestore';

import { ivecoModels } from '../lib/maintenance-manual';

export function VehiclesView() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    currentMileage: 0,
    lastMaintenanceKm: 0,
    status: 'active' as const,
    isVirtual: false
  });

  useEffect(() => {
    if (!user) return;
    return vehicleService.subscribeToVehicles(setVehicles);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (editingVehicle) {
      const updates: any = { ...formData };
      
      if (formData.status === 'maintenance' && editingVehicle.status !== 'maintenance') {
        updates.maintenanceStartDate = serverTimestamp();
      } else if (formData.status !== 'maintenance') {
        updates.maintenanceStartDate = null;
      }
      
      await vehicleService.updateVehicle(editingVehicle.id, updates);
      setEditingVehicle(null);
    } else {
      const data = {
        ...formData,
        maintenanceStartDate: formData.status === 'maintenance' ? serverTimestamp() : null
      };
      await vehicleService.addVehicle(data, user.uid);
      setShowAddForm(false);
    }
    
    resetForm();
  };

  const resetForm = () => {
    setFormData({ plate: '', brand: '', model: '', year: new Date().getFullYear(), currentMileage: 0, lastMaintenanceKm: 0, status: 'active', isVirtual: false });
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      currentMileage: vehicle.currentMileage,
      lastMaintenanceKm: vehicle.lastMaintenanceKm || 0,
      status: vehicle.status,
      isVirtual: vehicle.isVirtual || false
    });
  };

  const calculateMaintenanceDays = (startDate: any) => {
    if (!startDate) return 0;
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
    const diffTime = Math.abs(new Date().getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const filteredVehicles = vehicles.filter(v => 
    v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tighter">Frota</h2>
          <p className="text-ork-text-muted mt-1 uppercase tracking-widest text-[10px] font-bold">Gerenciamento de veículos e ativos</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="ork-button-primary flex items-center gap-2"
          id="btn-add-vehicle"
        >
          <Plus className="w-5 h-5" />
          Novo Veículo
        </button>
      </div>

      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="text-ork-text-muted w-5 h-5 group-focus-within:text-ork-primary transition-colors" />
        </div>
        <input 
          type="text" 
          placeholder="Buscar veículo..."
          className="w-full bg-ork-surface border border-ork-border rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-ork-primary/50 focus:ring-4 focus:ring-ork-primary/10 transition-all font-medium placeholder:text-ork-text-muted"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map((vehicle) => (
          <motion.div 
            layout
            key={vehicle.id}
            className="ork-card flex flex-col relative group overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
              <div className={cn(
                "w-2.5 h-2.5 rounded-full shadow-lg",
                vehicle.status === 'active' ? "bg-ork-accent shadow-ork-accent/20" : 
                vehicle.status === 'maintenance' ? "bg-ork-secondary shadow-ork-secondary/20" :
                "bg-ork-text-muted opacity-50"
              )} />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-ork-primary/10 text-ork-primary font-mono text-[10px] tracking-widest font-black px-3 py-1 rounded-lg border border-ork-primary/20">
                  {vehicle.plate.toUpperCase()}
                </span>
                {vehicle.isVirtual && (
                  <span className="bg-ork-accent/20 text-ork-accent text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-ork-accent/20">
                    Virtual
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white mb-1 group-hover:text-ork-primary transition-colors">{vehicle.model}</h3>
              <p className="text-ork-text-muted text-xs font-medium uppercase tracking-wide">{vehicle.brand} • {vehicle.year}</p>
              
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest mb-1">Quilometragem</p>
                  <p className="text-sm font-bold text-white">{vehicle.currentMileage.toLocaleString()} <span className="text-[10px] font-normal text-ork-text-muted ml-0.5">KM</span></p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest mb-1">Status</p>
                  <p className={cn(
                    "text-[10px] font-black uppercase tracking-widest",
                    vehicle.status === 'active' ? "text-ork-accent" : 
                    vehicle.status === 'maintenance' ? "text-ork-secondary" :
                    "text-ork-text-muted"
                  )}>
                    {vehicle.status === 'active' ? 'Operacional' : 
                     vehicle.status === 'maintenance' ? 'Manutenção' : 'Inativo'}
                  </p>
                </div>
              </div>

              {vehicle.status === 'maintenance' && (
                <div className="mt-4 flex items-center gap-3 bg-ork-secondary/10 border border-ork-secondary/20 rounded-2xl p-4">
                  <Calendar className="w-4 h-4 text-ork-secondary" />
                  <span className="text-[10px] font-black text-ork-secondary uppercase tracking-widest">
                    Pausado há {calculateMaintenanceDays(vehicle.maintenanceStartDate)} dias
                  </span>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end gap-2 pt-6 border-t border-ork-border">
              <button 
                onClick={() => handleEdit(vehicle)}
                className="p-3 text-ork-text-muted hover:text-white hover:bg-white/5 rounded-xl transition-all"
              >
                <Settings2 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => vehicleService.deleteVehicle(vehicle.id)}
                className="p-3 text-ork-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ))}
        {filteredVehicles.length === 0 && (
          <div className="col-span-full py-20 text-center ork-card border-dashed">
            <Car className="w-12 h-12 text-ork-text-muted mx-auto mb-4 opacity-20" />
            <p className="text-ork-text-muted font-bold text-sm tracking-widest uppercase">Nenhum veículo encontrado</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(showAddForm || editingVehicle) && (
          <div className="fixed inset-0 bg-ork-bg/80 backdrop-blur-md z-[70] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="ork-card w-full max-w-lg shadow-[0_0_100px_rgba(123,92,255,0.1)] my-auto max-h-[95vh] flex flex-col"
            >
              <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar">
                <h3 className="text-2xl font-bold text-white mb-1 tracking-tighter">
                  {editingVehicle ? 'Ajustar' : 'Novo'} Veículo
                </h3>
                <p className="text-ork-text-muted text-[10px] font-bold uppercase tracking-widest mb-8">Informações Técnicas do Ativo</p>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">Placa</label>
                      <input 
                        required
                        className="w-full bg-ork-bg border border-ork-border rounded-2xl px-4 py-4 text-white focus:border-ork-primary/50 outline-none transition-all font-medium"
                        value={formData.plate}
                        onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})}
                        placeholder="ABC-1234"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">Marca</label>
                      <input 
                        required
                        className="w-full bg-ork-bg border border-ork-border rounded-2xl px-4 py-4 text-white focus:border-ork-primary/50 outline-none transition-all font-medium"
                        value={formData.brand}
                        onChange={e => setFormData({...formData, brand: e.target.value})}
                        placeholder="Ford"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">Modelo</label>
                    <input 
                      required
                      list="iveco-models"
                      className="w-full bg-ork-bg border border-ork-border rounded-2xl px-4 py-4 text-white focus:border-ork-primary/50 outline-none transition-all font-medium"
                      value={formData.model}
                      onChange={e => setFormData({...formData, model: e.target.value})}
                      placeholder="Ex: 35-160 ou Custom"
                    />
                    <datalist id="iveco-models">
                      {ivecoModels.map(model => (
                        <option key={model} value={model} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">Ano</label>
                      <input 
                        required
                        type="number"
                        className="w-full bg-ork-bg border border-ork-border rounded-2xl px-4 py-4 text-white focus:border-ork-primary/50 outline-none transition-all font-medium"
                        value={formData.year || ''}
                        onChange={e => setFormData({...formData, year: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">Km Atual</label>
                      <input 
                        required
                        type="number"
                        className="w-full bg-ork-bg border border-ork-border rounded-2xl px-4 py-4 text-white focus:border-ork-primary/50 outline-none transition-all font-medium"
                        value={formData.currentMileage || ''}
                        onChange={e => setFormData({...formData, currentMileage: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">Rev. Anterior (Km)</label>
                      <input 
                        type="number"
                        className="w-full bg-ork-bg border border-ork-border rounded-2xl px-4 py-4 text-white focus:border-ork-primary/50 outline-none transition-all font-medium"
                        value={formData.lastMaintenanceKm || ''}
                        onChange={e => setFormData({...formData, lastMaintenanceKm: parseInt(e.target.value) || 0})}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">Estado do Ativo</label>
                    <div className="grid grid-cols-3 gap-2 p-1.5 bg-ork-bg rounded-2xl border border-ork-border">
                      {['active', 'maintenance', 'inactive'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setFormData({...formData, status: status as any})}
                          className={cn(
                            "py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                            formData.status === status 
                              ? "bg-ork-primary text-white shadow-lg shadow-ork-primary/20" 
                              : "text-ork-text-muted hover:text-white"
                          )}
                        >
                          {status === 'active' ? 'Ativo' : status === 'maintenance' ? 'Reparo' : 'Inativo'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingVehicle(null);
                        resetForm();
                      }}
                      className="flex-1 py-4 text-ork-text-muted text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Descartar
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] ork-button-primary uppercase tracking-widest text-xs"
                    >
                      {editingVehicle ? 'Aplicar Mudanças' : 'Confirmar Ativo'}
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
