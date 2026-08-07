import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, TrendingUp, Users, MapPin, CheckCircle, Clock, AlertTriangle, Truck, Activity, CheckSquare, Eye, Search, Filter, X, Camera, Download } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useCollection } from '../lib/useCollection';
import { DailyLog, Vehicle, RouteItem, Driver, ExternalRequest } from '../types';
import { downloadPhotoWithOSName } from '../lib/utils';

const CHECKLIST_LABELS: Record<string, string> = {
  extinguisher: 'Extintor de Incêndio (Validade e Carga)',
  tools: 'Ferramentas Obrigatórias (Macaco, Triângulo, Chave)',
  seatbelt: 'Cintos de Segurança',
  tires: 'Estado dos Pneus e Calibragem',
  oil: 'Nível de Óleo do Motor',
  water: 'Nível de Água do Radiador/Arrefecimento',
  brakes: 'Funcionamento dos Freios',
  dashboardLights: 'Luzes do Painel de Instrumentos',
  headlights: 'Faróis e Lanternas',
  turnSignals: 'Setas e Pisca-Alerta',
  brakeLights: 'Luzes de Freio e Ré',
  mirrors: 'Espelhos Retrovisores',
  wipers: 'Limpadores de Para-brisa',
  cleaning: 'Limpeza e Higienização do Veículo',
  doors: 'Portas e Travas',
  structure: 'Estrutura do Baú/Carroceria',
  tieDowns: 'Fitas de Amarração de Carga',
  bodywork: 'Funilaria / Pintura (Sem Avarias Novas)',
};

