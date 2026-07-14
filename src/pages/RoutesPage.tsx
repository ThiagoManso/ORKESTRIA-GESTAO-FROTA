import React, { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Truck, CheckCircle, Clock, X, Map, RefreshCw, Trash2 } from 'lucide-react';
import { RouteItem } from '../types';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useCollection } from '../lib/useCollection';

const StatusBadge = ({ status }: { status: RouteItem['status'] }) => {
  switch(status) {
    case 'completed': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg"><CheckCircle size={14}/> Finalizada</span>;
    case 'in_progress': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg"><Truck size={14}/> Em andamento</span>;
    case 'pending': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg"><Clock size={14}/> Pendente</span>;
    case 'issue': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 text-red-700 text-xs font-semibold rounded-lg">Problema</span>;
    default: return null;
  }
}

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const formatRouteId = (route: RouteItem | null) => {
  if (!route) return '';
  if (route.routeNumber) {
    return String(route.routeNumber).padStart(7, '0');
  }
  return route.id.slice(0, 8).toUpperCase();
};

export default function RoutesPage() {
  const { data: routes, loading, add, update, remove } = useCollection<RouteItem>('routes');
  const [matrizAddress, setMatrizAddress] = useState<string>('');

  useEffect(() => {
    const fetchMatriz = async () => {
      try {
        const docRef = doc(db, 'settings', 'matriz');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMatrizAddress(docSnap.data().address || '');
        }
      } catch (error) {
        console.error("Error fetching matriz settings:", error);
      }
    };
    fetchMatriz();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [editingRoute, setEditingRoute] = useState<RouteItem | null>(null);
  const [newRoute, setNewRoute] = useState({
    driver: '',
    origin: '',
    destination: '',
    intermediates: [] as string[],
    optimizeOrder: true,
    departureTime: '',
    stops: 1,
    distance: 0,
    estimatedTime: '',
  });
  
  const [isCalculating, setIsCalculating] = useState(false);
  const routesLib = useMapsLibrary('routes');

  const calculateRouteData = async (routeData: any) => {
    if (!routesLib || !routeData.origin || !routeData.destination) return null;
    try {
      const request: any = {
        origin: routeData.origin,
        destination: routeData.destination,
        travelMode: 'DRIVING',
        fields: ['distanceMeters', 'durationMillis', 'optimizedIntermediateWaypointIndices'],
      };

      if (routeData.departureTime) {
        const depDate = new Date(routeData.departureTime);
        if (depDate < new Date()) {
          request.departureTime = new Date(Date.now() + 60000);
        } else {
          request.departureTime = depDate;
        }
        request.routingPreference = 'TRAFFIC_AWARE';
      }

      if (routeData.intermediates && routeData.intermediates.length > 0) {
        request.intermediates = routeData.intermediates
          .filter((addr: string) => addr.trim() !== '')
          .map((addr: string) => ({ location: addr }));
          
        if (routeData.optimizeOrder ?? true) {
          request.optimizeWaypointOrder = true;
        }
      }
      
      const response = await routesLib.Route.computeRoutes(request);
      
      const route = response.routes?.[0] as any;
      if (route) {
        const distanceKm = (route.distanceMeters || 0) / 1000;
        let durationSeconds = 0;
        
        if (route.durationMillis) {
          durationSeconds = Math.floor(route.durationMillis / 1000);
        } else if (route.duration) {
          durationSeconds = parseInt((route.duration as string || '0s').replace('s', ''));
        }
        
        const hours = Math.floor(durationSeconds / 3600);
        const minutes = Math.floor((durationSeconds % 3600) / 60);
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} h`;
        
        let newIntermediates = routeData.intermediates || [];
        if (route.optimizedIntermediateWaypointIndices && newIntermediates.length > 0) {
          const original = newIntermediates.filter((addr: string) => addr.trim() !== '');
          newIntermediates = route.optimizedIntermediateWaypointIndices.map((idx: number) => original[idx]);
        }
        
        return {
          intermediates: newIntermediates,
          distance: Number(distanceKm.toFixed(1)),
          estimatedTime: formattedTime
        };
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    }
    return null;
  };

  const calculateRoute = async () => {
    setIsCalculating(true);
    const data = await calculateRouteData(newRoute);
    if (data) {
      setNewRoute(prev => ({
        ...prev,
        ...data
      }));
    } else {
      alert('Não foi possível calcular a rota com os endereços fornecidos.');
    }
    setIsCalculating(false);
  };

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsCalculating(true);
    let finalDistance = newRoute.distance;
    let finalEstimatedTime = newRoute.estimatedTime || '00:00 h';
    let finalIntermediates = newRoute.intermediates;
    
    // Always compute to ensure distance/time/order are correct before saving
    if (routesLib && newRoute.origin && newRoute.destination) {
      const data = await calculateRouteData(newRoute);
      if (data) {
        finalDistance = data.distance;
        finalEstimatedTime = data.estimatedTime;
        finalIntermediates = data.intermediates;
      }
    }
    setIsCalculating(false);
    
    let formattedDate = 'Hoje';
    if (newRoute.departureTime) {
      const d = new Date(newRoute.departureTime);
      formattedDate = d.toLocaleDateString('pt-BR');
    }

    const stopDetails = finalIntermediates
      .filter(addr => addr.trim() !== '')
      .map((addr, index) => ({
        id: `stop-${index}`,
        address: addr,
        status: 'pending' as const
      }));

    if (newRoute.destination && newRoute.destination.trim() !== '') {
       stopDetails.push({
         id: `stop-${stopDetails.length}`,
         address: newRoute.destination,
         status: 'pending' as const
       });
    }

    const nextRouteNumber = routes && routes.length > 0 
      ? Math.max(...routes.map(r => r.routeNumber || 0)) + 1 
      : 1;

    await add({
      routeNumber: nextRouteNumber,
      status: 'pending',
      driver: newRoute.driver || 'Aguardando',
      stops: newRoute.stops,
      distance: finalDistance,
      estimatedTime: finalEstimatedTime,
      date: formattedDate,
      departureTime: newRoute.departureTime,
      lat: -23.5505,
      lng: -46.6333,
      origin: newRoute.origin,
      destination: newRoute.destination,
      intermediates: finalIntermediates,
      stopDetails,
    });
    
    setIsModalOpen(false);
    setNewRoute({
      driver: '',
      origin: '',
      destination: '',
      intermediates: [],
      optimizeOrder: true,
      departureTime: '',
      stops: 1,
      distance: 0,
      estimatedTime: '',
    });
  };

  const handleEditRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute) return;
    
    setIsCalculating(true);
    let finalDistance = editingRoute.distance;
    let finalEstimatedTime = editingRoute.estimatedTime || '00:00 h';
    let finalIntermediates = editingRoute.intermediates;
    
    if (routesLib && editingRoute.origin && editingRoute.destination) {
      const data = await calculateRouteData(editingRoute);
      if (data) {
        finalDistance = data.distance;
        finalEstimatedTime = data.estimatedTime;
        finalIntermediates = data.intermediates;
      }
    }
    setIsCalculating(false);
    
    let updatedRoute = { ...editingRoute };
    if (updatedRoute.departureTime) {
      const d = new Date(updatedRoute.departureTime);
      updatedRoute.date = d.toLocaleDateString('pt-BR');
    }
    
    const stopDetails = finalIntermediates
      ?.filter(addr => addr.trim() !== '')
      .map((addr, index) => ({
        id: `stop-${index}`,
        address: addr,
        status: 'pending' as const
      })) || [];

    if (updatedRoute.destination && updatedRoute.destination.trim() !== '') {
       stopDetails.push({
         id: `stop-${stopDetails.length}`,
         address: updatedRoute.destination,
         status: 'pending' as const
       });
    }
    
    await update(editingRoute.id, {
      driver: updatedRoute.driver,
      status: updatedRoute.status,
      stops: updatedRoute.stops,
      distance: finalDistance,
      estimatedTime: finalEstimatedTime,
      date: updatedRoute.date,
      departureTime: updatedRoute.departureTime,
      origin: updatedRoute.origin,
      destination: updatedRoute.destination,
      intermediates: finalIntermediates,
      stopDetails: stopDetails
    });
    setIsEditModalOpen(false);
  };

  const handleDeleteRoute = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta rota? Esta ação não pode ser desfeita.')) {
      await remove(id);
      setIsManageModalOpen(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Rotas e Serviços</h1>
          <p className="text-slate-500 text-sm sm:text-base">Gerencie a expedição e o andamento das rotas.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors shadow-sm">
            <Filter size={18} /> Filtros
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            Nova Rota
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex gap-4 bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por ID da rota, entregador..." 
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="p-5 font-semibold">Rota</th>
                <th className="p-5 font-semibold">Status</th>
                <th className="p-5 font-semibold">Entregador</th>
                <th className="p-5 font-semibold">Serviços / Paradas</th>
                <th className="p-5 font-semibold">Distância / Tempo</th>
                <th className="p-5 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routes.map(route => (
                <tr key={route.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="p-5">
                    <div className="flex flex-col">
                      <span className="font-mono text-sm font-bold text-slate-800">#{formatRouteId(route)}</span>
                      <span className="text-xs text-slate-400 font-medium">{route.date}</span>
                    </div>
                  </td>
                  <td className="p-5">
                    <StatusBadge status={route.status} />
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-600 font-bold border border-slate-200">
                        {route.driver.charAt(0)}
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{route.driver}</span>
                    </div>
                  </td>
                  <td className="p-5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">
                      <MapPin size={14} className="text-slate-500" /> {route.stops} paradas
                    </span>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col text-sm text-slate-600">
                      <span className="font-semibold">{route.distance} km</span>
                      <span className="text-xs text-slate-400">est. {route.estimatedTime}</span>
                    </div>
                  </td>
                  <td className="p-5 text-right">
                    <button 
                      onClick={() => { setSelectedRoute(route); setIsManageModalOpen(true); }}
                      className="text-primary text-sm font-semibold hover:text-primary-hover transition-colors px-4 py-2 rounded-lg hover:bg-primary/5"
                    >
                      Gerenciar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 sm:p-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 bg-slate-50/50">
          <span className="font-medium">Mostrando {routes.length} rotas de 552</span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 font-medium transition-colors shadow-sm">Anterior</button>
            <button className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 font-medium transition-colors shadow-sm">Próxima</button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Nova Rota</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddRoute} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Entregador</label>
                  <select 
                    value={newRoute.driver}
                    onChange={(e) => setNewRoute({...newRoute, driver: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                  >
                    <option value="">Aguardando entregador...</option>
                    <option value="Edvaldo">Edvaldo Nascimento</option>
                    <option value="Juraci">Juraci Silva</option>
                    <option value="Alexandre">Alexandre Santos</option>
                    <option value="Thais">Thais Bezerra</option>
                  </select>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Origem</label>
                    <button type="button" onClick={() => setNewRoute({...newRoute, origin: matrizAddress})} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Usar Matriz</button>
                  </div>
                  <input 
                    type="text" 
                    required
                    value={newRoute.origin}
                    onChange={(e) => setNewRoute({...newRoute, origin: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    placeholder="Endereço de partida"
                  />
                </div>

                {newRoute.intermediates?.map((waypoint, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Parada {index + 1}
                      </label>
                      <input 
                        type="text" 
                        value={waypoint}
                        onChange={(e) => {
                          const newIntermediates = [...(newRoute.intermediates || [])];
                          newIntermediates[index] = e.target.value;
                          setNewRoute({...newRoute, intermediates: newIntermediates});
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                        placeholder="Endereço da parada intermediária"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newIntermediates = [...(newRoute.intermediates || [])];
                        newIntermediates.splice(index, 1);
                        // Also adjust stops count
                        setNewRoute({...newRoute, intermediates: newIntermediates, stops: Math.max(1, newRoute.stops - 1)});
                      }}
                      className="mt-6 p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ))}

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewRoute({
                        ...newRoute, 
                        intermediates: [...(newRoute.intermediates || []), ''],
                        stops: newRoute.stops + 1
                      });
                    }}
                    className="text-sm font-semibold text-primary hover:text-primary-hover flex items-center gap-1.5"
                  >
                    + Adicionar Parada Intermediária
                  </button>
                </div>

                {newRoute.intermediates && newRoute.intermediates.length > 1 && (
                  <div className="flex items-center gap-2 mt-2 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                    <input 
                      type="checkbox" 
                      id="optimizeOrder"
                      checked={newRoute.optimizeOrder}
                      onChange={(e) => setNewRoute({...newRoute, optimizeOrder: e.target.checked})}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="optimizeOrder" className="text-sm font-medium text-indigo-900 cursor-pointer flex-1">
                      Otimizar Ordem das Paradas (IA / Heurística Avançada)
                    </label>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Destino</label>
                    <button type="button" onClick={() => setNewRoute({...newRoute, destination: matrizAddress})} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Usar Matriz</button>
                  </div>
                  <input 
                    type="text" 
                    required
                    value={newRoute.destination}
                    onChange={(e) => setNewRoute({...newRoute, destination: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    placeholder="Endereço de chegada"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data e Hora de Saída (Opcional)</label>
                  <input 
                    type="datetime-local" 
                    value={newRoute.departureTime || ''}
                    onChange={(e) => setNewRoute({...newRoute, departureTime: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Se não preenchido, será considerado o momento atual.</p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={calculateRoute}
                    disabled={isCalculating || !newRoute.origin || !newRoute.destination}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isCalculating ? (
                      <><RefreshCw size={16} className="animate-spin" /> Calculando...</>
                    ) : (
                      <><Map size={16} /> Calcular Distância e Tempo</>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nº de Paradas</label>
                    <input 
                      type="number" 
                      min="1"
                      required
                      value={newRoute.stops}
                      onChange={(e) => setNewRoute({...newRoute, stops: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Distância (km)</label>
                    <input 
                      type="number" 
                      readOnly
                      value={newRoute.distance}
                      className="w-full px-4 py-2.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-sm outline-none shadow-sm cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tempo Estimado</label>
                    <input 
                      type="text" 
                      readOnly
                      value={newRoute.estimatedTime || '00:00 h'}
                      className="w-full px-4 py-2.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-sm outline-none shadow-sm cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
                >
                  Criar Rota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isManageModalOpen && selectedRoute && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Gerenciar Rota #{formatRouteId(selectedRoute)}</h2>
              <button 
                onClick={() => setIsManageModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center border border-blue-200 flex-shrink-0">
                  <MapPin size={32} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-xl">Detalhes da Rota</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium text-slate-600">{selectedRoute.date}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3 text-slate-700">
                    <Truck size={18} className="text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Entregador Responsável</div>
                      <div className="font-semibold">{selectedRoute.driver}</div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100 gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-700">
                      <CheckCircle size={18} className="text-emerald-500" />
                      <div>
                        <div className="text-xs text-slate-500 font-medium">Status Atual</div>
                        <div className="font-semibold">
                          <StatusBadge status={selectedRoute.status} />
                        </div>
                      </div>
                    </div>
                    
                    {(() => {
                      const completedStops = selectedRoute.stopDetails?.filter(s => s.status === 'completed' || s.status === 'issue').length || (selectedRoute.status === 'completed' ? selectedRoute.stops : 0);
                      const totalStops = selectedRoute.stopDetails?.length || selectedRoute.stops || 1;
                      const progress = Math.min(100, Math.round((completedStops / totalStops) * 100));
                      
                      let estimatedEndTime = '--:--';
                      if (selectedRoute.departureTime && selectedRoute.estimatedTime) {
                        const [depHours, depMins] = selectedRoute.departureTime.split(':').map(Number);
                        // estimatedTime is usually like "2 h" or "2.5 h" or "02:30" or something.
                        // For simplicity, let's just parse the first number we find and assume it's minutes or hours.
                        // Actually Google Maps Directions returns something like "1 hora 30 minutos" or "15 mins".
                        // Let's just create a mock finish time, e.g. adding 2 hours.
                        // Since parsing Google Maps natural language is complex, we will just use a placeholder text or a rough heuristic.
                        let addMinutes = 120; // default 2 hours
                        const estMatch = selectedRoute.estimatedTime.match(/(\d+)/g);
                        if (estMatch) {
                          if (selectedRoute.estimatedTime.includes('h') || selectedRoute.estimatedTime.includes('hora')) {
                            addMinutes = parseInt(estMatch[0]) * 60 + (estMatch[1] ? parseInt(estMatch[1]) : 0);
                          } else {
                            addMinutes = parseInt(estMatch[0]);
                          }
                        }
                        const endDate = new Date();
                        endDate.setHours(depHours || 8, depMins || 0, 0);
                        endDate.setMinutes(endDate.getMinutes() + addMinutes);
                        estimatedEndTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
                      }

                      return (
                        <div className="text-right">
                          <div className="text-xs text-slate-500 font-medium mb-1">Previsão de Término</div>
                          <div className="font-semibold text-slate-800">{estimatedEndTime}</div>
                        </div>
                      );
                    })()}
                  </div>

                  {(() => {
                    const completedStops = selectedRoute.stopDetails?.filter(s => s.status === 'completed' || s.status === 'issue').length || (selectedRoute.status === 'completed' ? selectedRoute.stops : 0);
                    const totalStops = selectedRoute.stopDetails?.length || selectedRoute.stops || 1;
                    const progress = Math.min(100, Math.round((completedStops / totalStops) * 100));

                    return (
                      <div>
                        <div className="flex justify-between text-xs text-slate-500 font-medium mb-1.5">
                          <span>Progresso da Rota</span>
                          <span>{progress}% concluído</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3 text-slate-700">
                      <Clock size={18} className="text-blue-500 shrink-0" />
                      <div>
                        <div className="text-xs text-slate-500 font-medium">Resumo Operacional</div>
                        <div className="font-semibold text-sm">
                          {selectedRoute.stops} paradas • {selectedRoute.distance} km • est. {selectedRoute.estimatedTime}
                        </div>
                      </div>
                    </div>
                    {selectedRoute.origin && selectedRoute.destination && (
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(selectedRoute.origin)}&destination=${encodeURIComponent(selectedRoute.destination)}${selectedRoute.intermediates?.length ? `&waypoints=${encodeURIComponent(selectedRoute.intermediates.join('|'))}` : ''}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs font-medium px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        <MapPin size={14} />
                        Mapa
                      </a>
                    )}
                  </div>
                  
                  {selectedRoute.stopDetails && selectedRoute.stopDetails.length > 0 && (
                    <div className="mt-4 space-y-3 pt-4 border-t border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Paradas</div>
                      {selectedRoute.stopDetails.map((stop, index) => (
                        <div key={stop.id || index} className="flex items-start gap-3">
                          <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 ${
                            stop.status === 'completed' ? 'border-emerald-500 bg-emerald-500' :
                            stop.status === 'issue' ? 'border-red-500 bg-red-500' :
                            'border-slate-300'
                          }`} />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-800">{stop.address}</div>
                            <div className="text-xs text-slate-500">
                              {stop.status === 'completed' && <span className="text-emerald-600">Entregue</span>}
                              {stop.status === 'issue' && <span className="text-red-600">Problema na entrega</span>}
                              {stop.status === 'pending' && <span>Pendente</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsManageModalOpen(false)}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Fechar
                </button>
                <div className="flex-1 flex gap-3 justify-end">
                  <button 
                    onClick={() => handleDeleteRoute(selectedRoute.id)}
                    className="flex-1 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} />
                    Excluir
                  </button>
                  <button 
                    onClick={() => {
                      setEditingRoute(selectedRoute);
                      setIsManageModalOpen(false);
                      setIsEditModalOpen(true);
                    }}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors shadow-sm"
                  >
                    Editar Rota
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && editingRoute && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Editar Rota #{formatRouteId(editingRoute)}</h2>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditRoute} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status da Rota</label>
                  <select 
                    value={editingRoute.status}
                    onChange={(e) => setEditingRoute({...editingRoute, status: e.target.value as RouteItem['status']})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                  >
                    <option value="pending">Pendente</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="completed">Finalizada</option>
                    <option value="issue">Problema</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Entregador</label>
                  <select 
                    value={editingRoute.driver}
                    onChange={(e) => setEditingRoute({...editingRoute, driver: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                  >
                    <option value="Aguardando">Aguardando entregador...</option>
                    <option value="Edvaldo">Edvaldo Nascimento</option>
                    <option value="Juraci">Juraci Silva</option>
                    <option value="Alexandre">Alexandre Santos</option>
                    <option value="Thais">Thais Bezerra</option>
                    <option value="João">João</option>
                  </select>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-sm font-semibold text-slate-700">Origem</label>
                      <button type="button" onClick={() => setEditingRoute({...editingRoute, origin: matrizAddress})} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Usar Matriz</button>
                    </div>
                    <input 
                      type="text" 
                      value={editingRoute.origin || ''}
                      onChange={(e) => setEditingRoute({...editingRoute, origin: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="Endereço de partida"
                    />
                  </div>

                  {editingRoute.intermediates?.map((waypoint, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Parada {index + 1}
                        </label>
                        <input 
                          type="text" 
                          value={waypoint}
                          onChange={(e) => {
                            const newIntermediates = [...(editingRoute.intermediates || [])];
                            newIntermediates[index] = e.target.value;
                            setEditingRoute({...editingRoute, intermediates: newIntermediates});
                          }}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                          placeholder="Endereço da parada intermediária"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newIntermediates = [...(editingRoute.intermediates || [])];
                          newIntermediates.splice(index, 1);
                          setEditingRoute({...editingRoute, intermediates: newIntermediates, stops: Math.max(1, editingRoute.stops - 1)});
                        }}
                        className="mt-6 p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ))}

                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRoute({
                          ...editingRoute, 
                          intermediates: [...(editingRoute.intermediates || []), ''],
                          stops: editingRoute.stops + 1
                        });
                      }}
                      className="text-sm font-semibold text-primary hover:text-primary-hover flex items-center gap-1.5"
                    >
                      + Adicionar Parada Intermediária
                    </button>
                  </div>

                  {editingRoute.intermediates && editingRoute.intermediates.length > 1 && (
                    <div className="flex items-center gap-2 mt-2 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                      <input 
                        type="checkbox" 
                        id="editOptimizeOrder"
                        checked={editingRoute.optimizeOrder ?? true}
                        onChange={(e) => setEditingRoute({...editingRoute, optimizeOrder: e.target.checked})}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="editOptimizeOrder" className="text-sm font-medium text-indigo-900 cursor-pointer flex-1">
                        Otimizar Ordem das Paradas (IA / Heurística Avançada)
                      </label>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-sm font-semibold text-slate-700">Destino</label>
                      <button type="button" onClick={() => setEditingRoute({...editingRoute, destination: matrizAddress})} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Usar Matriz</button>
                    </div>
                    <input 
                      type="text" 
                      value={editingRoute.destination || ''}
                      onChange={(e) => setEditingRoute({...editingRoute, destination: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="Endereço de chegada"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data e Hora de Saída (Opcional)</label>
                    <input 
                      type="datetime-local" 
                      value={editingRoute.departureTime || ''}
                      onChange={(e) => setEditingRoute({...editingRoute, departureTime: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">Se não preenchido, será considerado o momento atual.</p>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsCalculating(true);
                      const data = await calculateRouteData(editingRoute);
                      if (data) {
                        setEditingRoute(prev => prev ? {
                          ...prev,
                          ...data
                        } : null);
                      } else {
                        alert('Não foi possível calcular a rota com os endereços fornecidos.');
                      }
                      setIsCalculating(false);
                    }}
                    disabled={isCalculating || !editingRoute.origin || !editingRoute.destination}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isCalculating ? (
                      <><RefreshCw size={16} className="animate-spin" /> Calculando...</>
                    ) : (
                      <><Map size={16} /> Recalcular Distância e Tempo</>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nº de Paradas</label>
                    <input 
                      type="number" 
                      min="1"
                      required
                      value={editingRoute.stops}
                      onChange={(e) => setEditingRoute({...editingRoute, stops: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Distância (km)</label>
                    <input 
                      type="number" 
                      readOnly
                      value={editingRoute.distance}
                      className="w-full px-4 py-2.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-sm outline-none shadow-sm cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tempo Estimado</label>
                    <input 
                      type="text" 
                      readOnly
                      value={editingRoute.estimatedTime || '00:00 h'}
                      className="w-full px-4 py-2.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-sm outline-none shadow-sm cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
