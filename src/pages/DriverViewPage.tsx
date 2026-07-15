import React, { useState, useEffect } from 'react';
import { RouteItem } from '../types';
import { useCollection } from '../lib/useCollection';
import { MapPin, CheckCircle, AlertTriangle, Truck, Navigation, Package, XCircle, LogOut, BellRing, X, Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
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
  const [notificationStatus, setNotificationStatus] = useState<string>('default');
  const [notifiedRoutes, setNotifiedRoutes] = useState<string[]>([]);
  const [incomingRoute, setIncomingRoute] = useState<RouteItem | null>(null);

  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [currentIssueStopIndex, setCurrentIssueStopIndex] = useState<number | null>(null);
  const [issueText, setIssueText] = useState('');
  const [issueFile, setIssueFile] = useState<File | null>(null);
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [summaryRoute, setSummaryRoute] = useState<RouteItem | null>(null);

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
    const newStatus = driverStatus === 'active' ? 'offline' : 'active';
    try {
      await updateDoc(doc(db, 'drivers', driverId), { status: newStatus });
    } catch (error) {
      console.error("Error updating status", error);
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
          // If you have a VAPID key from Firebase Console, put it here:
          const token = await getToken(msg, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY });
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
  const pendingRoutes = routes?.filter(r => r.status === 'pending' && (r.driver === driverName || r.driver === 'Aguardando')) || [];

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

  const formatRouteId = (route: RouteItem) => {
    if (route.routeNumber) {
      return String(route.routeNumber).padStart(7, '0');
    }
    return route.id.slice(0, 8).toUpperCase();
  };

  if (activeRoute) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-20">
        <div className="bg-white shadow-sm p-4 sticky top-0 z-10 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-cyan/10 rounded-full flex items-center justify-center text-brand-cyan">
              <Truck size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Rota #{formatRouteId(activeRoute)}</h1>
              <p className="text-sm text-slate-500 font-medium">Em andamento</p>
            </div>
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
                    
                    {!isCompleted && !isIssue && (
                      <div className="mt-4 flex flex-col gap-2">
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 text-blue-700 rounded-xl font-semibold active:scale-[0.98] transition-transform"
                        >
                          <Navigation size={18} /> Navegar no Maps
                        </a>
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

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      <div className="bg-white shadow-sm p-5 sticky top-0 z-10 flex items-center justify-between border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Orkestria Entregador</h1>
          <p className="text-sm text-slate-500">Olá, {driverName?.split(' ')[0] || 'Motorista'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleOnlineStatus}
            className={`px-4 py-2 rounded-full font-bold text-sm transition-colors flex items-center gap-2 ${driverStatus === 'active' || driverStatus === 'on_route' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
          >
            <div className={`w-2 h-2 rounded-full ${driverStatus === 'active' || driverStatus === 'on_route' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {driverStatus === 'active' || driverStatus === 'on_route' ? 'Online' : 'Offline'}
          </button>
          <button onClick={() => signOut(auth)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
            <LogOut size={20} />
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