const StatCard = ({ title, value, icon: Icon, trend, trendLabel, gradientClass }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
      <div className={`p-2.5 rounded-xl ${gradientClass ? gradientClass : 'bg-slate-50 text-slate-600'}`}>
        <Icon size={20} className={gradientClass ? "text-white" : ""} />
      </div>
    </div>
    <div className="text-3xl font-bold text-slate-800 mb-2 mt-auto">{value}</div>
    {trend && (
      <div className="flex items-center text-sm">
        <TrendingUp size={16} className="text-emerald-500 mr-1" />
        <span className="text-emerald-500 font-medium">{trend}</span>
        <span className="text-slate-400 ml-1.5 truncate">{trendLabel}</span>
      </div>
    )}
  </div>
);

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'geral' | 'kpis' | 'stops' | 'checklist_km'>('geral');
  const [dateFilter, setDateFilter] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const navigate = useNavigate();
  const { data: dailyLogs } = useCollection<DailyLog>('dailyLogs');
  const { data: vehicles } = useCollection<Vehicle>('vehicles');
  const { data: routes } = useCollection<RouteItem>('routes');
  const { data: drivers } = useCollection<Driver>('drivers');
  const { data: externalRequests } = useCollection<ExternalRequest>('external_requests');
  const [checklistSearch, setChecklistSearch] = useState('');
  const [checklistStatusFilter, setChecklistStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [selectedLogForModal, setSelectedLogForModal] = useState<DailyLog | null>(null);

  const filteredDailyLogs = (dailyLogs || []).filter(log => {
    const matchesSearch = !checklistSearch || 
      log.driverName?.toLowerCase().includes(checklistSearch.toLowerCase()) ||
      log.vehiclePlate?.toLowerCase().includes(checklistSearch.toLowerCase());
    const matchesStatus = checklistStatusFilter === 'all' || log.status === checklistStatusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const activeLogsCount = (dailyLogs || []).filter(l => l.status === 'active').length;
  const completedLogsCount = (dailyLogs || []).filter(l => l.status === 'completed').length;
  const totalKmRodado = (dailyLogs || []).reduce((acc, l) => {
    if (l.finalKm && l.finalKm > (l.initialKm || 0)) {
      return acc + (l.finalKm - l.initialKm);
    }
    return acc;
  }, 0);
  const checkedVehiclesCount = new Set((dailyLogs || []).map(l => l.vehiclePlate)).size;

  const stats = useMemo(() => {
    const now = new Date();
    let chartDates: Date[] = [];
    
    if (dateFilter === 'today') {
      chartDates = [new Date()];
    } else if (dateFilter === '7days') {
      chartDates = Array.from({length: 7}).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d;
      });
    } else if (dateFilter === '30days') {
      chartDates = Array.from({length: 30}).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        return d;
      });
    } else if (dateFilter === 'this_month') {
      const daysInMonth = now.getDate();
      chartDates = Array.from({length: daysInMonth}).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
        return d;
      });
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate + 'T00:00:00');
      const end = new Date(customEndDate + 'T00:00:00');
      const diffTime = Math.abs(end.getTime() - start.getTime());
      let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 90) diffDays = 90; // limit
      
      chartDates = Array.from({length: diffDays}).map((_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    } else {
      chartDates = Array.from({length: 7}).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d;
      });
    }

    const startObj = chartDates.length > 0 ? new Date(chartDates[0]) : new Date();
    startObj.setHours(0, 0, 0, 0);
    const endObj = chartDates.length > 0 ? new Date(chartDates[chartDates.length - 1]) : new Date();
    endObj.setHours(23, 59, 59, 999);

    const parseStrDate = (dateStr?: string) => {
      if (!dateStr) return new Date(0);
      if (dateStr.toLowerCase() === 'hoje') return new Date();
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
      }
      return new Date(dateStr + 'T12:00:00');
    };

    const periodLogs = (dailyLogs || []).filter(l => {
      const d = parseStrDate(l.date);
      return d >= startObj && d <= endObj;
    });

    const totalKmPeriod = periodLogs.reduce((acc, log) => {
      if (log.finalKm && log.finalKm > (log.initialKm || 0)) {
        return acc + (log.finalKm - (log.initialKm || 0));
      }
      return acc;
    }, 0);

    const completedPeriodLogs = periodLogs.filter(l => l.status === 'completed' && l.finalKm && l.finalKm > (l.initialKm || 0));
    const totalKmAllTime = completedPeriodLogs.reduce((acc, log) => acc + ((log.finalKm || 0) - (log.initialKm || 0)), 0);
    
    const uniqueDrivers = new Set(completedPeriodLogs.map(l => l.driverId || l.driverName)).size;
    const uniqueVehicles = new Set(completedPeriodLogs.map(l => l.vehicleId || l.vehiclePlate)).size;
    
    const avgKmPerDriver = uniqueDrivers > 0 ? Math.round(totalKmAllTime / uniqueDrivers) : 0;
    const avgKmPerVehicle = uniqueVehicles > 0 ? Math.round(totalKmAllTime / uniqueVehicles) : 0;

    const assignedRequestIds = new Set(
      (routes || []).flatMap(r => r.stopDetails?.map(s => s.externalRequestId).filter(Boolean) || [])
    );

    const allStopsRaw = (routes || []).flatMap(r => {
      if (!r.stopDetails) return [];
      return r.stopDetails.map(stop => ({
        ...stop,
        routeId: r.id,
        routeNumber: r.routeNumber?.toString() || '-',
        driverName: r.driver || 'Sem Motorista',
        routeDate: r.date
      }));
    });

    const unassignedStops = (externalRequests || [])
      .filter(req => req.status === 'pending' && !assignedRequestIds.has(req.id))
      .map(req => ({
        id: req.id,
        address: req.address,
        status: 'pending',
        orderNumber: req.orderNumber || req.osNumber,
        customerName: req.requesterName,
        customerPhone: req.contactPhone,
        observation: req.observations,
        routeId: '-',
        routeNumber: '-',
        driverName: 'Não Atribuído',
        routeDate: req.scheduledDate || (typeof req.createdAt === 'string' ? req.createdAt.split('T')[0] : (req.createdAt && typeof (req.createdAt as any).toDate === 'function' ? (req.createdAt as any).toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0])),
        externalRequestId: req.id
      }));

    const combinedStops = [...allStopsRaw, ...unassignedStops];

    const periodStops = combinedStops.filter(s => {
      const d = parseStrDate(s.routeDate);
      return d >= startObj && d <= endObj;
    });

    const totalStops = periodStops.length;
    const completedStops = periodStops.filter(s => s.status === 'completed').length;
    const pendingStops = periodStops.filter(s => s.status === 'pending').length;
    const issueStops = periodStops.filter(s => s.status === 'issue').length;

    const activeDriversCount = (drivers || []).filter(d => d.status === 'active' || d.status === 'on_route').length;
    const activeRoutesCount = (routes || []).filter(r => r.status === 'in_progress').length;
    const slaPercentage = (completedStops + issueStops) > 0 
      ? ((completedStops / (completedStops + issueStops)) * 100).toFixed(1) 
      : '100.0';

    const dynamicDeliveryData = chartDates.map(dateObj => {
      const isoDate = dateObj.toISOString().split('T')[0];
      const localDate = dateObj.toLocaleDateString('pt-BR');
      const stopsOnDate = periodStops.filter(s => 
        s.routeDate === isoDate || 
        s.routeDate === localDate || 
        (s.routeDate && s.routeDate.includes(localDate)) || 
        (s.routeDate?.toLowerCase() === 'hoje' && localDate === new Date().toLocaleDateString('pt-BR'))
      );
      return {
        name: localDate.slice(0, 5), // DD/MM
        success: stopsOnDate.filter(s => s.status === 'completed').length,
        failed: stopsOnDate.filter(s => s.status === 'issue').length
      };
    });

    const dynamicStatusData = [
      { name: 'Entregue', value: completedStops, color: '#10b981' },
      { name: 'Pendente', value: pendingStops, color: '#3b82f6' },
      { name: 'Insucesso', value: issueStops, color: '#ef4444' },
    ].filter(d => d.value > 0);
    
    if (dynamicStatusData.length === 0) {
      dynamicStatusData.push({ name: 'Sem dados no período', value: 1, color: '#e2e8f0' });
    }

    const activeAlerts = periodStops.filter(s => s.status === 'issue').slice(0, 5);

    return {
      totalKmPeriod,
      avgKmPerDriver,
      avgKmPerVehicle,
      totalStops,
      completedStops,
      pendingStops,
      issueStops,
      activeDriversCount,
      activeRoutesCount,
      slaPercentage,
      dynamicDeliveryData,
      dynamicStatusData,
      activeAlerts,
      periodLogs,
      periodStops
    };
  }, [dailyLogs, vehicles, routes, drivers, externalRequests, dateFilter, customStartDate, customEndDate]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Torre de Controle</h1>
          <p className="text-slate-500 text-sm sm:text-base">Acompanhamento em tempo real da sua operação logística.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-end">
          {dateFilter === 'custom' && (
            <div className="flex gap-2 w-full sm:w-auto">
              <input 
                type="date" 
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 shadow-sm flex-1 sm:flex-none" 
              />
              <span className="self-center text-slate-500 text-sm">até</span>
              <input 
                type="date" 
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 shadow-sm flex-1 sm:flex-none" 
              />
            </div>
          )}
          <select 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-white border border-slate-200 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer"
          >
            <option value="today">Hoje</option>
            <option value="7days">Últimos 7 dias</option>
            <option value="30days">Últimos 30 dias</option>
            <option value="this_month">Este mês</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('geral')}
          className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === 'geral' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Visão Geral
          {activeTab === 'geral' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('kpis')}
          className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === 'kpis' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
        >
          KPIs de Frota
          {activeTab === 'kpis' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
        </button>

        <button 
          onClick={() => setActiveTab('stops')}
          className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === 'stops' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Status das Paradas
          {activeTab === 'stops' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('checklist_km')}
          className={`pb-3 font-semibold text-sm transition-colors relative flex items-center gap-2 ${activeTab === 'checklist_km' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <CheckSquare size={16} />
          Checklists & KM (Frota)
          {activeLogsCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
              {activeLogsCount} pendente{activeLogsCount > 1 ? 's' : ''}
            </span>
          )}
          {activeTab === 'checklist_km' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
        </button>
      </div>

      {stats ? (
        <>
          {activeTab === 'geral' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                <StatCard 
                  title="Total de Entregas" 
                  value={stats.completedStops.toString()} 
                  icon={Package} 
                  trend="" 
                  trendLabel="Base Histórica"
                  gradientClass="bg-gradient-to-br from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)]"
                />
                <StatCard 
                  title="Taxa de Sucesso (SLA)" 
                  value={`${stats.slaPercentage}%`} 
                  icon={CheckCircle} 
                  trend="" 
                  trendLabel="Média global"
                />
                <StatCard 
                  title="Entregadores Ativos" 
                  value={stats.activeDriversCount.toString()} 
                  icon={Users} 
                  trend="" 
                  trendLabel="Online / Em rota"
                />
                <StatCard 
                  title="Rotas em Andamento" 
                  value={stats.activeRoutesCount.toString()} 
                  icon={MapPin} 
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6">
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm xl:col-span-3 flex flex-col">
                  <h3 className="text-lg font-semibold text-slate-800 mb-6">Histórico de Ordens de Serviço</h3>
                  <div className="h-72 w-full flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.dynamicDeliveryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-brand-blue)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--color-brand-blue)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                          cursor={{stroke: '#e2e8f0', strokeWidth: 2}}
                        />
                        <Area type="monotone" dataKey="success" name="Sucessos" stroke="var(--color-brand-blue)" strokeWidth={3} fillOpacity={1} fill="url(#colorSuccess)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm xl:col-span-1 flex flex-col">
                  <h3 className="text-lg font-semibold text-slate-800 mb-6">Status das Entregas (Período Selecionado)</h3>
                  <div className="h-48 mb-6 relative">
                     <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.dynamicStatusData}
                          innerRadius={65}
                          outerRadius={85}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {stats.dynamicStatusData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-bold text-slate-800">{stats.totalStops}</span>
                      <span className="text-xs text-slate-500">Pedidos</span>
                    </div>
                  </div>
                  <div className="space-y-4 mt-auto">
                    {stats.dynamicStatusData.map((item: any) => (
                      <div key={item.name} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: item.color }}></div>
                          <span className="text-slate-600 font-medium">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-800">{item.name === 'Sem dados no período' ? '-' : `${((item.value / Math.max(stats.totalStops, 1)) * 100).toFixed(1)}%`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm w-full">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-slate-800">Alertas de Rota (Acareação)</h3>
                  <button onClick={() => navigate('/issues')} className="text-primary text-sm font-medium hover:underline hover:text-primary-hover">Ver todas</button>
                </div>
                
                <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-sm text-slate-500">
                        <th className="pb-3 font-medium">Rota</th>
                        <th className="pb-3 font-medium">Entregador</th>
                        <th className="pb-3 font-medium">Motivo</th>
                        <th className="pb-3 font-medium">Horário</th>
                        <th className="pb-3 font-medium text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {stats.activeAlerts.length > 0 ? stats.activeAlerts.map((alert: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="py-4 font-mono text-slate-700">#{alert.routeNumber || alert.routeId?.slice(0, 8)}</td>
                          <td className="py-4 text-slate-700 font-medium">{alert.driverName || 'Não atribuído'}</td>
                          <td className="py-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 text-red-700 font-medium text-xs">
                              <AlertTriangle size={14} /> Problema na Entrega
                            </span>
                          </td>
                          <td className="py-4 text-slate-500">{alert.routeDate || 'Hoje'}</td>
                          <td className="py-4 text-right">
                            <button onClick={() => navigate('/issues')} className="text-primary font-medium hover:text-primary-hover transition-colors">Ver Detalhes</button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">Nenhum alerta de rota no momento.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : activeTab === 'kpis' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <StatCard 
                  title="KM Rodado no Período" 
                  value={`${stats.totalKmPeriod} km`} 
                  icon={Activity} 
                  gradientClass="bg-gradient-to-br from-indigo-500 to-purple-500"
                />
                <StatCard 
                  title="Média de KM por Entregador" 
                  value={`${stats.avgKmPerDriver} km`} 
                  icon={Users} 
                  gradientClass="bg-gradient-to-br from-blue-500 to-cyan-500"
                />
                <StatCard 
                  title="Média de KM por Veículo" 
                  value={`${stats.avgKmPerVehicle} km`} 
                  icon={Truck} 
                  gradientClass="bg-gradient-to-br from-emerald-500 to-teal-500"
                />
              </div>

              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm w-full">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">Diários de Bordo (Período Selecionado)</h3>
                <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-sm text-slate-500">
                        <th className="pb-3 font-medium">Entregador</th>
                        <th className="pb-3 font-medium">Veículo</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">KM Inicial</th>
                        <th className="pb-3 font-medium">KM Final</th>
                        <th className="pb-3 font-medium text-right">KM Percorrido</th>
                        <th className="pb-3 font-medium text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {stats.periodLogs.length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-slate-500">Nenhum diário registrado no período.</td></tr>
                      ) : (
                        stats.periodLogs.map((log: any) => (
                          <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="py-4 text-slate-700 font-medium">{log.driverName}</td>
                            <td className="py-4 font-mono text-slate-700">{log.vehiclePlate}</td>
                            <td className="py-4">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium text-xs ${log.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                                {log.status === 'completed' ? 'Encerrado' : 'Em Rota'}
                              </span>
                            </td>
                            <td className="py-4 text-slate-600">{log.initialKm}</td>
                            <td className="py-4 text-slate-600">{log.finalKm || '-'}</td>
                            <td className="py-4 text-right font-bold text-slate-700">
                              {log.finalKm && log.finalKm > log.initialKm ? log.finalKm - log.initialKm : 0} km
                            </td>
                            <td className="py-4 text-right">
                              <button
                                onClick={() => setSelectedLogForModal(log)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors shadow-sm"
                                title="Ver Checklist & Vistoria IA"
                              >
                                <Eye size={13} /> Ver Checklist
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'stops' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                <StatCard title="Total de Paradas" value={stats.totalStops} icon={MapPin} gradientClass="bg-gradient-to-br from-slate-500 to-slate-600" />
                <StatCard title="Concluídas" value={stats.completedStops} icon={CheckCircle} gradientClass="bg-gradient-to-br from-emerald-400 to-emerald-500" />
                <StatCard title="Pendentes" value={stats.pendingStops} icon={Clock} gradientClass="bg-gradient-to-br from-amber-400 to-amber-500" />
                <StatCard title="Com Problema" value={stats.issueStops} icon={AlertTriangle} gradientClass="bg-gradient-to-br from-red-400 to-red-500" />
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-lg font-semibold text-slate-800">Detalhamento das Paradas</h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="p-4 font-semibold border-b border-slate-200">Rota / Motorista</th>
                        <th className="p-4 font-semibold border-b border-slate-200">Endereço</th>
                        <th className="p-4 font-semibold border-b border-slate-200">Nº Pedido</th>
                        <th className="p-4 font-semibold border-b border-slate-200">Cliente</th>
                        <th className="p-4 font-semibold border-b border-slate-200">Status</th>
                        <th className="p-4 font-semibold border-b border-slate-200">Observação</th>
                        <th className="p-4 font-semibold border-b border-slate-200 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.periodStops.map((stop: any, index: number) => (
                        <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 align-top">
                            <div className="font-medium text-slate-800">
                              {stop.routeNumber !== '-' ? `Rota #${stop.routeNumber}` : 'Sem Rota'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {stop.driverName} 
                              {stop.routeDate ? ` • ${stop.routeDate}` : ''}
                            </div>
                          </td>
                          <td className="p-4 align-top">
                            <div className="text-sm text-slate-700 max-w-[250px] truncate" title={stop.address}>{stop.address}</div>
                          </td>
                          <td className="p-4 align-top">
                            <span className="text-sm text-slate-600 font-mono">{stop.orderNumber || '-'}</span>
                          </td>
                          <td className="p-4 align-top">
                            <div className="text-sm font-medium text-slate-800">{stop.customerName || '-'}</div>
                            <div className="text-xs text-slate-500">{stop.customerPhone || '-'}</div>
                          </td>
                          <td className="p-4 align-top">
                            {stop.status === 'completed' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200"><CheckCircle size={12} /> Concluído</span>}
                            {stop.status === 'pending' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200"><Clock size={12} /> Pendente</span>}
                            {stop.status === 'issue' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200"><AlertTriangle size={12} /> Problema</span>}
                          </td>
                          <td className="p-4 align-top">
                            <div className="text-xs text-slate-600 max-w-[200px]">
                              {stop.status === 'issue' && stop.issueDescription ? (
                                <span className="text-red-600 font-medium">Problema: {stop.issueDescription}</span>
                              ) : (
                                stop.observation || '-'
                              )}
                            </div>
                          </td>
                          <td className="p-4 align-top text-right">
                            {stop.routeId && stop.routeId !== '-' ? (
                              <button
                                onClick={() => navigate('/routes')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors shadow-sm"
                                title="Abrir Módulo de Rotas"
                              >
                                <MapPin size={13} /> Ir para Rota
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {stats.periodStops.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500 text-sm">
                            Nenhuma parada encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'checklist_km' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* KPIs de Checklist e KM */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                <StatCard 
                  title="Turnos Abertos (Pendentes KM)" 
                  value={activeLogsCount} 
                  icon={AlertTriangle} 
                  gradientClass={activeLogsCount > 0 ? "bg-gradient-to-br from-amber-500 to-orange-500" : "bg-gradient-to-br from-slate-500 to-slate-600"} 
                />
                <StatCard 
                  title="Turnos Encerrados" 
                  value={completedLogsCount} 
                  icon={CheckCircle} 
                  gradientClass="bg-gradient-to-br from-emerald-500 to-teal-500" 
                />
                <StatCard 
                  title="KM Total Rodado" 
                  value={`${totalKmRodado.toLocaleString()} km`} 
                  icon={Activity} 
                  gradientClass="bg-gradient-to-br from-indigo-500 to-purple-500" 
                />
                <StatCard 
                  title="Veículos Inspecionados" 
                  value={checkedVehiclesCount} 
                  icon={Truck} 
                  gradientClass="bg-gradient-to-br from-blue-500 to-cyan-500" 
                />
              </div>

              {/* Toolbar */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-80">
                  <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={checklistSearch}
                    onChange={e => setChecklistSearch(e.target.value)}
                    placeholder="Buscar motorista ou placa..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter size={16} className="text-slate-400 hidden sm:block" />
                  <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                    <button
                      onClick={() => setChecklistStatusFilter('all')}
                      className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${checklistStatusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setChecklistStatusFilter('active')}
                      className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${checklistStatusFilter === 'active' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Pendente KM
                    </button>
                    <button
                      onClick={() => setChecklistStatusFilter('completed')}
                      className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${checklistStatusFilter === 'completed' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Encerrados
                    </button>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Histórico de Checklists & KM da Frota</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Acompanhamento de quilometragem e conformidade na vistoria diária</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="p-4 font-semibold border-b border-slate-200">Motorista & Veículo</th>
                        <th className="p-4 font-semibold border-b border-slate-200">Data do Turno</th>
                        <th className="p-4 font-semibold border-b border-slate-200">KM Inicial</th>
                        <th className="p-4 font-semibold border-b border-slate-200">KM Final</th>
                        <th className="p-4 font-semibold border-b border-slate-200">KM Rodado</th>
                        <th className="p-4 font-semibold border-b border-slate-200">Checklist (Saída)</th>
                        <th className="p-4 font-semibold border-b border-slate-200">Vistoria IA (3 dias)</th>
                        <th className="p-4 font-semibold border-b border-slate-200">Status do Turno</th>
                        <th className="p-4 font-semibold border-b border-slate-200 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredDailyLogs.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-500">
                            Nenhum registro encontrado para os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        filteredDailyLogs.map(log => {
                          const checklistItems = log.checklist ? Object.values(log.checklist) : [];
                          const okCount = checklistItems.filter(Boolean).length;
                          const totalCount = checklistItems.length || 18;
                          const kmRodado = (log.finalKm && log.finalKm > log.initialKm) ? log.finalKm - log.initialKm : 0;

                          return (
                            <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-4">
                                <div className="font-bold text-slate-800">{log.driverName}</div>
                                <div className="font-mono text-xs text-slate-500 font-semibold mt-0.5">{log.vehiclePlate}</div>
                              </td>
                              <td className="p-4 font-medium text-slate-700">
                                {log.date ? log.date.split('-').reverse().join('/') : '-'}
                              </td>
                              <td className="p-4 font-mono text-slate-600 font-medium">
                                {log.initialKm} km
                              </td>
                              <td className="p-4 font-mono text-slate-800 font-bold">
                                {log.finalKm ? `${log.finalKm} km` : <span className="text-amber-600 font-sans font-semibold text-xs">Pendente</span>}
                              </td>
                              <td className="p-4">
                                {log.finalKm ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs">
                                    +{kmRodado} km
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${okCount === totalCount ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {okCount}/{totalCount} OK
                                  </span>
                                </div>
                              </td>
                              <td className="p-4">
                                {log.visualInspection ? (
                                  (() => {
                                    const ai = log.visualInspection.aiAssessment;
                                    if (ai?.damageDetected) {
                                      return (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-800 border border-red-200" title={ai.summary}>
                                          <AlertTriangle size={13} /> Divergência / Avaria ({ai.cleanlinessScore}%)
                                        </span>
                                      );
                                    }
                                    if (ai?.cleanlinessStatus === 'necessita_lavagem' || ai?.cleanlinessStatus === 'sujeira_leve') {
                                      return (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200" title={ai.summary}>
                                          <Clock size={13} /> Lavagem Rec. ({ai.cleanlinessScore}%)
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200" title={ai?.summary}>
                                        <CheckCircle size={13} /> Limpo ({ai?.cleanlinessScore || 95}%)
                                      </span>
                                    );
                                  })()
                                ) : (
                                  <span className="text-xs text-slate-400 font-medium">-</span>
                                )}
                              </td>
                              <td className="p-4">
                                {log.status === 'completed' ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                    <CheckCircle size={14} /> Dia Encerrado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                                    <Clock size={14} /> Pendente KM Final
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => setSelectedLogForModal(log)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors shadow-sm"
                                  title="Ver Checklist Completo"
                                >
                                  <Eye size={14} /> Ver Checklist
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedLogForModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-6 fade-in duration-300 max-h-[90vh] flex flex-col">
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/10 rounded-2xl">
                          <CheckSquare size={24} className="text-primary" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">Vistoria Diária & Checklist</h2>
                          <p className="text-slate-300 text-sm mt-0.5">Motorista: {selectedLogForModal.driverName}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedLogForModal(null)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                          <span className="text-xs text-slate-500 font-semibold block uppercase">Veículo</span>
                          <span className="font-mono font-bold text-slate-800 text-base">{selectedLogForModal.vehiclePlate}</span>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                          <span className="text-xs text-slate-500 font-semibold block uppercase">Data</span>
                          <span className="font-bold text-slate-800 text-base">{selectedLogForModal.date ? selectedLogForModal.date.split('-').reverse().join('/') : '-'}</span>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                          <span className="text-xs text-slate-500 font-semibold block uppercase">KM Inicial</span>
                          <span className="font-bold text-slate-800 text-base">{selectedLogForModal.initialKm} KM</span>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                          <span className="text-xs text-slate-500 font-semibold block uppercase">KM Final</span>
                          <span className="font-bold text-slate-800 text-base">{selectedLogForModal.finalKm ? `${selectedLogForModal.finalKm} KM` : 'Pendente'}</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Itens Verificados na Saída</h3>
                          {(() => {
                            const items = selectedLogForModal.checklist ? Object.values(selectedLogForModal.checklist) : [];
                            const okCount = items.filter(Boolean).length;
                            const totalCount = items.length || 18;
                            return (
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${okCount === totalCount ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {okCount} de {totalCount} itens em conformidade
                              </span>
                            );
                          })()}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {selectedLogForModal.checklist && Object.entries(selectedLogForModal.checklist).map(([key, isOk]) => (
                            <div 
                              key={key} 
                              className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium ${isOk ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-red-50/50 border-red-200 text-red-900'}`}
                            >
                              <span>{CHECKLIST_LABELS[key] || key}</span>
                              <span className="flex items-center gap-1">
                                {isOk ? (
                                  <>
                                    <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
                                    <span className="text-xs font-bold text-emerald-700">OK</span>
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
                                    <span className="text-xs font-bold text-red-700">Atenção</span>
                                  </>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {selectedLogForModal.visualInspection ? (
                        <div className="bg-gradient-to-br from-cyan-50/70 to-blue-50/70 border-2 border-brand-cyan/40 rounded-2xl p-4 space-y-4">
                          <div className="flex items-center justify-between border-b border-brand-cyan/20 pb-3">
                            <div className="flex items-center gap-2">
                              <Camera size={18} className="text-brand-cyan" />
                              <h4 className="text-sm font-bold text-slate-800">Comparativo Fotográfico & Parecer IA (3 Dias)</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-600">Índice Limpeza:</span>
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-brand-cyan text-white">
                                {selectedLogForModal.visualInspection.aiAssessment?.cleanlinessScore || 94}%
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {(['front', 'back', 'left', 'right'] as const).map((pos) => {
                              const labels = {
                                front: 'Frente',
                                back: 'Traseira',
                                left: 'Lat. Esquerda',
                                right: 'Lat. Direita'
                              };
                              const vehicleObj = vehicles?.find(v => v.id === selectedLogForModal.vehicleId);
                              const refPhoto = vehicleObj?.referencePhotos?.[pos];
                              const actualPhoto = selectedLogForModal.visualInspection?.photos?.[pos];
                              return (
                                <div key={pos} className="bg-white rounded-xl p-2 border border-slate-200 text-center">
                                  <span className="text-[11px] font-bold text-slate-700 block mb-1">{labels[pos]}</span>
                                  <div className="space-y-1.5">
                                    {refPhoto && (
                                      <div>
                                        <span className="text-[9px] font-semibold text-slate-400 block">Gabarito</span>
                                        <img src={refPhoto} alt="Gabarito" className="w-full h-14 object-cover rounded border border-slate-200" />
                                      </div>
                                    )}
                                    {actualPhoto ? (
                                      <div>
                                        <span className="text-[9px] font-semibold text-emerald-600 block">Capturado</span>
                                        <img src={actualPhoto} alt="Capturado" className="w-full h-16 object-cover rounded border-2 border-emerald-500 mb-1" />
                                        <button
                                          type="button"
                                          onClick={() => downloadPhotoWithOSName(actualPhoto, selectedLogForModal.vehiclePlate, selectedLogForModal.id, undefined, `VISTORIA_${pos.toUpperCase()}`)}
                                          className="inline-flex items-center justify-center gap-1 w-full px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold rounded transition-colors"
                                          title="Baixar foto da vistoria com placa/identificação"
                                        >
                                          <Download size={10} />
                                          <span>Baixar</span>
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="h-14 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400 font-medium">
                                        Sem foto
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {selectedLogForModal.visualInspection.aiAssessment ? (
                            <div className="bg-white rounded-xl p-3 border border-slate-200">
                              <h5 className="text-xs font-bold text-slate-700 uppercase mb-1">Parecer Executivo AI Vision</h5>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {selectedLogForModal.visualInspection.aiAssessment.summary}
                              </p>
                                {selectedLogForModal.visualInspection.aiAssessment.damagesList && selectedLogForModal.visualInspection.aiAssessment.damagesList.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-slate-100">
                                    <span className="text-[11px] font-bold text-red-600 block mb-1">Avarias / Divergências de Modelo Identificadas:</span>
                                  <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5">
                                    {selectedLogForModal.visualInspection.aiAssessment.damagesList.map((dmg, idx) => (
                                      <li key={idx}>{dmg}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {selectedLogForModal.observations ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Observação Registrada pelo Motorista</h4>
                          <p className="text-sm text-slate-700 leading-relaxed italic">"{selectedLogForModal.observations}"</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                      <button
                        onClick={() => setSelectedLogForModal(null)}
                        className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl transition-colors"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
