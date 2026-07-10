import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { vehicleService, logService, driverService, collectionRequestService, userService, settingsService } from '../lib/services';
import { Vehicle, VehicleLog, Driver, CollectionRequest, UserProfile, GlobalSettings } from '../types';
import { 
  Navigation as RoutesIcon, MapPin, Search as SearchIcon,
  ChevronRight, ArrowUpRight, Clock, Gauge, Route,
  TrendingUp, Users, Activity, Layers, Filter, Calendar
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { MapTrackingView } from './MapTrackingView';

export function UsageView() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [logs, setLogs] = useState<VehicleLog[]>([]);
  const [requests, setRequests] = useState<CollectionRequest[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedLogId, setFocusedLogId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  const Navigation = RoutesIcon;

  useEffect(() => {
    if (!user) return;
    const unsubVehicles = vehicleService.subscribeToVehicles(setVehicles);
    const unsubLogs = logService.subscribeToLogs((allLogs) => {
      setLogs(allLogs);
    });
    const unsubDrivers = driverService.subscribeToDrivers(setDrivers);
    const unsubRequests = collectionRequestService.subscribeToRequests(setRequests);
    const unsubUsers = userService.listUsers(setAllUsers);
    const unsubSettings = settingsService.getSettings(setGlobalSettings);

    return () => {
      unsubVehicles();
      unsubLogs();
      unsubDrivers();
      unsubRequests();
      unsubUsers();
      unsubSettings();
    };
  }, [user]);

  const activeLogs = useMemo(() => {
    const active = logs.filter(l => l.status === 'active');
    
    // Create a lookup for driver records status
    const driverStatusMap: Record<string, string> = {};
    drivers.forEach(d => {
      driverStatusMap[d.name] = d.status;
    });

    // Persistent GPS users (8h rule)
    const now = new Date();
    const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);
    const trackingUsers = allUsers.filter(u => 
      u.isTrackingActive && 
      u.locationUpdatedAt && 
      u.locationUpdatedAt.toDate() >= eightHoursAgo
    );

    const uniqueActiveLogs: Record<string, VehicleLog> = {};
    
    // First, add real active logs
    active.forEach(log => {
      if (driverStatusMap[log.driverName] === 'inactive') return;
      const existing = uniqueActiveLogs[log.ownerId];
      if (!existing || (log.startTime?.seconds || 0) > (existing.startTime?.seconds || 0)) {
        uniqueActiveLogs[log.ownerId] = log;
      }
    });

    // Then, add tracking users who DON'T have an active log
    trackingUsers.forEach(user => {
      if (driverStatusMap[user.name] === 'inactive') return;
      if (!uniqueActiveLogs[user.uid]) {
        // Synthesize a log for tracking visibility
        uniqueActiveLogs[user.uid] = {
          id: `tracking-${user.uid}`,
          driverName: user.name || 'Motorista',
          vehicleId: '', // No vehicle assigned if log is closed
          startMileage: 0,
          status: 'active',
          ownerId: user.uid,
          startTime: user.locationUpdatedAt,
          currentLat: user.lastLocation?.lat,
          currentLng: user.lastLocation?.lng
        } as VehicleLog;
      }
    });

    return Object.values(uniqueActiveLogs);
  }, [logs, drivers, allUsers]);
  
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (!dateFilter) return true;
      // If it has a completed date, use that date
      if (r.completedAt) {
        const completedDate = r.completedAt.toDate ? r.completedAt.toDate() : new Date(r.completedAt);
        return completedDate.toISOString().split('T')[0] === dateFilter;
      }
      // Otherwise use scheduled date
      return !r.scheduledDate || r.scheduledDate === dateFilter;
    });
  }, [requests, dateFilter]);

  const stats = useMemo(() => {
    return activeLogs.map(log => {
      const vehicle = vehicles.find(v => v.id === log.vehicleId);
      const driverRequests = filteredRequests.filter(r => r.assignedDriverId === log.ownerId);
      
      const remainingTrips = driverRequests.filter(r => ['assigned', 'accepted'].includes(r.status)).length;
      const completedTrips = driverRequests.filter(r => r.status === 'completed' || r.status === 'delivered_manual').length;
      
      // Calculate Average Time between collections
      const driverCompleted = driverRequests
        .filter(r => (r.status === 'completed' || r.status === 'delivered_manual') && r.completedAt)
        .sort((a, b) => {
          const timeA = a.completedAt?.toMillis ? a.completedAt.toMillis() : new Date(a.completedAt).getTime();
          const timeB = b.completedAt?.toMillis ? b.completedAt.toMillis() : new Date(b.completedAt).getTime();
          return timeA - timeB;
        });

      let avgTimeBetween = "--";
      if (driverCompleted.length > 1) {
        const intervals: number[] = [];
        for (let i = 1; i < driverCompleted.length; i++) {
          const prev = driverCompleted[i - 1];
          const curr = driverCompleted[i];
          const tPrev = prev.completedAt?.toMillis ? prev.completedAt.toMillis() : new Date(prev.completedAt).getTime();
          const tCurr = curr.completedAt?.toMillis ? curr.completedAt.toMillis() : new Date(curr.completedAt).getTime();
          
          const diffMin = (tCurr - tPrev) / 60000;
          // Filter out intervals that are likely spanning across shifts or long breaks (e.g. > 6h)
          if (diffMin > 0 && diffMin < 360) {
            intervals.push(diffMin);
          }
        }
        
        if (intervals.length > 0) {
          const average = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          avgTimeBetween = `${Math.round(average)} min`;
        }
      }
      
      // Calculate KM Traveled (if vehicle mileage was updated, or relative to log start)
      const kmTraveled = vehicle ? Math.max(0, vehicle.currentMileage - log.startMileage) : 0;
      
      // Calculate Average Speed
      const logStartTime = log.startTime?.toMillis ? log.startTime.toMillis() : new Date(log.startTime).getTime();
      const totalTimeHours = (Date.now() - logStartTime) / 3600000;
      const avgSpeed = totalTimeHours > 0.05 ? Math.round(kmTraveled / totalTimeHours) : 0;
      const avgSpeedDisplay = avgSpeed > 0 && avgSpeed < 120 ? `${avgSpeed} km/h` : "--";

      // Simple ETA heuristic
      const etr = remainingTrips > 0 ? `${15 + remainingTrips * 12} min` : "Próximo";

      return {
        ...log,
        vehicle,
        kmTraveled,
        remainingTrips,
        etr,
        avgTimeBetween,
        avgSpeedDisplay
      };
    });
  }, [activeLogs, vehicles, filteredRequests]);

  const filteredStats = stats.filter(s => 
    s.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.vehicle?.plate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalKmToday = stats.reduce((acc, s) => acc + s.kmTraveled, 0);

  return (
    <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-700">
      {/* Header & Quick Stats */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tight">Monitoramento em Tempo Real</h2>
          <p className="text-ork-text-muted text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Painel de Controle Central de Operações</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative group min-w-[200px]">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ork-text-muted group-focus-within:text-ork-primary transition-colors" />
            <input 
              type="date" 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-ork-surface border border-ork-border rounded-xl py-3 pl-11 pr-4 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-ork-primary transition-all [color-scheme:dark]"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-ork-surface border border-ork-border p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ork-primary/10 flex items-center justify-center text-ork-primary">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[8px] font-black text-ork-text-muted uppercase tracking-widest">Ativos</p>
              <p className="text-lg font-black text-white leading-none">{activeLogs.length}</p>
            </div>
          </div>
          <div className="bg-ork-surface border border-ork-border p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ork-secondary/10 flex items-center justify-center text-ork-secondary">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[8px] font-black text-ork-text-muted uppercase tracking-widest">KM Total</p>
              <p className="text-lg font-black text-white leading-none">{totalKmToday.toFixed(1)}</p>
            </div>
          </div>
          <div className="bg-ork-surface border border-ork-border p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ork-accent/10 flex items-center justify-center text-ork-accent">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[8px] font-black text-ork-text-muted uppercase tracking-widest">Motoristas</p>
              <p className="text-lg font-black text-white leading-none">{drivers.filter(d => d.status === 'active').length}</p>
            </div>
          </div>
          <div className="bg-ork-surface border border-ork-border p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[8px] font-black text-ork-text-muted uppercase tracking-widest">Fila</p>
              <p className="text-lg font-black text-white leading-none">{filteredRequests.filter(r => r.status === 'pending').length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[600px]">
        {/* Left Sidebar: List of active routes */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4 overflow-hidden">
          <div className="relative group">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ork-text-muted group-focus-within:text-ork-primary transition-colors" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar veículo ou motorista..."
              className="w-full bg-ork-surface border border-ork-border rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white focus:outline-none focus:border-ork-primary transition-all"
            />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
            {filteredStats.map((s) => (
              <motion.button
                layout
                key={s.id}
                onClick={() => setFocusedLogId(focusedLogId === s.id ? null : s.id)}
                className={cn(
                  "w-full text-left bg-ork-surface border p-4 rounded-2xl transition-all relative group overflow-hidden",
                  focusedLogId === s.id ? "border-ork-primary shadow-lg shadow-ork-primary/10" : "border-ork-border hover:border-white/20"
                )}
              >
                {focusedLogId === s.id && (
                  <motion.div layoutId="active-bg" className="absolute inset-0 bg-ork-primary/5 pointer-events-none" />
                )}
                
                <div className="flex justify-between items-start mb-3 relative">
                  <div>
                    <h4 className="text-sm font-black text-white uppercase italic">{s.vehicle?.plate || 'S/ PLACA'}</h4>
                    <p className="text-[9px] font-bold text-ork-text-muted uppercase tracking-widest">{s.driverName}</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-ork-bg/50 px-2 py-1 rounded-lg border border-white/5">
                    {(s.currentSpeed && s.currentSpeed > 0.5) ? (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-[8px] font-black text-emerald-400 uppercase">Em Movimento</span>
                      </>
                    ) : (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full bg-ork-primary animate-pulse" />
                        <span className="text-[8px] font-black text-white uppercase">Parado</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 relative">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-ork-text-muted uppercase tracking-widest">Distância</p>
                    <div className="flex items-center gap-1.5 text-white">
                      <Gauge className="w-3 h-3 text-ork-secondary" />
                      <span className="text-xs font-black">{s.kmTraveled.toFixed(1)} km</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-ork-text-muted uppercase tracking-widest">Retorno Est.</p>
                    <div className="flex items-center gap-1.5 text-white">
                      <Clock className="w-3 h-3 text-ork-primary" />
                      <span className="text-xs font-black">{s.etr}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between relative">
                  <div className="flex items-center gap-1">
                    <Route className="w-3 h-3 text-ork-text-muted" />
                    <span className="text-[9px] font-bold text-ork-text-muted uppercase">Coletas: {s.remainingTrips} rest.</span>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 text-ork-text-muted transition-transform", focusedLogId === s.id && "translate-x-1 text-ork-primary")} />
                </div>
              </motion.button>
            ))}

            {filteredStats.length === 0 && (
              <div className="py-12 px-6 text-center bg-white/5 border border-white/5 border-dashed rounded-3xl">
                <Filter className="w-8 h-8 text-ork-text-muted mx-auto mb-3 opacity-20" />
                <p className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest">Nenhum veículo em rota</p>
              </div>
            )}
          </div>
        </div>

        {/* Central Map & Details */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6 overflow-hidden">
          <div className="flex-1 bg-ork-surface border border-ork-border rounded-[2.5rem] overflow-hidden relative shadow-2xl min-h-[400px]">
            <MapTrackingView 
              logs={activeLogs} 
              vehicles={vehicles} 
              currentDriverLogId={focusedLogId}
              allRequests={filteredRequests}
              showLegend={true}
              destination={globalSettings?.headquarterAddress}
              waypoints={requests.filter(r => 
                focusedLogId && 
                (r.assignedDriverId === logs.find(l => l.id === focusedLogId)?.ownerId) &&
                ['assigned', 'accepted'].includes(r.status)
              )}
            />
          </div>

          <AnimatePresence mode="wait">
            {focusedLogId ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0"
              >
                {(() => {
                  const s = stats.find(stat => stat.id === focusedLogId);
                  if (!s) return null;
                  return (
                    <>
                      <div className="bg-ork-surface border border-ork-border p-6 rounded-[2rem]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-ork-primary/10 flex items-center justify-center text-ork-primary">
                            <RoutesIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-xs font-black text-white uppercase italic">Status da Viagem</h5>
                            <p className="text-[8px] font-bold text-ork-text-muted uppercase tracking-widest">Performance em Tempo Real</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                            <span className="text-[9px] font-bold text-ork-text-muted uppercase">Tempo Médio p/ Coleta</span>
                            <span className="text-sm font-black text-white">{s.avgTimeBetween}</span>
                          </div>
                          <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                            <span className="text-[9px] font-bold text-ork-text-muted uppercase">Velocidade Média</span>
                            <span className="text-sm font-black text-ork-secondary">{s.avgSpeedDisplay}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-ork-surface border border-ork-border p-6 rounded-[2rem]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-ork-secondary/10 flex items-center justify-center text-ork-secondary">
                            <ArrowUpRight className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-xs font-black text-white uppercase italic">Fila de Entregas</h5>
                            <p className="text-[8px] font-bold text-ork-text-muted uppercase tracking-widest">Logística & Waypoints</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 flex flex-col items-center justify-center bg-white/5 rounded-2xl py-4 border border-white/5">
                            <span className="text-2xl font-black text-white leading-none">{s.remainingTrips}</span>
                            <span className="text-[8px] font-black text-ork-text-muted uppercase tracking-widest mt-1">Pendentes</span>
                          </div>
                          <div className="flex-1 flex flex-col items-center justify-center bg-white/5 rounded-2xl py-4 border border-white/5">
                            <span className="text-2xl font-black text-white leading-none">
                              {requests.filter(r => r.assignedDriverId === s.driver?.id && r.status === 'completed').length}
                            </span>
                            <span className="text-[8px] font-black text-ork-text-muted uppercase tracking-widest mt-1">Concluídas</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-ork-surface border border-ork-border p-6 rounded-[2rem]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-ork-accent/10 flex items-center justify-center text-ork-accent">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-xs font-black text-white uppercase italic">Última Localização</h5>
                            <p className="text-[8px] font-bold text-ork-text-muted uppercase tracking-widest">Coordenadas GPS Ativas</p>
                          </div>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-mono text-ork-text-muted line-clamp-2">
                            LAT: {s.currentLat?.toFixed(6) || '--'}<br />
                            LNG: {s.currentLng?.toFixed(6) || '--'}
                          </p>
                          <div className="mt-3 flex items-center gap-2 text-ork-accent">
                            <Activity className="w-3 h-3 animate-pulse" />
                            <span className="text-[9px] font-black uppercase">Recebendo sinal estável</span>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-ork-surface border border-ork-border rounded-[2rem] p-8 flex items-center justify-center text-center border-dashed shrink-0"
              >
                <div className="max-w-xs">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                    <Navigation className="w-6 h-6 text-ork-text-muted" />
                  </div>
                  <h4 className="text-sm font-black text-white uppercase italic mb-1">Selecione uma Rota</h4>
                  <p className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest leading-relaxed">
                    Clique em um veículo na lista lateral para visualizar telemetria e detalhes da operação.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
