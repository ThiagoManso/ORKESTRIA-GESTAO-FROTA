import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { collectionRequestService, driverService } from '../lib/services';
import { CollectionRequest, Driver } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Send, CheckCircle2, XCircle, Clock, TrendingUp, Users, MapPin, Filter, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

type DateFilter = 'day' | 'week' | 'month' | 'custom';
type FleetFilter = 'all' | 'internal' | 'virtual';

export function CollectionsDashboardView() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<CollectionRequest[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('all');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubRequests = collectionRequestService.subscribeToRequests(setRequests);
    const unsubDrivers = driverService.subscribeToDrivers(setDrivers);
    return () => {
      unsubRequests();
      unsubDrivers();
    };
  }, [user]);

  const filteredRequests = useMemo(() => {
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

    return requests.filter(r => {
      // Date filtering
      const timestamp = r.createdAt || r.updatedAt;
      if (!timestamp) return false;
      const date = typeof timestamp === 'object' && timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const matchesDate = date >= startDate && date <= endDate;
      
      if (!matchesDate) return false;

      // Fleet filtering
      if (fleetFilter === 'all') return true;
      const driver = drivers.find(d => d.id === r.assignedDriverId);
      const isVirtual = driver?.isVirtual || false;
      return fleetFilter === 'virtual' ? isVirtual : !isVirtual;
    });
  }, [requests, drivers, dateFilter, fleetFilter, customRange]);

  const stats = useMemo(() => {
    const total = filteredRequests.length;
    const completed = filteredRequests.filter(r => r.status === 'completed' || r.status === 'delivered_manual').length;
    const refused = filteredRequests.filter(r => r.status === 'refused').length;
    const pending = filteredRequests.filter(r => r.status === 'pending' || r.status === 'assigned').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, refused, pending, completionRate };
  }, [filteredRequests]);

  const dailyData = useMemo(() => {
    const days: Record<string, number> = {};
    const range = dateFilter === 'week' ? 7 : (dateFilter === 'day' ? 1 : (dateFilter === 'month' ? 30 : 15));
    
    const labels = Array.from({ length: range }).map((_, i) => {
      const d = new Date();
      if (dateFilter === 'custom' && customRange.end) {
        const customEnd = new Date(customRange.end);
        d.setTime(customEnd.getTime());
      }
      d.setDate(d.getDate() - (range - 1 - i));
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });

    labels.forEach(l => days[l] = 0);

    filteredRequests.filter(r => r.status === 'completed' || r.status === 'delivered_manual').forEach(r => {
      const timestamp = r.updatedAt || r.createdAt;
      if (!timestamp) return;
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const d = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (days[d] !== undefined) days[d]++;
    });

    return labels.map(name => ({ name, count: days[name] }));
  }, [filteredRequests, dateFilter, customRange]);

  const driverData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRequests.filter(r => r.status === 'completed' || r.status === 'delivered_manual').forEach(r => {
      const driver = drivers.find(d => d.id === r.assignedDriverId);
      if (driver) {
        counts[driver.name] = (counts[driver.name] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredRequests, drivers]);

  const COLORS = ['#7B5CFF', '#2D9CFF', '#00D1B2', '#F59E0B', '#EF4444'];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tighter uppercase transition-all">Dashboard de Coletas</h2>
          <p className="text-ork-text-muted mt-1 uppercase tracking-widest text-[8px] sm:text-[10px] font-bold">Métricas de Performance Logística</p>
        </div>
        
        <div className="flex items-center gap-3">
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
                    <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-[0.2em]">Período de Análise</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['day', 'week', 'month', 'custom'] as DateFilter[]).map(d => (
                        <button
                          key={d}
                          onClick={() => setDateFilter(d)}
                          className={cn(
                            "py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                            dateFilter === d ? "bg-ork-primary border-ork-primary text-white shadow-[0_0_15px_rgba(123,92,255,0.3)]" : "bg-white/5 border-white/5 text-ork-text-muted hover:border-white/10"
                          )}
                        >
                          {d === 'day' ? 'Hoje' : d === 'week' ? '7 Dias' : d === 'month' ? 'Mês' : 'Personalizado'}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Solicitado', value: stats.total, icon: Send, color: 'text-ork-primary', bg: 'bg-ork-primary/10' },
          { label: 'Concluídas', value: stats.completed, icon: CheckCircle2, color: 'text-ork-accent', bg: 'bg-ork-accent/10' },
          { label: 'Taxa de Sucesso', value: `${stats.completionRate}%`, icon: TrendingUp, color: 'text-ork-secondary', bg: 'bg-ork-secondary/10' },
          { label: 'Recusas', value: stats.refused, icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
        ].map((item, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={item.label}
            className="ork-card"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl", item.bg)}>
                <item.icon className={cn("w-5 h-5", item.color)} />
              </div>
            </div>
            <p className="text-ork-text-muted text-[10px] font-black uppercase tracking-widest leading-none">{item.label}</p>
            <h4 className="text-2xl font-bold text-white mt-2">{item.value}</h4>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="ork-card">
          <h3 className="text-sm font-bold text-white mb-8 flex items-center gap-2 uppercase tracking-widest">
            <TrendingUp className="text-ork-primary w-4 h-4" />
            Fluxo de Coletas (Diário)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3A" vertical={false} />
                <XAxis dataKey="name" stroke="#8E9299" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                <YAxis stroke="#8E9299" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1E1E26', border: '1px solid #2D2D3A', borderRadius: '16px' }}
                  itemStyle={{ color: '#7B5CFF' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#7B5CFF" 
                  strokeWidth={4} 
                  dot={{ r: 4, fill: '#7B5CFF', strokeWidth: 2 }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ork-card">
          <h3 className="text-sm font-bold text-white mb-8 uppercase tracking-widest flex items-center gap-2">
            <Users className="text-ork-secondary w-4 h-4" />
            Top Motoristas (Coletas)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driverData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3A" horizontal={false} />
                <XAxis type="number" stroke="#8E9299" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" stroke="#8E9299" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1E1E26', border: '1px solid #2D2D3A', borderRadius: '16px' }}
                  cursor={{ fill: 'rgba(123, 92, 255, 0.05)' }}
                />
                <Bar dataKey="value" fill="#2D9CFF" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 ork-card">
          <h3 className="text-sm font-bold text-white mb-8 flex items-center gap-2 uppercase tracking-widest">
            <MapPin className="text-ork-accent w-4 h-4" />
            Status da Fila Atual
          </h3>
          <div className="space-y-4">
             {filteredRequests.filter(r => r.status !== 'completed' && r.status !== 'delivered_manual').slice(0, 5).map(req => (
               <div key={req.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                 <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      req.status === 'assigned' ? "bg-ork-secondary animate-pulse" :
                      req.status === 'refused' ? "bg-red-500" : "bg-ork-text-muted"
                    )} />
                    <div>
                      <p className="text-xs font-bold text-white mb-0.5">{req.title}</p>
                      <p className="text-[10px] text-ork-text-muted uppercase tracking-widest">{req.address}</p>
                    </div>
                 </div>
                 <div className="text-[10px] font-black text-ork-primary uppercase tracking-widest">
                   {req.status === 'assigned' ? 'Em Rota' : req.status === 'refused' ? 'Recusada' : 'Aguardando'}
                 </div>
               </div>
             ))}
             {filteredRequests.filter(r => r.status !== 'completed' && r.status !== 'delivered_manual').length === 0 && (
               <p className="text-center text-ork-text-muted text-xs py-8 italic uppercase tracking-widest">Fila limpa no período</p>
             )}
          </div>
        </div>

        <div className="ork-card flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative">
             <div className="w-24 h-24 rounded-full border-8 border-ork-accent/20 border-t-ork-accent animate-spin" />
             <div className="absolute inset-0 flex items-center justify-center">
               <span className="text-2xl font-black text-white">{stats.completionRate}%</span>
             </div>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-widest">Eficiência Geral</h4>
            <p className="text-[10px] text-ork-text-muted mt-1">Percentual de coletas aceitas e concluídas sem reatribuição.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
