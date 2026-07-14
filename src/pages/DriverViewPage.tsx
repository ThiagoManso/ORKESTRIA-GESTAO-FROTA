import React, { useState, useEffect } from 'react';
import { RouteItem } from '../types';
import { useCollection } from '../lib/useCollection';
import { MapPin, CheckCircle, AlertTriangle, Truck, Navigation, Package, XCircle, LogOut, BellRing } from 'lucide-react';
import { auth, messaging, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';

interface DriverViewPageProps {
  driverId?: string;
  driverName?: string;
  driverStatus?: string;
}

export default function DriverViewPage({ driverId, driverName, driverStatus }: DriverViewPageProps) {
  const { data: routes, update } = useCollection<RouteItem>('routes');
  const [notificationStatus, setNotificationStatus] = useState<string>('default');
  
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
          // const token = await getToken(msg, { vapidKey: 'YOUR_VAPID_KEY' });
          const token = await getToken(msg);
          console.log('FCM Token:', token);
          
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
    const allCompleted = newStopDetails.every(s => s.status === 'completed');
    
    await update(route.id, { 
      stopDetails: newStopDetails,
      ...(allCompleted ? { status: 'completed' } : {})
    });
  };

  const handleIssueStop = async (route: RouteItem, stopIndex: number) => {
    if (!route.stopDetails) return;
    const newStopDetails = [...route.stopDetails];
    newStopDetails[stopIndex] = { ...newStopDetails[stopIndex], status: 'issue' };
    
    await update(route.id, { stopDetails: newStopDetails });
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
      </div>
    </div>
  );
}
