import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { vehicleService, maintenanceService, driverService, fineService, logService, collectionRequestService } from '../lib/services';
import { Vehicle, MaintenanceRecord, MaintenanceSchedule, Driver, Fine, VehicleLog, CollectionRequest } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Car, AlertTriangle, TrendingUp, DollarSign, Calendar, User, CheckCircle2, ChevronDown, Filter, FileText } from 'lucide-react';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { predictNextMaintenance } from '../lib/maintenance-manual';

type DateFilter = 'day' | 'week' | 'month' | 'all' | 'custom';
type FleetFilter = 'all' | 'internal' | 'virtual';

export function DashboardView() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [logs, setLogs] = useState<VehicleLog[]>([]);
  const [requests, setRequests] = useState<CollectionRequest[]>([]);

  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('all');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubVehicles = vehicleService.subscribeToVehicles(setVehicles);
    const unsubRecords = maintenanceService.subscribeToRecords(setRecords);
    const unsubSchedules = maintenanceService.subscribeToSchedules(setSchedules);
    const unsubDrivers = driverService.subscribeToDrivers(setDrivers);
    const unsubFines = fineService.subscribeToFines(setFines);
    const unsubLogs = logService.subscribeToLogs(setLogs);
    const unsubRequests = collectionRequestService.subscribeToRequests(setRequests);
    
    return () => {
      unsubVehicles();
      unsubRecords();
      unsubSchedules();
      unsubDrivers();
      unsubFines();
      unsubLogs();
      unsubRequests();
    };
  }, [user]);

  const urgentMaintenance = useMemo(() => {
    return vehicles.map(v => {
      const createdAtDate = v.createdAt?.toDate ? v.createdAt.toDate() : new Date(v.createdAt || Date.now());
      const prediction = predictNextMaintenance(v.currentMileage, createdAtDate, v.lastMaintenanceKm);
      const diffTime = prediction.predictedDate.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        vehicle: v,
        prediction,
        diffDays
      };
    }).filter(p => p.diffDays >= 0 && p.diffDays <= 7);
  }, [vehicles]);

  const filteredData = useMemo(() => {
    let now = new Date();
    let startDate = new Date();

    if (dateFilter === 'day') {
      startDate.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (dateFilter === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else if (dateFilter === 'custom' && customRange.start) {
      startDate = new Date(customRange.start);
    }

    let endDate = now;
    if (dateFilter === 'custom' && customRange.end) {
      endDate = new Date(customRange.end);
      endDate.setHours(23, 59, 59, 999);
    }

    const checkDateFilters = (d: any) => {
      if (!d) return false;
      if (dateFilter === 'all') return true;
      const date = typeof d === 'object' && d.toDate ? d.toDate() : new Date(d);
      return date >= startDate && date <= endDate;
    };

    // Filter by fleet type logic
    const appliesFleetFilterData = (targetId: string | undefined, type: 'driver' | 'vehicle') => {
      if (fleetFilter === 'all') return true;
      if (!targetId) return false;
      
      let isVirtual = false;
      if (type === 'driver') {
        isVirtual = drivers.find(d => d.id === targetId)?.isVirtual || false;
      } else {
        isVirtual = vehicles.find(v => v.id === targetId)?.isVirtual || false;
      }

      return fleetFilter === 'virtual' ? isVirtual : !isVirtual;
    };

    return {
      requests: requests.filter(r => checkDateFilters(r.createdAt || r.updatedAt) && appliesFleetFilterData(r.assignedDriverId, 'driver')),
      logs: logs.filter(l => checkDateFilters(l.startTime) && appliesFleetFilterData(l.vehicleId, 'vehicle')),
      fines: fines.filter(f => checkDateFilters(f.issueDate) && appliesFleetFilterData(f.vehicleId, 'vehicle')),
      records: records.filter(r => checkDateFilters(r.date) && appliesFleetFilterData(r.vehicleId, 'vehicle')),
      vehicles: vehicles.filter(v => fleetFilter === 'all' ? true : (fleetFilter === 'virtual' ? v.isVirtual : !v.isVirtual))
    };
  }, [requests, logs, fines, records, vehicles, drivers, dateFilter, fleetFilter, customRange]);

  const stats = useMemo(() => {
    const { vehicles: fVehicles, requests: fRequests, fines: fFines, records: fRecords } = filteredData;

    const totalVehicles = fVehicles.length;
    const activeVehicles = fVehicles.filter(v => v.status === 'active').length;
    const totalSpent = fRecords.reduce((acc, r) => acc + r.cost, 0);
    const completedRequests = fRequests.filter(r => r.status === 'completed' || r.status === 'delivered_manual').length;
    const pendingFinesValue = fFines.filter(f => f.status === 'pending').reduce((acc, f) => acc + f.amount, 0);
    
    return { totalVehicles, activeVehicles, totalSpent, completedRequests, pendingFinesValue };
  }, [filteredData]);

  const trendData = useMemo(() => {
    const history: Record<string, { internal: number, virtual: number }> = {};
    const range = dateFilter === 'week' ? 7 : (dateFilter === 'day' ? 1 : 15);
    
    const labels = Array.from({ length: range }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (range - 1 - i));
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });

    labels.forEach(l => history[l] = { internal: 0, virtual: 0 });

    requests.forEach(r => {
      if (r.status !== 'completed' && r.status !== 'delivered_manual') return;
      if (!r.updatedAt) return;
      const date = typeof r.updatedAt === 'object' && r.updatedAt.toDate ? r.updatedAt.toDate() : new Date(r.updatedAt);
      const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      
      if (history[day]) {
        const isVirtual = drivers.find(d => d.id === r.assignedDriverId)?.isVirtual;
        if (isVirtual) history[day].virtual++;
        else history[day].internal++;
      }
    });

    return labels.map(name => ({ 
      name, 
      ...history[name]
    }));
  }, [requests, drivers, dateFilter]);

  const statusData = useMemo(() => [
    { name: 'Operação', value: stats.activeVehicles },
    { name: 'Manutenção', value: filteredData.vehicles.filter(v => v.status === 'maintenance').length },
    { name: 'Inativo', value: filteredData.vehicles.filter(v => v.status === 'inactive').length },
  ], [filteredData.vehicles, stats]);

  const COLORS = ['#7B5CFF', '#2D9CFF', '#00D1B2'];

  return (
    <div className="space-y-8 pb-12">
      {urgentMaintenance.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-6 lg:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 shadow-[0_0_40px_rgba(245,158,11,0.1)] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="p-4 bg-amber-500/20 rounded-2xl shrink-0 border border-amber-500/20 relative z-10">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <div className="relative z-10">
            <h3 className="text-xl font-bold text-amber-500 tracking-tight mb-2">Atenção! Manutenções Urgentes ({urgentMaintenance.length})</h3>
            <p className="text-sm text-ork-text-muted font-medium max-w-2xl">Existem veículos com previsão de manutenção nos próximos 7 dias baseados em projeção inteligente. Acesse o módulo de Manutenção para conferir a validade na agenda.</p>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tighter">Frotas & Atendimentos</h2>
          <p className="text-ork-text-muted mt-1 uppercase tracking-widest text-[10px] font-bold">Monitoramento de Frota Própria e Virtual</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/5 text-[8px] font-black uppercase tracking-widest text-ork-text-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-ork-primary animate-pulse" />
            <span>{requests.length} entradas</span>
          </div>
          <button 
            onClick={async () => {
              const today = new Date().toISOString().split('T')[0];
              const todayReqs = requests.filter(r => {
                const reqDate = r.scheduledDate || (r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt)).toISOString().split('T')[0];
                return reqDate === today;
              });
              const todayLogs = logs.filter(l => {
                const logDate = l.startTime?.toDate ? l.startTime.toDate() : new Date(l.startTime);
                return logDate.toISOString().split('T')[0] === today;
              });
              const { generateDailyPDF } = await import('../lib/reportGenerator');
              generateDailyPDF(today, todayReqs, todayLogs, drivers, user?.displayName || 'Administrador');
            }}
            className="bg-ork-primary/20 border border-ork-primary/30 hover:bg-ork-primary/30 text-ork-primary font-black px-4 py-2.5 rounded-xl uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center gap-2 group shadow-[0_0_20px_rgba(123,92,255,0.1)]"
          >
            <FileText className="w-3.5 h-3.5 text-ork-primary group-hover:scale-110 transition-transform" />
            PDF Hoje
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all",
                showFilters ? "bg-ork-primary text-white border-ork-primary" : "bg-white/5 text-ork-text-muted hover:bg-white/10"
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtros Avançados
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showFilters && "rotate-180")} />
            </button>

            <AnimatePresence>
              {showFilters && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 mt-3 w-[340px] bg-ork-surface border border-ork-border rounded-3xl shadow-2xl z-50 p-6 space-y-6 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-ork-primary/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-[0.2em]">Tipo de Frota</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['all', 'internal', 'virtual'] as FleetFilter[]).map(f => (
                        <button
                          key={f}
                          onClick={() => setFleetFilter(f)}
                          className={cn(
                            "py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                            fleetFilter === f ? "bg-ork-primary border-ork-primary text-white shadow-[0_0_15px_rgba(123,92,255,0.3)]" : "bg-white/5 border-white/5 text-ork-text-muted hover:border-white/10"
                          )}
                        >
                          {f === 'all' ? 'Tudo' : f === 'internal' ? 'Própria' : 'Virtual'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-[0.2em]">Período</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['day', 'week', 'month', 'all', 'custom'] as DateFilter[]).map(d => (
                        <button
                          key={d}
                          onClick={() => setDateFilter(d)}
                          className={cn(
                            "py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                            dateFilter === d ? "bg-ork-primary border-ork-primary text-white shadow-[0_0_15px_rgba(123,92,255,0.3)]" : "bg-white/5 border-white/5 text-ork-text-muted hover:border-white/10"
                          )}
                        >
                          {d === 'day' ? 'Hoje' : d === 'week' ? '7 Dias' : d === 'month' ? 'Mês' : d === 'all' ? 'Tudo' : 'Personalizado'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {dateFilter === 'custom' && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="grid grid-cols-2 gap-3"
                    >
                      <div className="space-y-1.5">
                        <span className="text-[8px] font-bold text-ork-text-muted uppercase tracking-wider ml-1">Início</span>
                        <input 
                          type="date" 
                          className="w-full bg-white/5 border border-white/5 rounded-xl p-2.5 text-[10px] text-white outline-none focus:border-ork-primary transition-all" 
                          value={customRange.start}
                          onChange={e => setCustomRange({...customRange, start: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[8px] font-bold text-ork-text-muted uppercase tracking-wider ml-1">Fim</span>
                        <input 
                          type="date" 
                          className="w-full bg-white/5 border border-white/5 rounded-xl p-2.5 text-[10px] text-white outline-none focus:border-ork-primary transition-all" 
                          value={customRange.end}
                          onChange={e => setCustomRange({...customRange, end: e.target.value})}
                        />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Stats */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: 'Veículos / Terceiros', value: stats.totalVehicles, icon: Car, color: 'text-ork-primary', bg: 'bg-ork-primary/10' },
            { label: 'Atendimentos Coletados', value: stats.completedRequests, icon: CheckCircle2, color: 'text-ork-secondary', bg: 'bg-ork-secondary/10' },
            { label: 'Despesas Processadas', value: formatCurrency(stats.totalSpent), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
            { label: 'Multas no período', value: formatCurrency(stats.pendingFinesValue), icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
          ].map((item, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={item.label}
              className="ork-card group hover:scale-[1.02] transition-transform cursor-pointer border-white/5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-3 rounded-2xl", item.bg)}>
                  <item.icon className={cn("w-6 h-6", item.color)} />
                </div>
              </div>
              <p className="text-ork-text-muted text-[10px] font-bold uppercase tracking-widest">{item.label}</p>
              <h4 className="text-2xl font-bold text-white mt-1">{item.value}</h4>
            </motion.div>
          ))}
        </div>

        {/* Fleet Distribution */}
        <div className="lg:col-span-2 ork-card relative bg-ork-surface border-white/5 overflow-hidden">
          <h3 className="text-sm font-bold text-white mb-8 uppercase tracking-widest relative z-10">Status da Frota em Operação</h3>
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="h-[220px] w-[220px] shrink-0 relative">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-white">{stats.totalVehicles}</span>
                <span className="text-[10px] text-ork-text-muted font-bold uppercase tracking-widest">Unidades</span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={10}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((item, index) => (
                      <Cell key={`cell-dash-${item.name}`} fill={COLORS[index % COLORS.length]} className="outline-none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E1E26', border: '1px solid #2D2D3A', borderRadius: '16px' }}
                    itemStyle={{ fontSize: '10px', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-4 w-full">
              {statusData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Line Chart: Internal vs Virtual */}
        <div className="lg:col-span-4 ork-card min-h-[500px] border-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-widest">
              <TrendingUp className="text-ork-primary w-4 h-4" />
              Desempenho: Frota Própria vs Frota Virtual
            </h3>
            <div className="flex gap-6">
               <div className="flex items-center gap-3">
                 <div className="w-2.5 h-2.5 bg-[#7B5CFF] rounded-full shadow-[0_0_10px_rgba(123,92,255,0.5)]"></div>
                 <span className="text-[10px] font-black text-ork-text-muted uppercase tracking-widest">Própria</span>
               </div>
               <div className="flex items-center gap-3">
                 <div className="w-2.5 h-2.5 bg-[#00D1B2] rounded-full shadow-[0_0_10px_rgba(0,209,178,0.5)]"></div>
                 <span className="text-[10px] font-black text-ork-text-muted uppercase tracking-widest">Terceirizada</span>
               </div>
            </div>
          </div>
          
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3A" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#8E9299" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#8E9299' }} 
                  dy={10}
                />
                <YAxis 
                  stroke="#8E9299" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#8E9299' }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1E1E26', border: '1px solid #2D2D3A', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                  itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="internal" 
                  name="Própria" 
                  stroke="#7B5CFF" 
                  strokeWidth={4} 
                  dot={{ fill: '#7B5CFF', r: 4, strokeWidth: 2, stroke: '#1E1E26' }} 
                  activeDot={{ r: 7, strokeWidth: 0 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="virtual" 
                  name="Terceirizada" 
                  stroke="#00D1B2" 
                  strokeWidth={4} 
                  dot={{ fill: '#00D1B2', r: 4, strokeWidth: 2, stroke: '#1E1E26' }} 
                  activeDot={{ r: 7, strokeWidth: 0 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Records Summary */}
        <div className="lg:col-span-4 ork-card border-white/5 mt-4">
           <div className="flex items-center justify-between mb-8">
             <h3 className="text-sm font-bold text-white uppercase tracking-widest">Resumo de Atividades Financeiras</h3>
             <span className="text-[10px] font-black text-ork-text-muted bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">Últimos Lançamentos</span>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredData.records.slice(0, 4).length > 0 ? filteredData.records.slice(0, 4).map(r => (
                <div key={r.id} className="p-5 bg-white/[0.03] border border-white/5 rounded-3xl group hover:border-ork-primary/30 transition-all">
                   <div className="flex justify-between items-start mb-4">
                     <p className="text-[9px] font-black text-ork-primary uppercase tracking-widest">{vehicles.find(v => v.id === r.vehicleId)?.plate || 'Virtual'}</p>
                     <p className="text-[8px] font-bold text-ork-text-muted">{formatDate(r.date)}</p>
                   </div>
                   <h5 className="text-[11px] font-bold text-white uppercase truncate mb-4">{r.description}</h5>
                   <div className="flex items-center justify-between pt-4 border-t border-white/5">
                     <span className="text-sm font-black text-emerald-400">{formatCurrency(r.cost)}</span>
                   </div>
                </div>
              )) : (
                <div className="col-span-full py-12 text-center text-ork-text-muted text-[10px] font-black uppercase opacity-50 tracking-[0.3em]">
                   Nenhum registro encontrado no filtro
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
