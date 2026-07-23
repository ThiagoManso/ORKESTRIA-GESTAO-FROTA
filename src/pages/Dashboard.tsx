import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { Package, TrendingUp, Users, MapPin, CheckCircle, Clock, AlertTriangle, Truck, Activity } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

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
  const [activeTab, setActiveTab] = useState<'geral' | 'kpis' | 'stops'>('geral');
  const [dateFilter, setDateFilter] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError('');
      
      try {
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

        const startDateObj = chartDates.length > 0 ? new Date(chartDates[0]) : new Date();
        const endDateObj = chartDates.length > 0 ? new Date(chartDates[chartDates.length - 1]) : new Date();
        
        const getDashboardStats = httpsCallable(functions, 'getDashboardStats');
        const response = await getDashboardStats({
          startDate: startDateObj.toISOString(),
          endDate: endDateObj.toISOString(),
          chartDatesStr: chartDates.map(d => d.toISOString())
        });
        
        setStats(response.data);
      } catch (err: any) {
        console.error("Failed to fetch dashboard stats:", err);
        setError('Falha ao carregar indicadores. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [dateFilter, customStartDate, customEndDate]);

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
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {loading && !stats ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-cyan mb-4"></div>
          <p>Carregando indicadores do servidor...</p>
        </div>
      ) : stats ? (
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
                  <button className="text-primary text-sm font-medium hover:underline hover:text-primary-hover">Ver todas</button>
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
                            <button className="text-primary font-medium hover:text-primary-hover transition-colors">Ver Detalhes</button>
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
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {stats.periodLogs.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-500">Nenhum diário registrado no período.</td></tr>
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
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
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
                        </tr>
                      ))}
                      {stats.periodStops.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500 text-sm">
                            Nenhuma parada encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
