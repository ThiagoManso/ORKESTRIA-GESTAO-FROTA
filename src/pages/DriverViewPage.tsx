import React, { useState, useEffect } from 'react';
import { RouteItem, Vehicle, DailyLog } from '../types';
import { useCollection } from '../lib/useCollection';
import { MapPin, CheckCircle, AlertTriangle, Truck, Navigation, Package, XCircle, LogOut, BellRing, X, Camera, Image as ImageIcon, Loader2, Clock, CarFront, ShieldCheck, Wrench, Eye, Box, AlertCircle } from 'lucide-react';
import { auth, messaging, db, storage } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface DriverViewPageProps {
  driverId?: string;
  driverName?: string;
  driverStatus?: string;
}

export default function DriverViewPage({ driverId, driverName, driverStatus }: DriverViewPageProps) {
  const { data: routes, update } = useCollection<RouteItem>('routes');
  const { update: updateExternalRequest } = useCollection<any>('external_requests');
  const { data: vehicles, update: updateVehicle } = useCollection<Vehicle>('vehicles');
  const { data: dailyLogs, add: addDailyLog, update: updateDailyLog } = useCollection<DailyLog>('dailyLogs');

  const [showVehicleSelection, setShowVehicleSelection] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [checklistInitialKm, setChecklistInitialKm] = useState(0);
  const [checklistFinalKm, setChecklistFinalKm] = useState('');
  const [observations, setObservations] = useState('');
  const [checklist, setChecklist] = useState({
    extinguisher: false, tools: false, seatbelt: false,
    tires: false, oil: false, water: false, brakes: false, dashboardLights: false,
    headlights: false, turnSignals: false, brakeLights: false, mirrors: false, wipers: false,
    cleaning: false, doors: false, structure: false, tieDowns: false, bodywork: false,
  });

  const [notificationStatus, setNotificationStatus] = useState<string>('default');
  const [notifiedRoutes, setNotifiedRoutes] = useState<string[]>([]);
  const [incomingRoute, setIncomingRoute] = useState<RouteItem | null>(null);

  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [currentIssueStopIndex, setCurrentIssueStopIndex] = useState<number | null>(null);
  const [issueText, setIssueText] = useState('');
  const [issueFile, setIssueFile] = useState<File | null>(null);
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [summaryRoute, setSummaryRoute] = useState<RouteItem | null>(null);
  const [showEndOfDay, setShowEndOfDay] = useState(false);
  
  const [navTarget, setNavTarget] = useState<string | null>(null);

  const handleNavigate = (address: string) => {
    const pref = localStorage.getItem('navAppPref');
    if (pref === 'waze') {
      window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, '_blank');
    } else if (pref === 'maps') {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
    } else {
      setNavTarget(address);
    }
  };

  const setNavPreferenceAndOpen = (app: 'waze' | 'maps', address: string) => {
    localStorage.setItem('navAppPref', app);
    if (app === 'waze') {
      window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
    }
    setNavTarget(null);
  };

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };
  
  const toggleOnlineStatus = async () => {
    if (!driverId) return;
    if (driverStatus === 'offline') {
      setShowVehicleSelection(true);
    } else {
      try {
        await updateDoc(doc(db, 'drivers', driverId), { status: 'offline' });
      } catch (error) {
        console.error("Error updating status", error);
      }
    }
  };

  const handleVehicleSelect = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setChecklistInitialKm(vehicle.initialKm || 0);
    setShowVehicleSelection(false);
    setShowChecklist(true);
  };

  const submitChecklist = async () => {
    if (!driverId || !selectedVehicle) return;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await addDailyLog({
        driverId,
        driverName: driverName || 'Motorista',
        vehicleId: selectedVehicle.id,
        vehiclePlate: selectedVehicle.plate,
        date: todayStr,
        initialKm: checklistInitialKm,
        checklist,
        observations,
        status: 'active'
      });
      await updateDoc(doc(db, 'drivers', driverId), { status: 'active', currentVehicle: selectedVehicle.id });
      setShowChecklist(false);
      setChecklist({
        extinguisher: false, tools: false, seatbelt: false,
        tires: false, oil: false, water: false, brakes: false, dashboardLights: false,
        headlights: false, turnSignals: false, brakeLights: false, mirrors: false, wipers: false,
        cleaning: false, doors: false, structure: false, tieDowns: false, bodywork: false,
      });
      setObservations('');
    } catch (e) {
      console.error(e);
      alert("Erro ao iniciar o dia");
    }
  };


  useEffect(() => {
    if ('Notification' in window) {
      setNotificationStatus(Notification.permission);
    }
  }, []);

  const lastLocationRef = React.useRef<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    let watchId: number;
    let syncInterval: NodeJS.Timeout;

    if ((driverStatus === 'active' || driverStatus === 'on_route') && driverId && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition((position) => {
        lastLocationRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
      }, (error) => {
        console.warn("Erro ao obter localização do GPS:", error);
      }, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000
      });

      // Otimização: Só manda para o banco a cada 30 segundos, não a cada metro
      syncInterval = setInterval(async () => {
        if (lastLocationRef.current) {
          try {
            await updateDoc(doc(db, 'drivers', driverId), {
              location: lastLocationRef.current,
              locationUpdatedAt: new Date().toISOString()
            });
          } catch (e) {
            console.error("Erro ao sincronizar localização:", e);
          }
        }
      }, 30000);
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [driverStatus, driverId]);

  const enableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      
      if (permission === 'granted') {
        const msg = await messaging();
        if (msg) {
          const token = await getToken(msg, { vapidKey: (import.meta as any).env.VITE_FIREBASE_VAPID_KEY });
          console.log('FCM Token:', token);
          
          if (token && driverId) {
            await updateDoc(doc(db, 'drivers', driverId), { fcmToken: token });
          }
          
          onMessage(msg, (payload) => {
            console.log('Message received. ', payload);
            if (payload.notification) {
               new Notification(payload.notification.title || 'Nova Notificação', {
                 body: payload.notification.body,
                 icon: '/icon.png'
               });
            }
          });
          
          alert('Notificações ativadas com sucesso!');
        } else {
          alert('Este navegador não suporta notificações Push.');
        }
      }
    } catch (error) {
      console.error('Erro ao ativar notificações:', error);
      alert('Erro ao ativar notificações. Verifique as configurações do navegador.');
    }
  };
  
  // Find if there's any route in progress
  const activeRoute = routes?.find(r => r.status === 'in_progress' && r.driver === driverName);
  
  // Filter pending routes
  const pendingRoutes = routes?.filter(r => r.status === 'pending' && r.driver === driverName) || [];

  useEffect(() => {
    if (pendingRoutes.length > 0) {
      const newRoutes = pendingRoutes.filter(r => !notifiedRoutes.includes(r.id));
      if (newRoutes.length > 0) {
        playNotificationSound();
        setIncomingRoute(newRoutes[0]);
        setNotifiedRoutes(prev => [...prev, ...newRoutes.map(r => r.id)]);
      }
    }
  }, [pendingRoutes, notifiedRoutes]);

  const handleAcceptRoute = async (routeId: string) => {
    await update(routeId, { status: 'in_progress', driver: driverName });
  };

  const handleRejectRoute = async (routeId: string) => {
    await update(routeId, { status: 'issue', driver: 'Recusado' });
  };

  const handleCompleteStop = async (route: RouteItem, stopIndex: number) => {
    if (!route.stopDetails) return;
    const newStopDetails = [...route.stopDetails];
    newStopDetails[stopIndex] = { ...newStopDetails[stopIndex], status: 'completed' };
    
    // Check if all stops are completed
    const allCompleted = newStopDetails.every(s => s.status === 'completed' || s.status === 'issue');
    
    if (allCompleted) {
      setSummaryRoute({ ...route, stopDetails: newStopDetails, status: 'completed' });
    }

    await update(route.id, { 
      stopDetails: newStopDetails,
      ...(allCompleted ? { status: 'completed' } : {})
    });
    
    if (newStopDetails[stopIndex].externalRequestId) {
      await updateExternalRequest(newStopDetails[stopIndex].externalRequestId, { status: 'completed' }).catch(console.error);
    }
  };

  const handleIssueStop = (route: RouteItem, stopIndex: number) => {
    setCurrentIssueStopIndex(stopIndex);
    setIsIssueModalOpen(true);
  };

  const submitIssue = async () => {
    if (!activeRoute || currentIssueStopIndex === null || !activeRoute.stopDetails) return;
    
    setIsSubmittingIssue(true);
    try {
      let photoUrl = '';
      if (issueFile) {
        const fileRef = ref(storage, `issues/${activeRoute.id}_${currentIssueStopIndex}_${Date.now()}`);
        await uploadBytes(fileRef, issueFile);
        photoUrl = await getDownloadURL(fileRef);
      }

      const newStopDetails = [...activeRoute.stopDetails];
      newStopDetails[currentIssueStopIndex] = { 
        ...newStopDetails[currentIssueStopIndex], 
        status: 'issue',
        issueDescription: issueText,
        issuePhotoUrl: photoUrl
      };
      
      const allCompleted = newStopDetails.every(s => s.status === 'completed' || s.status === 'issue');
      
      if (allCompleted) {
        setSummaryRoute({ ...activeRoute, stopDetails: newStopDetails, status: 'completed' });
      }

      await update(activeRoute.id, { 
        stopDetails: newStopDetails,
        ...(allCompleted ? { status: 'completed' } : {})
      });
      
      // Reset state
      setIsIssueModalOpen(false);
      setCurrentIssueStopIndex(null);
      setIssueText('');
      setIssueFile(null);
    } catch (error) {
      console.error("Error submitting issue:", error);
      alert("Erro ao enviar o problema. Tente novamente.");
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  
  const renderModals = () => {
    return (
      <>
        {/* Vehicle Selection Modal */}
        {showVehicleSelection && (
          <div className="fixed inset-0 bg-slate-900/60 z-[60] flex flex-col p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md mx-auto shadow-2xl flex flex-col max-h-full overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">Escolha o Veículo</h3>
                <button onClick={() => setShowVehicleSelection(false)} className="text-slate-400 p-1 rounded-lg hover:bg-slate-200">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {vehicles?.filter(v => v.status === 'active').map(v => (
                  <button 
                    key={v.id} 
                    onClick={() => handleVehicleSelect(v)}
                    className="w-full flex items-center gap-4 p-4 border border-slate-200 rounded-xl hover:border-brand-cyan hover:bg-brand-cyan/5 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                      {v.type === 'motorcycle' ? <CarFront size={24} /> : <Truck size={24} />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{v.plate}</div>
                      <div className="text-sm text-slate-500">{v.brand} {v.model}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Checklist Modal */}
        {showChecklist && selectedVehicle && (
          <div className="fixed inset-0 bg-slate-900/60 z-[70] flex flex-col p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg mx-auto shadow-2xl flex flex-col max-h-full overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-4 border-b border-slate-100 bg-brand-cyan text-white">
                <h3 className="font-bold text-lg">Checklist Diário</h3>
                <p className="text-white/80 text-sm">Veículo: {selectedVehicle.plate}</p>
              </div>
              
              <div className="p-5 overflow-y-auto flex-1 space-y-6 bg-slate-50">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">KM Atual (Inicial)</label>
                  <input 
                    type="number" 
                    value={checklistInitialKm}
                    onChange={(e) => setChecklistInitialKm(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                  />
                </div>

                {/* 1. SEGURANÇA */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-500"/> 1. Segurança</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.extinguisher} onChange={e => setChecklist({...checklist, extinguisher: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Extintor de incêndio (validade/manômetro verde)</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.tools} onChange={e => setChecklist({...checklist, tools: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Kit ferramentas (Estepe, macaco, chave, triângulo)</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.seatbelt} onChange={e => setChecklist({...checklist, seatbelt: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Cinto de segurança funcionando</span>
                    </label>
                  </div>
                </div>

                {/* 2. MECÂNICA E NÍVEIS */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Wrench size={18} className="text-blue-500"/> 2. Mecânica e Níveis</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.tires} onChange={e => setChecklist({...checklist, tires: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Pneus (calibragem e sulcos)</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.oil} onChange={e => setChecklist({...checklist, oil: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Nível de óleo do motor</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.water} onChange={e => setChecklist({...checklist, water: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Nível da água/arrefecimento</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.brakes} onChange={e => setChecklist({...checklist, brakes: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Sistema de freios (teste de pedal)</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.dashboardLights} onChange={e => setChecklist({...checklist, dashboardLights: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Painel (sem luzes de alerta acesas)</span>
                    </label>
                  </div>
                </div>

                {/* 3. ILUMINAÇÃO */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Eye size={18} className="text-amber-500"/> 3. Iluminação e Visibilidade</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.headlights} onChange={e => setChecklist({...checklist, headlights: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Faróis (alto e baixo)</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.turnSignals} onChange={e => setChecklist({...checklist, turnSignals: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Setas (dianteiras e traseiras)</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.brakeLights} onChange={e => setChecklist({...checklist, brakeLights: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Luz de freio e luz de ré</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.mirrors} onChange={e => setChecklist({...checklist, mirrors: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Retrovisores (ajustados e íntegros)</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.wipers} onChange={e => setChecklist({...checklist, wipers: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Limpadores e esguichos</span>
                    </label>
                  </div>
                </div>

                {/* 4. COMPARTIMENTO DE CARGA */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Box size={18} className="text-indigo-500"/> 4. Compartimento de Carga</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.cleaning} onChange={e => setChecklist({...checklist, cleaning: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Limpeza interna</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.doors} onChange={e => setChecklist({...checklist, doors: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Vedação e travas</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.structure} onChange={e => setChecklist({...checklist, structure: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Estrutura interna</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.tieDowns} onChange={e => setChecklist({...checklist, tieDowns: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Equipamentos de amarração</span>
                    </label>
                  </div>
                </div>

                {/* 5. LATARIA E OBS */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><AlertCircle size={18} className="text-purple-500"/> 5. Lataria e Observações</h4>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checklist.bodywork} onChange={e => setChecklist({...checklist, bodywork: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-cyan focus:ring-brand-cyan" />
                      <span className="text-sm text-slate-700">Estado geral da lataria</span>
                    </label>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Observações</label>
                      <textarea
                        value={observations}
                        onChange={(e) => setObservations(e.target.value)}
                        placeholder="Algum problema encontrado? Detalhe aqui..."
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan min-h-[80px]"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 flex gap-3 bg-white">
                <button 
                  onClick={() => setShowChecklist(false)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-700 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button 
                  onClick={submitChecklist}
                  className="flex-1 py-3.5 bg-brand-cyan hover:bg-brand-blue text-white rounded-xl font-bold transition-colors"
                >
                  Finalizar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Escolha de GPS */}
        {navTarget && (
          <div className="fixed inset-0 bg-slate-900/60 z-[80] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-auto shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">Abrir Navegação</h3>
                <button onClick={() => setNavTarget(null)} className="text-slate-400 p-1 rounded-lg hover:bg-slate-200">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <button 
                  onClick={() => setNavPreferenceAndOpen('maps', navTarget)} 
                  className="w-full flex items-center justify-center gap-3 py-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold transition-colors border border-blue-200"
                >
                  <Navigation size={22} /> Google Maps
                </button>
                <button 
                  onClick={() => setNavPreferenceAndOpen('waze', navTarget)} 
                  className="w-full flex items-center justify-center gap-3 py-4 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-xl font-bold transition-colors border border-cyan-200"
                >
                  <Navigation size={22} /> Waze
                </button>
                <div className="text-center pt-2">
                  <span className="text-xs text-slate-400">Sua escolha será salva como padrão.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const formatRouteId = (route: RouteItem) => {
    if (route.routeNumber) {
      return String(route.routeNumber).padStart(7, '0');
    }
    return route.id.slice(0, 8).toUpperCase();
  };

  if (activeRoute) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-20">
        {renderModals()}
        <div className="bg-white shadow-sm p-4 sticky top-0 z-10 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-cyan/10 rounded-full flex items-center justify-center text-brand-cyan">
                <Truck size={24} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">Rota #{formatRouteId(activeRoute)}</h1>
                <p className="text-sm text-slate-500 font-medium">Em andamento</p>
              </div>
            </div>
            
            {localStorage.getItem('navAppPref') && (
              <button 
                onClick={() => { localStorage.removeItem('navAppPref'); alert('Sua preferência de GPS foi resetada.'); }}
                className="text-[10px] sm:text-xs text-slate-400 font-medium hover:text-slate-600 underline"
              >
                Trocar GPS
              </button>
            )}
          </div>
          
          <div className="mt-4 flex gap-4 text-sm">
            <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-xs mb-1 font-medium">Progresso</div>
              <div className="font-semibold text-slate-800">
                {activeRoute.stopDetails?.filter(s => s.status === 'completed').length || 0} de {activeRoute.stops}
              </div>
            </div>
            <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-xs mb-1 font-medium">Distância</div>
              <div className="font-semibold text-slate-800">{activeRoute.distance} km</div>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-4">
          {notificationStatus === 'default' && (
            <div className="mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-4 text-white shadow-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <BellRing size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Ative as Notificações</h3>
                  <p className="text-xs text-blue-100 mt-0.5">Receba alertas em tempo real</p>
                </div>
              </div>
              <button 
                onClick={enableNotifications}
                className="px-4 py-2 bg-white text-blue-600 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-transform"
              >
                Ativar
              </button>
            </div>
          )}
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Paradas</h2>
          {activeRoute.stopDetails?.map((stop, index) => {
            const isCompleted = stop.status === 'completed';
            const isIssue = stop.status === 'issue';
            
            return (
              <div key={stop.id || index} className={`bg-white rounded-2xl p-4 shadow-sm border ${isCompleted ? 'border-emerald-200 bg-emerald-50/30' : isIssue ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    isCompleted ? 'bg-emerald-500' : isIssue ? 'bg-red-500' : 'bg-slate-300'
                  }`}>
                    {isCompleted ? <CheckCircle size={14} /> : isIssue ? <AlertTriangle size={14} /> : index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-base mb-1 ${isCompleted ? 'text-emerald-900 line-through opacity-70' : isIssue ? 'text-red-900' : 'text-slate-800'}`}>
                      {stop.address}
                    </h3>
                    
                    {(stop.orderNumber || stop.customerName || stop.customerPhone || stop.observation) && (
                      <div className={`mt-3 p-3 rounded-xl text-sm ${isCompleted ? 'bg-emerald-100/50' : isIssue ? 'bg-red-100/50' : 'bg-slate-50 border border-slate-100'}`}>
                        <div className="font-semibold text-slate-800 mb-2 border-b border-slate-200/50 pb-2">Resumo do Pedido</div>
                        <div className="space-y-1.5 text-slate-600">
                          {stop.orderNumber && <div className="flex justify-between"><span className="text-slate-400">Nº Pedido / OS:</span> <span className="font-medium text-slate-700">{stop.orderNumber}</span></div>}
                          {stop.customerName && <div className="flex justify-between"><span className="text-slate-400">Nome:</span> <span className="font-medium text-slate-700">{stop.customerName}</span></div>}
                          {stop.customerPhone && (
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Telefone:</span> 
                              <a href={`tel:${stop.customerPhone.replace(/\\D/g, '')}`} className="font-medium text-brand-cyan hover:underline flex items-center gap-1">
                                {stop.customerPhone}
                              </a>
                            </div>
                          )}
                          {stop.observation && (
                            <div className="mt-2 pt-2 border-t border-slate-200/50">
                              <span className="text-slate-400 block text-xs mb-1">Observação:</span>
                              <span className="text-slate-700 italic">{stop.observation}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    
                    {!isCompleted && !isIssue && (
                      <div className="mt-4 flex flex-col gap-2">
                        <button 
                          onClick={() => handleNavigate(stop.address)}
                          className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 text-blue-700 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                        >
                          <Navigation size={18} /> Navegar
                        </button>
                        <div className="flex gap-2 mt-2">
                          <button 
                            onClick={() => handleCompleteStop(activeRoute, index)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl font-semibold active:scale-[0.98] transition-transform shadow-sm"
                          >
                            <CheckCircle size={18} /> Entregue
                          </button>
                          <button 
                            onClick={() => handleIssueStop(activeRoute, index)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                          >
                            <AlertTriangle size={18} /> Problema
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        
      {/* Modal de Resumo de Rota */}
      {summaryRoute && (
        <div className="fixed inset-0 bg-emerald-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="bg-emerald-500 p-8 text-center text-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 relative z-10 backdrop-blur-md border border-white/30">
                <CheckCircle size={40} className="text-white drop-shadow-md" />
              </div>
              <h2 className="text-3xl font-bold mb-2 relative z-10 drop-shadow-sm">Rota Concluída!</h2>
              <p className="text-emerald-50 font-medium relative z-10">Ótimo trabalho nas entregas de hoje.</p>
            </div>
            
            <div className="p-6 space-y-5 bg-slate-50">
              <div className="flex gap-4">
                <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total de Paradas</div>
                  <div className="text-3xl font-black text-slate-800">{summaryRoute.stops}</div>
                </div>
                <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">KM Total</div>
                  <div className="text-3xl font-black text-slate-800">{summaryRoute.distance}<span className="text-sm font-bold text-slate-400 ml-1">km</span></div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-500 font-medium text-sm">Entregues:</span>
                  <span className="font-bold text-emerald-600">
                    {summaryRoute.stopDetails?.filter(s => s.status === 'completed').length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium text-sm">Problemas:</span>
                  <span className="font-bold text-red-500">
                    {summaryRoute.stopDetails?.filter(s => s.status === 'issue').length || 0}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSummaryRoute(null)}
                className="w-full py-4 mt-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20"
              >
                Voltar ao Início
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Problema */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-500 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <AlertTriangle size={20} /> Relatar Problema
              </h3>
              <button 
                onClick={() => setIsIssueModalOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">O que aconteceu?</label>
                <textarea
                  value={issueText}
                  onChange={(e) => setIssueText(e.target.value)}
                  placeholder="Descreva o problema..."
                  className="w-full border border-slate-200 rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[100px] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Anexar Foto (Opcional)</label>
                <div className="flex gap-2">
                  <label className="flex-1 flex flex-col items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-colors">
                    <Camera size={24} className="text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">Tirar Foto</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      className="hidden" 
                      onChange={(e) => setIssueFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <label className="flex-1 flex flex-col items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-colors">
                    <ImageIcon size={24} className="text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">Galeria</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => setIssueFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                {issueFile && (
                  <div className="mt-2 text-sm text-emerald-600 flex items-center gap-1 font-medium bg-emerald-50 p-2 rounded-lg">
                    <CheckCircle size={16} /> Foto selecionada: {issueFile.name}
                  </div>
                )}
              </div>

              <button
                onClick={submitIssue}
                disabled={isSubmittingIssue}
                className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingIssue ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Confirmar Problema'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {incomingRoute && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-cyan p-6 text-center text-white">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <BellRing size={32} className="animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold mb-1">Nova Rota!</h2>
              <p className="text-brand-cyan/20 text-white/80 font-medium">Você tem uma nova solicitação</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-medium">Identificação</span>
                <span className="font-bold text-slate-800">#{formatRouteId(incomingRoute)}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-medium">Paradas</span>
                <span className="font-bold text-slate-800">{incomingRoute.stops}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-medium">Distância</span>
                <span className="font-bold text-slate-800">{incomingRoute.distance} km</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => {
                  handleAcceptRoute(incomingRoute.id);
                  setIncomingRoute(null);
                }}
                className="flex-1 py-3.5 bg-gradient-to-r from-brand-cyan to-brand-blue text-white rounded-xl font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2 shadow-md shadow-brand-blue/20"
              >
                <CheckCircle size={18} /> Aceitar
              </button>
              <button 
                onClick={() => {
                  handleRejectRoute(incomingRoute.id);
                  setIncomingRoute(null);
                }}
                className="px-5 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold active:scale-[0.98] transition-transform hover:bg-slate-50 flex items-center justify-center"
              >
                <XCircle size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
</div>
      </div>
    );
  }

  const renderEndOfDaySummary = () => {
    if (!showEndOfDay) return null;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysRoutes = (routes || []).filter(r => 
      r.driver === driverName && 
      r.status === 'completed' && 
      (r.date === todayStr || (r as any).createdAt?.includes(todayStr) || true) // temporary fallback to all completed if date missing
    );

    const totalRoutes = todaysRoutes.length;
    const totalStops = todaysRoutes.reduce((acc, curr) => acc + (curr.stops || 0), 0);
    const totalDistance = todaysRoutes.reduce((acc, curr) => acc + (curr.distance || 0), 0);
    
    const totalTimeMins = todaysRoutes.reduce((acc, curr) => {
      const match = curr.estimatedTime?.match(/(\d+)/);
      const mins = match ? parseInt(match[1], 10) : 0;
      return acc + (curr.estimatedTime?.includes('hora') || curr.estimatedTime?.includes('hour') ? mins * 60 : mins);
    }, 0);
    
    const hours = Math.floor(totalTimeMins / 60);
    const mins = totalTimeMins % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-indigo-600 p-6 text-center text-white">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold">Fim de Expediente</h2>
            <p className="text-indigo-100 mt-1 opacity-90">Bom descanso, {driverName?.split(' ')[0]}!</p>
          </div>
          
          <div className="p-6">
            <h3 className="font-bold text-slate-800 mb-4 text-center">Seu Resumo de Hoje</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center">
                <Package size={20} className="text-blue-500 mb-1" />
                <span className="text-2xl font-bold text-slate-800">{totalRoutes}</span>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Rotas</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center">
                <MapPin size={20} className="text-emerald-500 mb-1" />
                <span className="text-2xl font-bold text-slate-800">{totalStops}</span>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Entregas</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center">
                <Clock size={20} className="text-amber-500 mb-1" />
                <span className="text-xl font-bold text-slate-800">{timeStr}</span>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Tempo</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center">
                <Navigation size={20} className="text-indigo-500 mb-1" />
                <span className="text-xl font-bold text-slate-800">{totalDistance.toFixed(1)} <span className="text-sm">km</span></span>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Distância</span>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">KM Final do Veículo</label>
              <input 
                type="number" 
                value={checklistFinalKm}
                onChange={(e) => setChecklistFinalKm(e.target.value)}
                placeholder="Ex: 150200"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button 
              onClick={async () => {
                if (!checklistFinalKm) {
                  alert('Por favor, insira o KM Final.');
                  return;
                }
                const finalKmNum = parseInt(checklistFinalKm);
                
                // Find active daily log
                const todayStr = new Date().toISOString().split('T')[0];
                const activeLog = dailyLogs?.find(l => l.driverId === driverId && l.status === 'active' && l.date === todayStr);
                
                if (activeLog) {
                  await updateDailyLog(activeLog.id, {
                    finalKm: finalKmNum,
                    status: 'completed'
                  });
                  // Update vehicle initial KM
                  if (activeLog.vehicleId) {
                    await updateVehicle(activeLog.vehicleId, {
                      initialKm: finalKmNum
                    });
                  }
                }

                if(driverStatus !== 'offline') {
                  await updateDoc(doc(db, 'drivers', driverId!), { status: 'offline' });
                }
                setShowEndOfDay(false);
                setChecklistFinalKm('');
              }}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl transition-colors active:scale-95"
            >
              Confirmar e Fechar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      {renderModals()}
      {renderEndOfDaySummary()}
      <div className="bg-white shadow-sm p-5 sticky top-0 z-10 flex items-center justify-between border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Orkestria Entregador</h1>
          <p className="text-sm text-slate-500">Olá, {driverName?.split(' ')[0] || 'Motorista'}</p>
        </div>
        <div className="flex items-center gap-2">
          {(!activeRoute) && (
            <button 
              onClick={() => setShowEndOfDay(true)} 
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-sm"
            >
              Encerrar Dia
            </button>
          )}
          <button 
            onClick={toggleOnlineStatus}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 ${driverStatus === 'active' || driverStatus === 'on_route' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
          >
            <div className={`w-2 h-2 rounded-full ${driverStatus === 'active' || driverStatus === 'on_route' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {driverStatus === 'active' || driverStatus === 'on_route' ? 'Online' : 'Offline'}
          </button>
          <button onClick={() => signOut(auth)} className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="p-4 flex-1">
        {notificationStatus === 'default' && (
          <div className="mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-4 text-white shadow-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <BellRing size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Ative as Notificações</h3>
                <p className="text-xs text-blue-100 mt-0.5">Receba alertas de novas rotas</p>
              </div>
            </div>
            <button 
              onClick={enableNotifications}
              className="px-4 py-2 bg-white text-blue-600 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-transform"
            >
              Ativar
            </button>
          </div>
        )}

        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Package size={16} /> Novas Rotas Disponíveis
        </h2>

        {pendingRoutes.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
            <Truck size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Nenhuma rota disponível no momento.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRoutes.map(route => (
              <div key={route.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-3">
                  <div className="font-mono font-bold text-lg text-slate-800">#{formatRouteId(route)}</div>
                  <div className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg">Pendente</div>
                </div>
                
                <div className="space-y-2 mb-5">
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <MapPin size={16} className="text-slate-400" />
                    <span className="font-medium">{route.stops} paradas</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <Navigation size={16} className="text-slate-400" />
                    <span className="font-medium">{route.distance} km • {route.estimatedTime}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => handleAcceptRoute(route.id)}
                    className="flex-1 py-3.5 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-bold active:scale-[0.98] transition-transform shadow-sm flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={18} /> Aceitar
                  </button>
                  <button 
                    onClick={() => handleRejectRoute(route.id)}
                    className="px-4 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-bold active:scale-[0.98] transition-transform flex items-center justify-center"
                  >
                    <XCircle size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      
      {/* Modal de Resumo de Rota */}
      {summaryRoute && (
        <div className="fixed inset-0 bg-emerald-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="bg-emerald-500 p-8 text-center text-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 relative z-10 backdrop-blur-md border border-white/30">
                <CheckCircle size={40} className="text-white drop-shadow-md" />
              </div>
              <h2 className="text-3xl font-bold mb-2 relative z-10 drop-shadow-sm">Rota Concluída!</h2>
              <p className="text-emerald-50 font-medium relative z-10">Ótimo trabalho nas entregas de hoje.</p>
            </div>
            
            <div className="p-6 space-y-5 bg-slate-50">
              <div className="flex gap-4">
                <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total de Paradas</div>
                  <div className="text-3xl font-black text-slate-800">{summaryRoute.stops}</div>
                </div>
                <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">KM Total</div>
                  <div className="text-3xl font-black text-slate-800">{summaryRoute.distance}<span className="text-sm font-bold text-slate-400 ml-1">km</span></div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-500 font-medium text-sm">Entregues:</span>
                  <span className="font-bold text-emerald-600">
                    {summaryRoute.stopDetails?.filter(s => s.status === 'completed').length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium text-sm">Problemas:</span>
                  <span className="font-bold text-red-500">
                    {summaryRoute.stopDetails?.filter(s => s.status === 'issue').length || 0}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSummaryRoute(null)}
                className="w-full py-4 mt-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20"
              >
                Voltar ao Início
              </button>
            </div>
          </div>
        </div>
      )}

      {incomingRoute && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-cyan p-6 text-center text-white">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <BellRing size={32} className="animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold mb-1">Nova Rota!</h2>
              <p className="text-brand-cyan/20 text-white/80 font-medium">Você tem uma nova solicitação</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-medium">Identificação</span>
                <span className="font-bold text-slate-800">#{formatRouteId(incomingRoute)}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-medium">Paradas</span>
                <span className="font-bold text-slate-800">{incomingRoute.stops}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-medium">Distância</span>
                <span className="font-bold text-slate-800">{incomingRoute.distance} km</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => {
                  handleAcceptRoute(incomingRoute.id);
                  setIncomingRoute(null);
                }}
                className="flex-1 py-3.5 bg-gradient-to-r from-brand-cyan to-brand-blue text-white rounded-xl font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2 shadow-md shadow-brand-blue/20"
              >
                <CheckCircle size={18} /> Aceitar
              </button>
              <button 
                onClick={() => {
                  handleRejectRoute(incomingRoute.id);
                  setIncomingRoute(null);
                }}
                className="px-5 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold active:scale-[0.98] transition-transform hover:bg-slate-50 flex items-center justify-center"
              >
                <XCircle size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
</div>
    </div>
  );
}
