import React, { useState } from 'react';
import { useCollection } from '../lib/useCollection';
import { DailyLog } from '../types';
import { Package, TrendingUp, Users, MapPin, CheckCircle, Clock, AlertTriangle, Truck, Activity } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const deliveryData = [
  { name: '05/07', success: 12000, failed: 800 },
  { name: '06/07', success: 13500, failed: 950 },
  { name: '07/07', success: 11000, failed: 700 },
  { name: '08/07', success: 14200, failed: 1100 },
  { name: '09/07', success: 15100, failed: 1200 },
  { name: '10/07', success: 13800, failed: 900 },
  { name: '11/07', success: 16500, failed: 1050 },
];

const statusData = [
  { name: 'Entregue', value: 85, color: '#10b981' },
  { name: 'Em Rota', value: 10, color: '#3b82f6' },
  { name: 'Atrasado', value: 3, color: '#f59e0b' },
  { name: 'Insucesso', value: 2, color: '#ef4444' },
];

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
  const [activeTab, setActiveTab] = useState<'geral' | 'kpis'>('geral');
  const { data: dailyLogs } = useCollection<DailyLog>('dailyLogs');

  // Calculate KPIs
  const todayStr = new Date().toISOString().split('T')[0];
  const todaysLogs = dailyLogs?.filter(l => l.date === todayStr) || [];
  
  const totalKmToday = todaysLogs.reduce((acc, log) => {
    if (log.finalKm && log.finalKm > log.initialKm) {
      return acc + (log.finalKm - log.initialKm);
    }
    return acc;
  }, 0);

  const completedLogs = dailyLogs?.filter(l => l.status === 'completed' && l.finalKm && l.finalKm > l.initialKm) || [];
  const totalKmAllTime = completedLogs.reduce((acc, log) => acc + (log.finalKm! - log.initialKm), 0);
  
  const uniqueDrivers = new Set(completedLogs.map(l => l.driverId)).size;
  const uniqueVehicles = new Set(completedLogs.map(l => l.vehicleId)).size;
  
  const avgKmPerDriver = uniqueDrivers > 0 ? Math.round(totalKmAllTime / uniqueDrivers) : 0;
  const avgKmPerVehicle = uniqueVehicles > 0 ? Math.round(totalKmAllTime / uniqueVehicles) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Torre de Controle</h1>
          <p className="text-slate-500 text-sm sm:text-base">Acompanhamento em tempo real da sua operação logística.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select className="flex-1 sm:flex-none bg-white border border-slate-200 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer">
            <option>Últimos 7 dias</option>
            <option>Últimos 30 dias</option>
            <option>Este mês</option>
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
      </div>

      {activeTab === 'geral' ? (
        <>


      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <StatCard 
          title="Total de Entregas" 
          value="157.325" 
          icon={Package} 
          trend="+12.5%" 
          trendLabel="vs semana anterior"
          gradientClass="bg-gradient-to-br from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)]"
        />
        <StatCard 
          title="Taxa de Sucesso (SLA)" 
          value="98.2%" 
          icon={CheckCircle} 
          trend="+0.8%" 
          trendLabel="vs semana anterior"
        />
        <StatCard 
          title="Entregadores Ativos" 
          value="2.450" 
          icon={Users} 
          trend="+156" 
          trendLabel="novos cadastros"
        />
        <StatCard 
          title="Rotas em Andamento" 
          value="482" 
          icon={MapPin} 
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6">
        {/* Main Chart */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm xl:col-span-3 flex flex-col">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Histórico de Ordens de Serviço</h3>
          <div className="h-72 w-full flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={deliveryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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

        {/* Status Breakdown */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm xl:col-span-1 flex flex-col">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Status das Entregas (Hoje)</h3>
          <div className="h-48 mb-6 relative">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-800">14k</span>
              <span className="text-xs text-slate-500">Pedidos</span>
            </div>
          </div>
          <div className="space-y-4 mt-auto">
            {statusData.map(item => (
              <div key={item.name} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: item.color }}></div>
                  <span className="text-slate-600 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Active Routes / Alerts Table */}
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
              <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="py-4 font-mono text-slate-700">#7891070</td>
                <td className="py-4 text-slate-700 font-medium">Edvaldo N.</td>
                <td className="py-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 text-red-700 font-medium text-xs">
                    <AlertTriangle size={14} /> Cliente Ausente
                  </span>
                </td>
                <td className="py-4 text-slate-500">14:22</td>
                <td className="py-4 text-right">
                  <button className="text-primary font-medium hover:text-primary-hover transition-colors">Ver Detalhes</button>
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-4 font-mono text-slate-700">#7892747</td>
                <td className="py-4 text-slate-700 font-medium">Alexandre S.</td>
                <td className="py-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 font-medium text-xs">
                    <Clock size={14} /> Atraso na Coleta
                  </span>
                </td>
                <td className="py-4 text-slate-500">13:45</td>
                <td className="py-4 text-right">
                  <button className="text-primary font-medium hover:text-primary-hover transition-colors">Ver Detalhes</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <StatCard 
              title="KM Rodado Hoje" 
              value={`${totalKmToday} km`} 
              icon={Activity} 
              gradientClass="bg-gradient-to-br from-indigo-500 to-purple-500"
            />
            <StatCard 
              title="Média de KM por Entregador" 
              value={`${avgKmPerDriver} km`} 
              icon={Users} 
              gradientClass="bg-gradient-to-br from-blue-500 to-cyan-500"
            />
            <StatCard 
              title="Média de KM por Veículo" 
              value={`${avgKmPerVehicle} km`} 
              icon={Truck} 
              gradientClass="bg-gradient-to-br from-emerald-500 to-teal-500"
            />
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm w-full">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Diários de Bordo (Hoje)</h3>
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
                  {todaysLogs.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-500">Nenhum diário registrado hoje.</td></tr>
                  ) : (
                    todaysLogs.map(log => (
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
      )}

    </div>
  );
}
