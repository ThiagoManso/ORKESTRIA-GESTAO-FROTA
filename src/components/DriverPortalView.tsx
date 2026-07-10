import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { vehicleService, logService, collectionRequestService, driverService, checklistService, settingsService, userService } from '../lib/services';
import { routeManifestService } from '../lib/routeManifestService';
import { CollectionRequest, VehicleLog, Driver, Vehicle, GlobalSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User,
  Truck,
  Phone,
  ExternalLink,
  ChevronRight,
  Play,
  StopCircle,
  ClipboardCheck,
  Gauge,
  Droplets,
  Lightbulb,
  ShieldCheck,
  Wrench,
  Sparkles,
  Info,
  Activity
} from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { UberAlert } from './UberAlert';
import { MapTrackingView } from './MapTrackingView';
import { LocationSharer } from './LocationSharer';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Polyline } from './Polyline';
import { useGeofencing } from '../lib/useGeofencing';
import { requestNotificationPermission } from '../lib/firebase';

export function DriverPortalView() {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<CollectionRequest[]>([]);
  const [logs, setLogs] = useState<VehicleLog[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [hasCheckedStale, setHasCheckedStale] = useState(false);
  const [showEndModal, setShowEndModal] = useState<string | null>(null);
  const [resumedLogId, setResumedLogId] = useState<string | null>(null);
  const [closedLogs, setClosedLogs] = useState<Set<string>>(new Set());
  const [activeUberRequest, setActiveUberRequest] = useState<CollectionRequest | null>(null);
  const [lastKnownRequests, setLastKnownRequests] = useState<Record<string, number>>({});
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState<{ stops: number, km: number } | null>(null);
  const [isEnding, setIsEnding] = useState<string | null>(null);
  const [routeManifest, setRouteManifest] = useState<any | null>(null);

  const safetyTips = [
    "Mantenha sempre a distância de segurança do veículo à frente.",
    "Respeite os limites de velocidade, mesmo com pressa.",
    "Sua família te espera. Dirija com responsabilidade.",
    "Sinalize todas as suas manobras com antecedência.",
    "Evite o uso do celular ao dirigir. Sua atenção salva vidas.",
    "Faça pausas se sentir sono ou cansaço excessivo."
  ];
  const [currentTip] = useState(safetyTips[Math.floor(Math.random() * safetyTips.length)]);

  // Audio for notifications
  const [notificationAudio] = useState(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

  // Form state
  const [startForm, setStartForm] = useState({
    vehicleId: '',
    driverName: profile?.name || '',
    purpose: 'Coleta/Entrega',
    startMileage: 0
  });

  const [checklist, setChecklist] = useState<Record<string, string>>({
    pneus: 'Bom', oleo: 'Bom', luzes: 'Bom', freios: 'Bom',
    limpadores: 'Bom', documentacao: 'Bom', lataria: 'Bom', step: 'Bom', limpeza: 'Bom', ruido: 'Normal'
  });
  const [fuelLevel, setFuelLevel] = useState('1/2');

  useEffect(() => {
    if (!user) return;
    
    // Notifications permission - run once
    const setupFCM = async () => {
      const token = await requestNotificationPermission();
      if (token) {
        setFcmToken(token);
        await userService.updateUser(user.uid, { fcmToken: token });
      }
    };
    setupFCM();
  }, [user]);

  // Separate effect for requests to handle notifications logic without re-subscribing logs/vehicles
  useEffect(() => {
    if (!user || !profile) return;

    const unsubRequests = collectionRequestService.subscribeToRequests((newRequests) => {
      setRequests(newRequests);

      // Uber Alert Logic - Improved for Batches
      const myActiveUnseen = newRequests.filter(r => {
        const isMyTask = r.assignedDriverId === user.uid || 
                         drivers.find(d => d.id === r.assignedDriverId)?.name === profile?.name;
        if (!isMyTask) return false;

        const lastUpdateTime = lastKnownRequests[r.id];
        const currentTime = r.updatedAt || r.createdAt;
        
        return r.status === 'assigned' && 
               (!lastUpdateTime || currentTime > lastUpdateTime);
      });

      if (myActiveUnseen.length > 0) {
        const batchMap: Record<string, CollectionRequest[]> = {};
        myActiveUnseen.forEach(r => {
          const key = r.batchId || r.id;
          if (!batchMap[key]) batchMap[key] = [];
          batchMap[key].push(r);
        });

        const firstBatchKey = Object.keys(batchMap)[0];
        const batch = batchMap[firstBatchKey];
        
        if (batch.length > 1) {
          const packageRequest: CollectionRequest = {
            ...batch[0],
            title: `Lote de ${batch.length} Coletas`,
            address: `${batch[0].address.split(',')[0]} + ${batch.length - 1} endereços`
          };
          setActiveUberRequest(packageRequest);
        } else {
          setActiveUberRequest(batch[0]);
        }
        
        notificationAudio.play().catch(e => console.log("Audio play blocked:", e));
      }
      
      const nextKnown: Record<string, number> = {};
      newRequests.forEach(r => {
        nextKnown[r.id] = r.updatedAt || r.createdAt;
      });
      setLastKnownRequests(nextKnown);
    });

    return () => unsubRequests();
  }, [user, profile, drivers, lastKnownRequests, notificationAudio]);

  useEffect(() => {
    if (!user) return;
    const fetchManifest = async () => {
      try {
        const manifest = await routeManifestService.getDriverActiveManifest(user.uid, user.uid);
        if (!manifest && drivers.length > 0) {
            // Check if mapped to a virtual driver ID
            const myDriver = drivers.find(d => d.name === profile?.name);
            if (myDriver) {
                const vm = await routeManifestService.getDriverActiveManifest(user.uid, myDriver.id);
                setRouteManifest(vm);
            }
        } else {
            setRouteManifest(manifest);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchManifest();
    
    // Poll every 30s or use realtime snapshot for better implementation, but interval is ok for now
    const interval = setInterval(fetchManifest, 30000);
    return () => clearInterval(interval);
  }, [user, profile, drivers]);

  // Main stable subscriptions
  useEffect(() => {
    if (!user) return;

    const unsubLogs = logService.subscribeToLogs((newLogs) => {
      setLogs(newLogs);
      setIsDataLoaded(true);
    });
    const unsubDrivers = driverService.subscribeToDrivers(setDrivers);
    const unsubVehicles = vehicleService.subscribeToVehicles(setVehicles);
    const unsubSettings = settingsService.getSettings(setGlobalSettings);

    return () => {
      unsubLogs();
      unsubDrivers();
      unsubVehicles();
      unsubSettings();
    };
  }, [user]);

  const myDriverRecord = drivers.find(d => d.name === profile?.name);
  const isDriverActive = !myDriverRecord || myDriverRecord.status === 'active';
  
  const activeLog = isDriverActive 
    ? logs.find(l => {
        const isMyLog = l.status === 'active' && !closedLogs.has(l.id) && (l.driverName === profile?.name || l.ownerId === user?.uid) && isEnding !== l.id;
        if (!isMyLog) return false;
        
        const logDateString = l.startTime?.toDate ? l.startTime.toDate().toDateString() : new Date(l.startTime).toDateString();
        const todayString = new Date().toDateString();
        
        return logDateString === todayString || resumedLogId === l.id;
      })
    : null;

  const nextRequest = routeManifest ? requests.find(r => routeManifest.requestIds.includes(r.id) && r.status !== 'completed' && r.status !== 'delivered_manual') : undefined;
  const { currentDistance, isInside: isNearNextStop } = useGeofencing(nextRequest?.lat, nextRequest?.lng, 1000);
  const staleLog = isDriverActive && !activeLog && closedLogs.size === 0
    ? logs.find(l => 
        l.status === 'active' && !closedLogs.has(l.id) &&
        (l.driverName === profile?.name || l.ownerId === user?.uid) && 
        (l.startTime?.toDate ? l.startTime.toDate().toDateString() : new Date(l.startTime).toDateString()) !== new Date().toDateString() &&
        resumedLogId !== l.id
      )
    : null;
  
  const myTasks = requests.filter(r => {
    if (r.assignedDriverId === user?.uid) return true;
    const driver = drivers.find(d => d.id === r.assignedDriverId);
    return driver?.name === profile?.name;
  });

  // Automatically trigger start modal if no active log for today exists
  useEffect(() => {
    if (isDataLoaded && profile && !activeLog && !staleLog && !hasCheckedStale) {
      setShowStartModal(true);
      setHasCheckedStale(true);
    }
  }, [isDataLoaded, profile, activeLog, staleLog, hasCheckedStale]);

  const acceptedTasks = myTasks.filter(t => t.status === 'accepted');

  // If driver is inactive, show a restricted view
  if (profile?.role === 'driver' && myDriverRecord && myDriverRecord.status === 'inactive') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center animate-in fade-in duration-700">
        <div className="bg-red-500/10 p-8 rounded-full mb-8 relative">
           <XCircle className="w-16 h-16 text-red-500" />
        </div>
        <h2 className="text-3xl font-black text-white mb-3 uppercase italic tracking-tight">Acesso Restrito</h2>
        <p className="text-ork-text-muted max-w-sm text-xs font-bold uppercase tracking-widest leading-relaxed mb-10">
          Seu cadastro de motorista está inativo no sistema. Entre em contato com o administrador para regularizar sua situação.
        </p>
      </div>
    );
  }

  const handleUpdateStatus = async (id: string, status: CollectionRequest['status']) => {
    // If it's a grouped alert, we might want to accept all 'assigned' tasks for this driver
    if (status === 'accepted') {
      const assignedTasks = requests.filter(r => 
        (r.assignedDriverId === profile?.uid || drivers.find(d => d.id === r.assignedDriverId)?.name === profile?.name) &&
        r.status === 'assigned'
      );
      
      const promises = assignedTasks.map(task => collectionRequestService.updateRequest(task.id, { status: 'accepted' }));
      await Promise.all(promises);
      
      // Open with all accepted tasks includes existing ones + newly accepted
      const totalAccepted = [
        ...myTasks.filter(r => r.status === 'accepted'),
        ...assignedTasks.map(t => ({ ...t, status: 'accepted' as const }))
      ];
      
      setTimeout(() => {
        openOptimizedRoute(totalAccepted);
      }, 500);
    } else {
      await collectionRequestService.updateRequest(id, { status });
    }
    setActiveUberRequest(null);
  };

  const handleStartLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Save Checklist First
    const checklistData = {
      vehicleId: startForm.vehicleId,
      items: checklist,
      fuelLevel: fuelLevel,
      observations: '',
    };
    
    await checklistService.saveChecklist(checklistData, user.uid);
    await logService.startLog({
      ...startForm,
      driverName: profile?.name || startForm.driverName
    }, user.uid);
    
    setShowStartModal(false);
  };

  const handleEndLog = async (logId: string, endMileage: number) => {
    const logToClose = logs.find(l => l.id === logId);
    
    // Clear modal immediately to avoid "stuck" UI
    setShowEndModal(null);
    setResumedLogId(null);
    setIsEnding(logId);
    setClosedLogs(prev => new Set(prev).add(logId));
    
    if (logToClose) {
      const logStart = logToClose.startTime?.toDate ? logToClose.startTime.toDate() : new Date(logToClose.startTime);
      const stops = requests.filter(r => 
        (r.assignedDriverId === user?.uid) && 
        (r.status === 'completed' || r.status === 'delivered_manual') &&
        r.completedAt && (r.completedAt.toDate ? r.completedAt.toDate() : new Date(r.completedAt)) >= logStart
      ).length; 
      
      const km = Math.max(0, endMileage - logToClose.startMileage);
      setShowSummary({ stops, km });
      
      await logService.endLog(logId, logToClose.vehicleId, endMileage);

      // Auto-close any other remaining active logs for this user to prevent the loop
      const otherStaleLogs = logs.filter(l => 
        l.status === 'active' && 
        l.id !== logId &&
        (l.driverName === profile?.name || l.ownerId === user?.uid)
      );

      for (const stale of otherStaleLogs) {
        setClosedLogs(prev => new Set(prev).add(stale.id));
        await logService.endLog(stale.id, stale.vehicleId, stale.startMileage);
      }
    }
    
    // Allow the auto-start-modal logic to trigger on next cycle if activeLog becomes null
    setHasCheckedStale(false);
  };

  const openGoogleMaps = (address: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  const openOptimizedRoute = (targetTasks?: CollectionRequest[]) => {
    const tasksToUse = targetTasks || acceptedTasks;
    if (tasksToUse.length === 0) return;

    const stops = tasksToUse
      .filter(r => r.address)
      .map(r => encodeURIComponent(r.address));
    
    let waypoints = '';
    let destination = '';

    if (globalSettings?.headquarterAddress) {
      const joinedStops = stops.join('|');
      waypoints = stops.length > 1 ? `optimize:true|${joinedStops}` : joinedStops;
      destination = encodeURIComponent(globalSettings.headquarterAddress);
    } else {
      if (stops.length > 1) {
        const joinedStops = stops.slice(0, -1).join('|');
        waypoints = stops.length > 2 ? `optimize:true|${joinedStops}` : joinedStops;
      }
      destination = stops[stops.length - 1];
    }

    const url = `https://www.google.com/maps/dir/?api=1&origin=current_location${waypoints ? `&waypoints=${waypoints}` : ''}&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const checklistItems = [
    { id: 'pneus', label: 'Pneus', icon: Gauge, options: ['Ruim', 'Bom', 'Excelente'] },
    { id: 'oleo', label: 'Níveis de Óleo/Água', icon: Droplets, options: ['Ruim', 'Bom', 'Excelente'] },
    { id: 'luzes', label: 'Sistema de Luzes', icon: Lightbulb, options: ['Ruim', 'Bom', 'Excelente'] },
    { id: 'freios', label: 'Freios', icon: ShieldCheck, options: ['Ruim', 'Bom', 'Excelente'] },
    { id: 'limpadores', label: 'Limpadores', icon: Droplets, options: ['Ruim', 'Bom', 'Excelente'] },
    { id: 'documentacao', label: 'Documentação', icon: ClipboardCheck, options: ['Ruim', 'Bom', 'Excelente'] },
    { id: 'lataria', label: 'Lataria (Avarias)', icon: Info, options: ['Ruim', 'Bom', 'Excelente'] },
    { id: 'step', label: 'Estepe/Macaco', icon: Wrench, options: ['Ruim', 'Bom', 'Excelente'] },
    { id: 'limpeza', label: 'Limpeza do Veículo', icon: Sparkles, options: ['Ruim', 'Regular', 'Bom', 'Excelente'] },
    { id: 'ruido', label: 'Nível de Ruído', icon: Activity, options: ['Normal', 'Alto'] },
  ];

  const assignedTask = myTasks.find(t => t.status === 'assigned');
  const hasAcceptedTasks = acceptedTasks.length > 0;

  return (
    <div className={cn(
      "animate-in fade-in duration-700",
      !activeLog ? "flex flex-col items-center justify-center min-h-[70vh] p-8 text-center" : "max-w-4xl mx-auto px-4 pb-32"
    )}>
      {!activeLog ? (
        <>
          <div className="bg-ork-primary/10 p-8 rounded-full mb-8 relative">
             <div className="absolute inset-0 border-4 border-ork-primary/20 rounded-full animate-ping" />
             <Truck className="w-16 h-16 text-ork-primary" />
          </div>
          
          {staleLog ? (
            <>
              <h2 className="text-3xl font-black text-white mb-3 uppercase italic tracking-tight">Turno em Aberto</h2>
              <p className="text-ork-text-muted max-w-sm text-xs font-bold uppercase tracking-widest leading-relaxed mb-10">
                Você possui um turno de um dia anterior que não foi encerrado. Deseja encerrar agora ou continuar a jornada anterior?
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                <button 
                  onClick={() => setShowEndModal(staleLog.id)}
                  className="flex-1 bg-red-500 hover:bg-red-500/90 text-white font-black py-6 px-10 rounded-[2rem] transition-all shadow-2xl shadow-red-500/20 flex items-center justify-center gap-3 group relative overflow-hidden"
                >
                  <StopCircle className="w-5 h-5" />
                  <span className="uppercase tracking-[0.2em] text-sm">Sim, Encerrar</span>
                </button>
                <button 
                  onClick={() => setResumedLogId(staleLog.id)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black py-6 px-10 rounded-[2rem] transition-all border border-white/10 flex items-center justify-center gap-3 group relative overflow-hidden"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span className="uppercase tracking-[0.2em] text-sm">Não, Continuar</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-black text-white mb-3 uppercase italic tracking-tight">Pronto para a Jornada?</h2>
              <p className="text-ork-text-muted max-w-sm text-xs font-bold uppercase tracking-widest leading-relaxed mb-10">
                Você ainda não iniciou seu turno hoje. Escolha um veículo e realize o checklist obrigatório para começar a receber coletas.
              </p>
              
              <button 
                onClick={() => setShowStartModal(true)}
                className="bg-ork-primary hover:bg-ork-primary/90 text-white font-black py-8 px-16 rounded-[2rem] transition-all shadow-2xl shadow-ork-primary/20 flex items-center gap-4 group relative overflow-hidden text-lg"
              >
                <Play className="w-6 h-6 fill-current" />
                <span className="uppercase tracking-[0.3em]">Iniciar Turno</span>
              </button>
            </>
          )}

          <div className="mt-12 w-full max-w-xs">
            <LocationSharer userId={user.uid} />
          </div>

          {/* Start Trip Modal */}
          <AnimatePresence>
            {showStartModal && (
              <div className="fixed inset-0 bg-ork-bg/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-ork-surface border border-ork-border rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                >
                  <div className="p-8 sm:p-12 overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h3 className="text-3xl font-black text-white uppercase italic tracking-tight">Bom dia, {profile?.name?.split(' ')[0]}! ☀️</h3>
                        <p className="text-ork-primary text-[10px] font-black uppercase tracking-[0.2em] mt-2 mb-4 animate-pulse">Dica de Segurança: {currentTip}</p>
                        <p className="text-ork-text-muted text-[8px] font-bold uppercase tracking-widest">Início de Turno • {new Date().toLocaleDateString('pt-BR')}</p>
                      </div>
                      <button onClick={() => setShowStartModal(false)} className="text-ork-text-muted hover:text-white transition-colors">
                        <XCircle className="w-10 h-10" />
                      </button>
                    </div>

                    <form onSubmit={handleStartLog} className="space-y-10">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-widest ml-1">Selecione o Veículo</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {vehicles.filter(v => v.status === 'active').map(v => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setStartForm({...startForm, vehicleId: v.id, startMileage: v.currentMileage || 0});
                              }}
                              className={cn(
                                "flex flex-col p-6 rounded-3xl border transition-all text-left gap-2",
                                startForm.vehicleId === v.id 
                                  ? "bg-ork-primary/20 border-ork-primary ring-2 ring-ork-primary/20 ring-offset-4 ring-offset-ork-bg" 
                                  : "bg-white/5 border-white/10 text-ork-text-muted hover:border-white/20"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  "text-lg font-black uppercase italic tracking-tight",
                                  startForm.vehicleId === v.id ? "text-white" : "text-white/70"
                                )}>
                                  {v.plate}
                                </span>
                                <Truck className={cn("w-5 h-5", startForm.vehicleId === v.id ? "text-ork-primary" : "text-white/20")} />
                              </div>
                              <span className="text-xs font-bold uppercase opacity-60">{v.model}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-widest ml-1">Odômetro (KM)</label>
                        <input 
                          type="number" required
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-6 text-3xl font-black text-white outline-none focus:border-ork-primary text-center"
                          value={startForm.startMileage || ''}
                          onChange={e => setStartForm({...startForm, startMileage: parseInt(e.target.value) || 0})}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-6">
                        {checklistItems.map((item) => (
                          <div key={item.id} className="ork-card bg-white/5 border-white/10 p-6 rounded-[2rem] space-y-4">
                            <div className="flex items-center gap-3">
                              <item.icon className="w-5 h-5 text-ork-primary" />
                              <span className="text-xs font-black uppercase tracking-widest text-white">{item.label}</span>
                            </div>
                            <div className={cn("grid gap-2", item.options.length > 3 ? "grid-cols-2" : "grid-cols-3")}>
                              {item.options.map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => setChecklist({...checklist, [item.id]: status})}
                                  className={cn(
                                    "py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                                    checklist[item.id] === status
                                      ? (status === 'Excelente' || status === 'Normal') ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                                        : (status === 'Bom' || status === 'Regular') ? "bg-ork-primary/20 border-ork-primary text-ork-primary"
                                        : "bg-red-500/20 border-red-500 text-red-500"
                                      : "bg-white/5 border-white/5 text-ork-text-muted hover:border-white/20"
                                  )}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <button 
                        type="submit"
                        disabled={!startForm.vehicleId}
                        className={cn(
                          "w-full font-black py-8 rounded-[2rem] transition-all text-sm uppercase tracking-[0.4em]",
                          startForm.vehicleId 
                            ? "bg-ork-primary hover:bg-ork-primary/90 text-white shadow-2xl shadow-ork-primary/20" 
                            : "bg-white/5 text-white/20 cursor-not-allowed"
                        )}
                      >
                        {startForm.vehicleId ? 'Assumir Direção' : 'Selecione um Veículo'}
                      </button>
                    </form>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <>
          {/* HEADER: Minimal Info */}
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center gap-4">
              <div className="bg-ork-primary p-3 rounded-2xl">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white uppercase italic">{activeLog.driverName}</h2>
                <p className="text-[8px] font-black text-ork-primary uppercase tracking-widest">
                  {vehicles.find(v => v.id === activeLog.vehicleId)?.plate} • Rota Ativa
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowEndModal(activeLog.id)}
              className="text-red-500/60 hover:text-red-500 transition-colors p-2"
            >
              <StopCircle className="w-8 h-8" />
            </button>
          </div>

          <div className="space-y-6">
            {assignedTask ? (
              /* ASSIGNMENT MODE: High focus on accepting new task */
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-ork-primary/10 border-2 border-ork-primary rounded-[3rem] p-8 sm:p-12 text-center"
              >
                <div className="bg-ork-primary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-ork-primary/30">
                  <Navigation className="w-10 h-10 text-white" />
                </div>
                
                <h3 className="text-[10px] font-black text-ork-primary uppercase tracking-[0.5em] mb-4">Nova Solicitação</h3>
                <h2 className="text-4xl font-black text-white uppercase italic tracking-tight mb-4">{assignedTask.title}</h2>
                
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-12 shadow-inner">
                   <p className="text-2xl font-black text-white uppercase tracking-tight leading-none mb-2">
                     {assignedTask.address.split(',')[0]}
                   </p>
                   <p className="text-lg font-bold text-ork-secondary uppercase tracking-widest opacity-80 mb-6">
                     {assignedTask.address.split(',').slice(1).join(',')}
                   </p>

                   {assignedTask.observations && (
                     <div className="bg-ork-primary/10 border border-ork-primary/20 rounded-2xl p-4 text-left">
                       <p className="text-[10px] font-black text-ork-primary uppercase tracking-widest mb-1.5 flex items-center gap-2">
                         <Info size={12} />
                         Observações Importantes
                       </p>
                       <p className="text-xs font-medium text-white/80 leading-relaxed italic">
                         "{assignedTask.observations}"
                       </p>
                     </div>
                   )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => handleUpdateStatus(assignedTask.id, 'accepted')}
                    className="flex-[2] bg-ork-primary hover:bg-ork-primary/90 text-white font-black py-8 rounded-[2.5rem] text-xl uppercase tracking-[0.2em] shadow-2xl shadow-ork-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    Aceitar Coleta
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(assignedTask.id, 'refused')}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-ork-text-muted font-black py-8 rounded-[2.5rem] uppercase tracking-widest text-xs transition-all"
                  >
                    Recusar
                  </button>
                </div>
              </motion.div>
            ) : hasAcceptedTasks ? (
              /* TRIP MODE: Integrated Map and Route Following */
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-ork-surface border border-ork-border rounded-[3rem] overflow-hidden shadow-2xl relative">
                  {/* INTERACTIVE MAP INTEGRATION */}
                  <div className="h-[65vh] w-full relative group">
                    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
                        <Map
                          defaultCenter={{ lat: activeLog.currentLat || -23.5505, lng: activeLog.currentLng || -46.6333 }}
                          defaultZoom={15}
                          mapId="driver_dashboard_map"
                          disableDefaultUI={true}
                          className="w-full h-full"
                          colorScheme="DARK"
                        >
                          {/* Driver Current Position Marker */}
                          <AdvancedMarker 
                            position={{ lat: activeLog.currentLat || -23.5505, lng: activeLog.currentLng || -46.6333 }}
                          >
                            <div className="bg-ork-primary p-2 rounded-full border-2 border-white/20 shadow-[0_0_15px_rgba(123,92,255,0.5)]">
                              <Truck className="w-4 h-4 text-white" />
                            </div>
                          </AdvancedMarker>

                          {/* Task Markers */}
                          {routeManifest?.optimizedPolyline && <Polyline encodedPath={routeManifest.optimizedPolyline} />}
                          {acceptedTasks.map((t, idx) => {
                            if (!t.lat || !t.lng) return null;
                            return (
                              <AdvancedMarker key={t.id} position={{ lat: t.lat, lng: t.lng }}>
                                <div className={cn(
                                  "w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[8px] font-black text-white",
                                  idx === 0 ? "bg-ork-secondary" : "bg-ork-primary"
                                )}>
                                  {idx + 1}
                                </div>
                              </AdvancedMarker>
                            );
                          })}
                        </Map>
                    </APIProvider>

                    {/* START ROUTE OVERLAY - ONE CLICK NAVIGATION */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <motion.button 
                         initial={{ scale: 0.8, opacity: 0 }}
                         animate={{ scale: 1, opacity: 1 }}
                         whileHover={{ scale: 1.05 }}
                         whileTap={{ scale: 0.95 }}
                         onClick={() => openOptimizedRoute()}
                         className="pointer-events-auto bg-ork-primary hover:bg-ork-primary/90 text-white font-black py-6 px-10 rounded-full shadow-[0_0_50px_rgba(123,92,255,0.4)] flex items-center gap-4 group transition-all"
                       >
                         <div className="bg-white/20 p-3 rounded-full group-hover:rotate-12 transition-transform">
                           <Navigation className="w-6 h-6 fill-current" />
                         </div>
                         <div className="text-left">
                           <span className="block text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Siga o Trajeto</span>
                           <span className="block text-lg font-black uppercase italic">Iniciar Rota</span>
                         </div>
                       </motion.button>
                    </div>

                    {/* REAL-TIME METRICS REMOVED TO SAVE API COSTS */}
                  </div>

                  {/* FLOATING DESTINATION INFO */}
                  <div className="absolute bottom-6 left-6 right-6 pointer-events-none">
                     <div className="bg-ork-surface/90 backdrop-blur-md border border-white/10 p-6 rounded-[2rem] shadow-2xl pointer-events-auto flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="bg-ork-primary/20 p-3 rounded-xl flex-shrink-0">
                            <MapPin className="w-5 h-5 text-ork-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[8px] font-black text-ork-primary uppercase tracking-widest mb-1 italic">Próxima Parada</p>
                            <h4 className="text-xl font-black text-white uppercase italic leading-none">{acceptedTasks[0].title}</h4>
                            <p className="text-[10px] font-bold text-ork-secondary mt-1 uppercase tracking-widest truncate">{acceptedTasks[0].address}</p>
                            {isNearNextStop && (
                              <div className="mt-3 flex items-start gap-2 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                <div className="text-[10px] font-black text-emerald-500 uppercase">
                                  <p>Você está próximo (Raio 1km).</p>
                                  <p className="mt-1">Tarefas neste local:</p>
                                  <ul className="list-disc list-inside opacity-80 mt-1">
                                    <li>{acceptedTasks[0].title}</li>
                                  </ul>
                                </div>
                              </div>
                            )}
                            {acceptedTasks[0].observations && (
                              <div className="mt-3 flex items-start gap-2 bg-ork-primary/10 px-3 py-2 rounded-xl border border-ork-primary/20 max-w-[250px]">
                                <Info className="w-3 h-3 text-ork-primary shrink-0 mt-0.5" />
                                <p className="text-[8px] font-bold text-white/80 uppercase line-clamp-2 leading-relaxed">
                                  Obs: {acceptedTasks[0].observations}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        {isNearNextStop && (
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 animate-bounce">
                             <CheckCircle2 className="w-4 h-4" /> Você chegou no local
                          </div>
                        )}
                        {acceptedTasks.length > 1 && (
                          <div className="bg-white/5 border border-white/5 px-4 py-2 rounded-xl flex-shrink-0">
                            <span className="text-[10px] font-black text-white uppercase italic">+{acceptedTasks.length - 1} paradas</span>
                          </div>
                        )}
                     </div>
                  </div>
                </div>

                {/* ACTION CONTROLS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <div className="flex gap-4">
                    <button 
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(acceptedTasks[0].address || '')}`, '_blank')}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black py-8 rounded-[2.5rem] text-xs uppercase tracking-widest border border-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4 opacity-60" />
                      Abrir no Navegador
                    </button>
                    <button 
                      onClick={() => {/* Report issueModal */}}
                      className="w-20 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black rounded-[2.5rem] flex items-center justify-center transition-all"
                    >
                      <Info className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* List of other stops (collapsible or scrollable) */}
                {acceptedTasks.length > 1 && (
                  <div className="space-y-4 pt-4">
                    <h4 className="text-[10px] font-black text-ork-text-muted uppercase tracking-[0.4em] ml-6 italic">Fila de Paradas</h4>
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar px-2">
                      {acceptedTasks.slice(1).map(task => (
                        <div key={task.id} className="bg-ork-surface/50 border border-white/5 p-6 rounded-[2rem] min-w-[280px] flex items-start gap-3 opacity-60 group">
                          <div className="bg-white/5 p-2 rounded-lg group-hover:bg-white/10 transition-colors">
                            <MapPin className="w-4 h-4 text-ork-text-muted" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-sm font-black text-white uppercase italic tracking-tight truncate">{task.title}</h5>
                            <p className="text-[10px] font-bold text-ork-text-muted truncate">{task.address}</p>
                            {task.observations && (
                              <p className="text-[8px] font-bold text-ork-primary uppercase tracking-widest mt-1 truncate">
                                <Info size={8} className="inline mr-1" />
                                {task.observations}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* WAITING MODE: No active or pending tasks */
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="bg-white/5 p-10 rounded-full mb-8">
                  <Clock className="w-12 h-12 text-ork-text-muted opacity-20" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">Aguardando Coletas</h3>
                <p className="text-ork-text-muted text-[10px] font-bold uppercase tracking-[0.3em] mt-3">Você será notificado assim que uma nova rota for atribuída</p>
              </div>
            )}

            {/* Real-time Telemetry (Footer Area) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-ork-surface border border-white/5 p-8 rounded-[2.5rem] text-center">
                 <p className="text-[8px] font-black text-ork-text-muted uppercase tracking-widest mb-2">Velocidade</p>
                 <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-black text-white italic">{(activeLog.currentSpeed ? activeLog.currentSpeed * 3.6 : 0).toFixed(0)}</span>
                    <span className="text-sm font-black text-ork-text-muted uppercase">km/h</span>
                 </div>
              </div>
              <div className="bg-ork-surface border border-white/5 p-8 rounded-[2.5rem] flex items-center justify-center">
                 <LocationSharer userId={user.uid} logId={activeLog.id} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* GLOBAL OVERLAYS */}
      <UberAlert 
        request={activeUberRequest}
        onAccept={(id) => {
          handleUpdateStatus(id, 'accepted');
          setActiveUberRequest(null);
        }}
        onClose={() => setActiveUberRequest(null)}
      />

      {/* End Trip Modal - Shared across views */}
      <AnimatePresence>
        {showEndModal && (
          <div className="fixed inset-0 bg-ork-bg/95 backdrop-blur-md z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-ork-surface border border-ork-border rounded-[3rem] w-full max-w-sm p-10 shadow-2xl"
            >
              <h3 className="text-2xl font-black text-white uppercase italic mb-8">Encerrar Turno</h3>
              {(() => {
                const log = logs.find(l => l.id === showEndModal);
                return log ? (
                  <p className="text-[10px] font-black text-ork-text-muted uppercase tracking-widest mb-6 bg-white/5 p-3 rounded-xl border border-white/5">
                    Km Inicial: <span className="text-white">{log.startMileage} km</span>
                  </p>
                ) : null;
              })()}
              <form onSubmit={(e) => {
                e.preventDefault();
                const mileage = (e.currentTarget.elements.namedItem('endMileage') as HTMLInputElement).value;
                handleEndLog(showEndModal, parseInt(mileage));
              }} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-ork-text-muted uppercase tracking-widest">Km Final</label>
                  <input 
                    name="endMileage" type="number" required autoFocus
                    defaultValue={logs.find(l => l.id === showEndModal)?.startMileage}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-6 text-4xl font-black text-white outline-none focus:border-ork-primary text-center"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <button type="submit" className="w-full py-6 bg-red-500 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-xs">Finalizar Turno</button>
                  <button type="button" onClick={() => setShowEndModal(null)} className="w-full py-4 text-[10px] font-black uppercase text-ork-text-muted">Cancelar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {showSummary && (
          <div className="fixed inset-0 bg-ork-bg/95 backdrop-blur-md z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-ork-surface border border-ork-border rounded-[3rem] w-full max-w-sm p-10 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-3xl font-black text-white uppercase italic mb-2">Trabalho Concluído!</h3>
              <p className="text-ork-text-muted text-[10px] font-black uppercase tracking-widest mb-8">Obrigado pela dedicação hoje, {profile?.name?.split(' ')[0]}!</p>
              
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-black text-ork-text-muted uppercase tracking-widest mb-1">Entregas</p>
                  <p className="text-2xl font-black text-white">{showSummary.stops}</p>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-black text-ork-text-muted uppercase tracking-widest mb-1">Km Rodado</p>
                  <p className="text-2xl font-black text-white">{showSummary.km.toFixed(1)}</p>
                </div>
              </div>

              <p className="text-sm font-bold text-ork-text-muted leading-relaxed mb-10 italic">
                "Um bom descanso é o segredo para uma jornada produtiva amanhã. Dirija com cuidado até em casa."
              </p>

              <button 
                onClick={() => {
                  setShowSummary(null);
                  setIsEnding(null);
                }}
                className="w-full py-6 bg-ork-primary text-white font-black rounded-2xl uppercase tracking-[0.2em] text-xs shadow-2xl shadow-ork-primary/20"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
