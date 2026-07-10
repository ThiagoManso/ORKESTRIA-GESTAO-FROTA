import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { vehicleService, maintenanceService } from '../lib/services';
import { Vehicle, MaintenanceRecord, MaintenanceSchedule } from '../types';
import { Plus, Calendar as CalendarIcon, Trash2, Droplets, CheckCircle2, Zap, ChevronLeft, ChevronRight, AlertTriangle, Info } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { predictNextMaintenance } from '../lib/maintenance-manual';

interface MaintenanceViewProps {
  initialView?: 'records' | 'schedules';
}

export function MaintenanceView({ initialView = 'records' }: MaintenanceViewProps) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [currentSubView, setCurrentSubView] = useState(initialView);
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Form states
  const [recordForm, setRecordForm] = useState({
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'preventive' as const,
    description: '',
    cost: 0,
    mileageAtService: 0,
    washedVehicle: false
  });

  const [scheduleForm, setScheduleForm] = useState({
    vehicleId: '',
    serviceType: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    targetMileage: 0,
    status: 'pending' as const,
    estimatedDowntimeDays: 0,
    suggestedServices: [] as string[],
    suggestedParts: [] as string[],
    dailyAverageKm: 0
  });

  useEffect(() => {
    if (!user) return;
    const unsubVehicles = vehicleService.subscribeToVehicles(setVehicles);
    const unsubRecords = maintenanceService.subscribeToRecords(setRecords);
    const unsubSchedules = maintenanceService.subscribeToSchedules(setSchedules);
    
    return () => {
      unsubVehicles();
      unsubRecords();
      unsubSchedules();
    };
  }, [user]);

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await maintenanceService.addRecord(recordForm, user.uid);
    setShowAddForm(false);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await maintenanceService.addSchedule(scheduleForm, user.uid);
    setShowAddForm(false);
  };

  const handleVehicleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vid = e.target.value;
    const v = vehicles.find(v => v.id === vid);

    if (currentSubView === 'records') {
      setRecordForm({...recordForm, vehicleId: vid});
    } else {
      if (v) {
        // Run prediction
        const createdAtDate = v.createdAt?.toDate ? v.createdAt.toDate() : new Date(v.createdAt || Date.now());
        const prediction = predictNextMaintenance(v.currentMileage, createdAtDate, v.lastMaintenanceKm);
        
        setScheduleForm({
          ...scheduleForm,
          vehicleId: vid,
          serviceType: prediction.services.join(', ') || 'Revisão Padrão',
          scheduledDate: prediction.predictedDate.toISOString().split('T')[0],
          targetMileage: prediction.nextMileage,
          estimatedDowntimeDays: prediction.estimatedDowntimeDays,
          suggestedServices: prediction.services,
          suggestedParts: prediction.parts,
          dailyAverageKm: prediction.dailyAverageKm
        });
      } else {
        setScheduleForm({...scheduleForm, vehicleId: vid});
      }
    }
  };

  const getVehicleDisplay = (id: string) => {
    const v = vehicles.find(v => v.id === id);
    return v ? `${v.plate} - ${v.brand} ${v.model}` : 'Veículo não encontrado';
  };

  const getVehicle = (id: string) => vehicles.find(v => v.id === id);

  // Previsões de manutenção (estimadas para o calendário)
  const virtualSchedules = vehicles.map(v => {
    const createdAtDate = v.createdAt?.toDate ? v.createdAt.toDate() : new Date(v.createdAt || Date.now());
    const prediction = predictNextMaintenance(v.currentMileage, createdAtDate, v.lastMaintenanceKm);
    
    return {
      id: `virtual-${v.id}`,
      vehicleId: v.id,
      serviceType: `Previsão: Rev. ${prediction.nextMileage / 1000}k`,
      scheduledDate: prediction.predictedDate.toISOString().split('T')[0],
      targetMileage: prediction.nextMileage,
      status: 'virtual' as any,
      estimatedDowntimeDays: prediction.estimatedDowntimeDays,
      suggestedServices: prediction.services,
      suggestedParts: prediction.parts,
      dailyAverageKm: prediction.dailyAverageKm,
      isVirtual: true,
      vehicle: v
    };
  });

  const allEvents = [...schedules, ...virtualSchedules];

  const urgentPredictions = virtualSchedules.filter(s => {
    const diffTime = new Date(s.scheduledDate).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  // Calendar Helpers
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const prefixDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return allEvents.filter(e => e.scheduledDate === dateStr);
  };

  const openEventDetails = (event: any) => {
    setSelectedEvent(event);
  };

  return (
    <div className="space-y-8">
      {urgentPredictions.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-4"
        >
          <div className="p-2 bg-amber-500/20 rounded-lg shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="text-amber-500 font-bold mb-1">Atenção! Próximas de Vencer ({urgentPredictions.length})</h3>
            <p className="text-sm text-slate-300">Veículos com previsão de manutenção nos próximos 7 dias. Organize o fluxo para não prejudicar as operações.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {urgentPredictions.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setCurrentSubView('schedules');
                    setSelectedEvent(p);
                  }}
                  className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold transition-colors"
                >
                  {p.vehicle?.plate} - {p.serviceType}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Manutenção</h2>
          <p className="text-slate-400 mt-1">Controle históricos e agendamentos da frota.</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex">
            <button 
              onClick={() => setCurrentSubView('records')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                currentSubView === 'records' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Histórico
            </button>
            <button 
              onClick={() => setCurrentSubView('schedules')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                currentSubView === 'schedules' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Agenda
            </button>
          </div>
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5" />
            Novo Registro
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        {currentSubView === 'records' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-bottom border-slate-800 bg-slate-950/30">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Veículo</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Lavagem</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Custo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">Nenhum registro de manutenção encontrado.</td>
                  </tr>
                ) : records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-6 py-4 text-sm whitespace-nowrap">{formatDate(record.date)}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">{getVehicleDisplay(record.vehicleId)}</div>
                      <div className="text-xs text-slate-500">{record.mileageAtService.toLocaleString()} km</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[10px] uppercase font-black px-2 py-0.5 rounded-full",
                        record.type === 'preventive' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                      )}>
                        {record.type === 'preventive' ? 'Preventiva' : 'Corretiva'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">{record.description}</td>
                    <td className="px-6 py-4 text-center">
                      {record.washedVehicle ? (
                        <div className="flex justify-center">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" title="Veículo Lavado" />
                        </div>
                      ) : (
                        <span className="text-slate-700">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-white text-right">{formatCurrency(record.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white capitalize">
                {currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button onClick={nextMonth} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-xl overflow-hidden border border-slate-800">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="bg-slate-900 py-3 text-center text-xs font-bold text-slate-500 uppercase">
                  {d}
                </div>
              ))}
              
              {prefixDays.map(d => (
                <div key={`empty-${d}`} className="bg-slate-950/50 min-h-[100px] p-2" />
              ))}
              
              {days.map(day => {
                const dayEvents = getEventsForDay(day);
                const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth.getMonth() && new Date().getFullYear() === currentMonth.getFullYear();

                return (
                  <div key={day} className="bg-slate-900 min-h-[100px] p-2 border-t border-slate-800/50 flex flex-col gap-1 transition-colors hover:bg-slate-800/50">
                    <span className={cn(
                      "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                      isToday ? "bg-emerald-500 text-slate-900" : "text-slate-400"
                    )}>
                      {day}
                    </span>
                    {dayEvents.map(event => (
                      <button
                        key={event.id}
                        onClick={() => openEventDetails(event)}
                        className={cn(
                          "text-left text-[10px] p-1.5 rounded-md truncate w-full transition-colors font-medium border border-transparent",
                          event.isVirtual 
                            ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:border-amber-500/30" 
                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/30"
                        )}
                      >
                        {getVehicle(event.vehicleId)?.plate}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl my-auto flex flex-col max-h-[95vh]"
          >
            <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar">
              <h3 className="text-2xl font-bold text-white mb-6">
                {currentSubView === 'records' ? 'Registrar Manutenção' : 'Agendar Manutenção'}
              </h3>
              
              {currentSubView === 'records' ? (
                <form onSubmit={handleRecordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Veículo</label>
                    <select 
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                      value={recordForm.vehicleId}
                      onChange={handleVehicleSelect}
                    >
                      <option value="">Selecione um veículo</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</label>
                      <input 
                        type="date"
                        required
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                        value={recordForm.date}
                        onChange={e => setRecordForm({...recordForm, date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</label>
                      <select 
                        required
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                        value={recordForm.type}
                        onChange={e => setRecordForm({...recordForm, type: e.target.value as any})}
                      >
                        <option value="preventive">Preventiva</option>
                        <option value="corrective">Corretiva</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</label>
                    <textarea 
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none min-h-[100px]"
                      value={recordForm.description}
                      onChange={e => setRecordForm({...recordForm, description: e.target.value})}
                      placeholder="Relate o serviço executado..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Custo (R$)</label>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                        value={recordForm.cost || ''}
                        onChange={e => setRecordForm({...recordForm, cost: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Km no Serviço</label>
                      <input 
                        type="number"
                        required
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                        value={recordForm.mileageAtService || ''}
                        onChange={e => setRecordForm({...recordForm, mileageAtService: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setRecordForm({...recordForm, washedVehicle: !recordForm.washedVehicle})}
                      className={cn(
                        "w-10 h-6 rounded-full transition-all relative",
                        recordForm.washedVehicle ? "bg-emerald-500" : "bg-slate-700"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                        recordForm.washedVehicle ? "right-1" : "left-1"
                      )} />
                    </button>
                    <div className="flex items-center gap-2">
                      <Droplets className={cn("w-4 h-4", recordForm.washedVehicle ? "text-emerald-400" : "text-slate-500")} />
                      <span className={cn("text-sm font-medium", recordForm.washedVehicle ? "text-white" : "text-slate-400")}>
                        Veículo Lavado Durante Manutenção
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6">
                    <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 px-6 py-4 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 px-6 py-4 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-600 transition-all">Salvar Registro</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleScheduleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Veículo</label>
                    <select 
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                      value={scheduleForm.vehicleId}
                      onChange={handleVehicleSelect}
                    >
                      <option value="">Selecione um veículo</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                      ))}
                    </select>
                  </div>

                  {scheduleForm.vehicleId && scheduleForm.suggestedServices.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Previsão Inteligente</h4>
                      </div>
                      <p className="text-xs text-emerald-500/80 mb-3">
                        Baseado no manual e na média de <strong>{scheduleForm.dailyAverageKm} km/dia</strong> do veículo.
                      </p>
                      <div className="space-y-2">
                        {scheduleForm.suggestedServices.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest mb-1">Serviços Sugeridos</p>
                            <div className="flex flex-wrap gap-1">
                              {scheduleForm.suggestedServices.map((s, i) => (
                                <span key={i} className="text-[10px] px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {scheduleForm.suggestedParts.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest mb-1">Peças Padrão</p>
                            <div className="flex flex-wrap gap-1">
                              {scheduleForm.suggestedParts.map((p, i) => (
                                <span key={i} className="text-[10px] px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md">
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {scheduleForm.estimatedDowntimeDays > 0 && (
                          <div className="pt-2 border-t border-emerald-500/10 mt-2">
                            <p className="text-xs font-semibold text-emerald-400">
                              Tempo Estimado Parado: {scheduleForm.estimatedDowntimeDays} {scheduleForm.estimatedDowntimeDays === 1 ? 'dia' : 'dias'}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo de Serviço</label>
                    <input 
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                      value={scheduleForm.serviceType}
                      onChange={e => setScheduleForm({...scheduleForm, serviceType: e.target.value})}
                      placeholder="Ex: Troca de óleo, Revisão de 20k, etc."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Prevista</label>
                      <input 
                        type="date"
                        required
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                        value={scheduleForm.scheduledDate}
                        onChange={e => setScheduleForm({...scheduleForm, scheduledDate: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Km Alvo (opcional)</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                        value={scheduleForm.targetMileage || ''}
                        onChange={e => setScheduleForm({...scheduleForm, targetMileage: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6">
                    <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 px-6 py-4 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 px-6 py-4 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-600 transition-all">Agendar Serviço</button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {selectedEvent && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[80] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl my-auto p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Detalhes do Agendamento</h3>
              <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-xs text-slate-500 uppercase font-black tracking-wider mb-1">Veículo</p>
                <p className="text-lg font-bold text-white">{getVehicle(selectedEvent.vehicleId)?.plate}</p>
                <p className="text-sm text-slate-400">{getVehicle(selectedEvent.vehicleId)?.brand} {getVehicle(selectedEvent.vehicleId)?.model}</p>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarIcon className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm font-bold text-emerald-400">{formatDate(selectedEvent.scheduledDate)}</p>
                </div>
                <p className="text-sm text-white font-medium mb-1">{selectedEvent.serviceType}</p>
                {selectedEvent.isVirtual && (
                  <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider bg-amber-500/10 px-2 py-1 rounded inline-block mt-2">
                    Sugestão Automática
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider mb-1">Expectativa KM</p>
                  <p className="text-lg font-bold text-white">{selectedEvent.targetMileage?.toLocaleString()} km</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider mb-1">Tempo Parado</p>
                  <p className="text-lg font-bold text-white">{selectedEvent.estimatedDowntimeDays || 0} dias</p>
                </div>
              </div>

              {selectedEvent.suggestedServices?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase font-black tracking-wider mb-2">Serviços Previstos</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.suggestedServices.map((s: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-1 bg-slate-800 text-slate-300 rounded-md border border-slate-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedEvent.suggestedParts?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase font-black tracking-wider mb-2">Peças Sugeridas</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.suggestedParts.map((p: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-1 bg-slate-800 text-slate-300 rounded-md border border-slate-700">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!selectedEvent.isVirtual && (
                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button 
                    onClick={() => {
                      maintenanceService.deleteSchedule(selectedEvent.id);
                      setSelectedEvent(null);
                    }}
                    className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-sm font-bold transition-colors border border-red-500/20"
                  >
                    Excluir Manual
                  </button>
                </div>
              )}
              {selectedEvent.isVirtual && (
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Este evento é atualizado dinamicamente pelo uso diário ({selectedEvent.dailyAverageKm} km/dia).
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
