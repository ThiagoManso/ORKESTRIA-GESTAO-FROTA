import React, { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Truck, CheckCircle, Clock, X, Map, RefreshCw, Trash2, Upload, Download, Package } from 'lucide-react';
import { RouteItem } from '../types';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useCollection } from '../lib/useCollection';
import { ExternalRequest } from '../types';

const StatusBadge = ({ status }: { status: RouteItem['status'] }) => {
  switch(status) {
    case 'completed': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg"><CheckCircle size={14}/> Finalizada</span>;
    case 'in_progress': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg"><Truck size={14}/> Em andamento</span>;
    case 'pending': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg"><Clock size={14}/> Pendente</span>;
    case 'issue': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 text-red-700 text-xs font-semibold rounded-lg">Problema</span>;
    default: return null;
  }
}

import { doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
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
  const { data: drivers } = useCollection<any>('drivers');
  const { data: externalRequests, update: updateRequest } = useCollection<ExternalRequest>('external_requests');
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
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [editingRoute, setEditingRoute] = useState<RouteItem | null>(null);
  const [newRoute, setNewRoute] = useState({
    driver: '',
    origin: '',
    destination: '',
    intermediates: [] as string[],
    intermediateMetadata: [] as any[],
    optimizeOrder: true,
    departureTime: '',
    stops: 1,
    distance: 0,
    estimatedTime: '',
    returnToMatriz: false,
  });
  
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    // Check if we arrived here from Map selection
    const mapSelection = localStorage.getItem('mapSelectedRequests');
    if (mapSelection && externalRequests && externalRequests.length > 0) {
      try {
        const selectedIds = JSON.parse(mapSelection);
        if (Array.isArray(selectedIds) && selectedIds.length > 0) {
          const selectedReqs = externalRequests.filter(r => selectedIds.includes(r.id));
          if (selectedReqs.length > 0) {
            const newStops = [];
            const newMeta = [];
            
            selectedReqs.forEach(req => {
              newStops.push(req.address);
              newMeta.push({
                orderNumber: req.orderNumber || req.osNumber || '',
                customerName: req.requesterName || '',
                customerPhone: req.contactPhone || '',
                observation: req.observations || '',
                externalRequestId: req.id,
                lat: req.lat || null,
                lng: req.lng || null
              });
            });
            
            setNewRoute(prev => ({
              ...prev,
              intermediates: newStops,
              intermediateMetadata: newMeta,
              stops: Math.max(1, newStops.length)
            }));
            
            setSelectedRequestIds(selectedIds);
            setIsModalOpen(true);
            localStorage.removeItem('mapSelectedRequests');
          }
        }
      } catch (e) {
        console.error("Error parsing map selection", e);
        localStorage.removeItem('mapSelectedRequests');
      }
    }
  }, [externalRequests]);

  const routesLib = useMapsLibrary('routes');

  const calculateRouteData = async (routeData: any) => {
    if (!routesLib || !routeData.origin || !routeData.destination) return { error: 'Preencha a origem e destino.' };
    try {
      const directionsService = new routesLib.DirectionsService();
      const waypoints = (routeData.intermediates || [])
        .filter((addr: string) => addr.trim() !== '')
        .map((addr: string) => ({ location: addr, stopover: true }));

      const request: any = {
        origin: routeData.origin,
        destination: routeData.destination,
        travelMode: 'DRIVING',
        waypoints: waypoints,
        optimizeWaypoints: routeData.optimizeOrder ?? true,
      };

      if (routeData.departureTime) {
        const depDate = new Date(routeData.departureTime);
        request.drivingOptions = {
          departureTime: depDate < new Date() ? new Date(Date.now() + 60000) : depDate,
          trafficModel: 'bestguess'
        };
      }

      const response = await directionsService.route(request);
      const route = response.routes?.[0];
      
      if (route) {
        let totalDistance = 0;
        let totalDuration = 0;
        
        route.legs.forEach((leg: any) => {
          totalDistance += leg.distance?.value || 0;
          totalDuration += leg.duration?.value || 0;
        });

        const distanceKm = totalDistance / 1000;
        const hours = Math.floor(totalDuration / 3600);
        const minutes = Math.floor((totalDuration % 3600) / 60);
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} h`;
        

        let newIntermediates = routeData.intermediates || [];
        let newMetadata = routeData.intermediateMetadata || [];
        
        let validIndices = newIntermediates.map((addr: string, idx: number) => addr.trim() !== '' ? idx : -1).filter((i: number) => i !== -1);
        
        if (route.waypoint_order && route.waypoint_order.length > 0) {
          const originalAddresses = validIndices.map((idx: number) => newIntermediates[idx]);
          const originalMetadata = validIndices.map((idx: number) => newMetadata[idx] || {});
          
          newIntermediates = route.waypoint_order.map((idx: number) => originalAddresses[idx]);
          newMetadata = route.waypoint_order.map((idx: number) => originalMetadata[idx]);
        }
        
        // Extract lat/lng for intermediates from legs
        // route.legs[i].end_location gives the coordinate of waypoint i
        // route.legs[legs.length - 1].end_location gives destination
        for(let i = 0; i < newIntermediates.length; i++) {
          if (route.legs[i] && route.legs[i].end_location) {
             if(!newMetadata[i]) newMetadata[i] = {};
             newMetadata[i].lat = route.legs[i].end_location.lat();
             newMetadata[i].lng = route.legs[i].end_location.lng();
          }
        }
        
        // Save destination lat/lng
        const destLeg = route.legs[route.legs.length - 1];
        let destinationLat, destinationLng;
        if (destLeg && destLeg.end_location) {
          destinationLat = destLeg.end_location.lat();
          destinationLng = destLeg.end_location.lng();
        }

        return {
          intermediates: newIntermediates,
          intermediateMetadata: newMetadata,
          distance: Number(distanceKm.toFixed(1)),
          estimatedTime: formattedTime,
          destinationLat,
          destinationLng
        };

      }
    } catch (error: any) {
      console.error('Error calculating route:', error);
      return { error: error?.message || error?.code || 'Erro desconhecido ao calcular a rota com a API do Google Maps.' };
    }
    return { error: 'Nenhuma rota encontrada.' };
  };

  
  const downloadCSVTemplate = () => {
    const csvContent = "Endereço;N° Pedido / OS;Nome;Telefone;Observação\nEx: Rua das Flores 123 - SP;1001;João Silva;11999999999;Entregar na portaria";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_rota.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isEditing: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      if (lines.length <= 1) return;

      // Detect separator (comma or semicolon)
      const headerLine = lines[0];
      const separator = headerLine.includes(';') ? ';' : ',';
      
      const newStops: string[] = [];
      const newMeta: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Simple CSV parse (does not handle quoted fields with separators well, but enough for simple inputs)
        const cols = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
        const address = cols[0];
        
        if (address) {
          newStops.push(address);
          newMeta.push({
            orderNumber: cols[1] || '',
            customerName: cols[2] || '',
            customerPhone: cols[3] || '',
            observation: cols[4] || ''
          });
        }
      }

      if (newStops.length > 0) {
        if (isEditing) {
          setEditingRoute((prev: any) => ({
            ...prev,
            intermediates: newStops,
            intermediateMetadata: newMeta,
            stops: Math.max(1, newStops.length)
          }));
        } else {
          setNewRoute(prev => ({
            ...prev,
            intermediates: newStops,
            intermediateMetadata: newMeta,
            stops: Math.max(1, newStops.length)
          }));
        }
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset input
  };

  const calculateRoute = async () => {
    setIsCalculating(true);
    const data = await calculateRouteData(newRoute);
    if (data && !data.error) {
      setNewRoute(prev => ({
        ...prev,
        ...data
      }));
    } else {
      alert('Não foi possível calcular a rota com os endereços fornecidos. Erro: ' + (data?.error || ''));
    }
    setIsCalculating(false);
  };

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsCalculating(true);
    let finalDistance = newRoute.distance;
    let finalEstimatedTime = newRoute.estimatedTime || '00:00 h';
    let finalIntermediates = newRoute.intermediates;
    let finalMetadata = newRoute.intermediateMetadata || [];
    
    // Always compute to ensure distance/time/order are correct before saving
    if (newRoute.distance > 0) {
      // Já foi calculado antes pelo botão de calcular, vamos economizar API!
      finalDistance = newRoute.distance;
      finalEstimatedTime = newRoute.estimatedTime || '00:00 h';
      finalIntermediates = newRoute.intermediates;
      finalMetadata = newRoute.intermediateMetadata || [];
    } else if (routesLib && newRoute.origin && newRoute.destination) {
      const data = await calculateRouteData(newRoute);
      if (data && !data.error) {
        finalDistance = data.distance;
        finalEstimatedTime = data.estimatedTime;
        finalIntermediates = data.intermediates;
        finalMetadata = data.intermediateMetadata || [];
        finalMetadata = data.intermediateMetadata || [];
      } else {
        alert('Não foi possível calcular a rota com os endereços fornecidos. Erro: ' + (data?.error || ''));
        setIsCalculating(false);
        return; // Prevent saving the route if calculation fails
      }
    }
    setIsCalculating(false);
    
    let formattedDate = 'Hoje';
    if (newRoute.departureTime) {
      const d = new Date(newRoute.departureTime);
      formattedDate = d.toLocaleDateString('pt-BR');
    }


    const validIntermediates = finalIntermediates.map((addr, i) => ({ addr, meta: finalMetadata[i] || {} })).filter(item => item.addr.trim() !== '');
    const stopDetails = validIntermediates.map((item, index) => ({
      id: `stop-${index}`,
      address: item.addr,
      status: 'pending' as const,
      orderNumber: item.meta.orderNumber || '',
      customerName: item.meta.customerName || '',
      customerPhone: item.meta.customerPhone || '',
      observation: item.meta.observation || '',
      externalRequestId: item.meta.externalRequestId || '',
      lat: item.meta.lat || null,
      lng: item.meta.lng || null,
    }));

    if (newRoute.destination && newRoute.destination.trim() !== '' && !newRoute.returnToMatriz) {
       stopDetails.push({
         id: `stop-${stopDetails.length}`,
         address: newRoute.destination,
         status: 'pending' as const,
         lat: (newRoute as any).destinationLat || null,
         lng: (newRoute as any).destinationLng || null,
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
      returnToMatriz: newRoute.returnToMatriz,
    });
    
    if (selectedRequestIds.length > 0) {
      for (const reqId of selectedRequestIds) {
        await updateRequest(reqId, { status: 'on_route' });
      }
      setSelectedRequestIds([]);
    }

    setIsModalOpen(false);
    setNewRoute({
      driver: '',
      origin: '',
      destination: '',
      intermediates: [],
      intermediateMetadata: [],
      optimizeOrder: true,
      departureTime: '',
      stops: 1,
      distance: 0,
      estimatedTime: '',
      returnToMatriz: false,
    });
  };

  const handleEditRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute) return;
    
    setIsCalculating(true);
    let finalDistance = editingRoute.distance;
    let finalEstimatedTime = editingRoute.estimatedTime || '00:00 h';
    let finalIntermediates = editingRoute.intermediates;
    let finalMetadata = (editingRoute as any).intermediateMetadata || [];
    
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
    
    const validEditIntermediates = finalIntermediates?.map((addr, i) => ({ addr, meta: finalMetadata[i] || {} })).filter(item => item.addr.trim() !== '') || [];
    const stopDetails = validEditIntermediates.map((item, index) => {
      // Preserve existing status if the address matches an existing stop
      const existingStop = editingRoute.stopDetails?.find(s => s.address === item.addr);
      return {
        id: existingStop ? existingStop.id : `stop-${index}`,
        address: item.addr,
        status: existingStop ? existingStop.status : ('pending' as const),
        orderNumber: item.meta.orderNumber || '',
        customerName: item.meta.customerName || '',
        customerPhone: item.meta.customerPhone || '',
        observation: item.meta.observation || '',
      };
    });

    if (updatedRoute.destination && updatedRoute.destination.trim() !== '' && !updatedRoute.returnToMatriz) {
       const existingDest = editingRoute.stopDetails?.find(s => s.address === updatedRoute.destination);
       stopDetails.push({
         id: existingDest ? existingDest.id : `stop-${stopDetails.length}`,
         address: updatedRoute.destination,
         status: existingDest ? existingDest.status : ('pending' as const)
       });
    }
    
    await update(editingRoute.id, {
      driver: updatedRoute.driver || 'Aguardando',
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
    if (window.confirm('Tem certeza que deseja excluir esta rota? Os endereços retornarão ao Banco de Demandas.')) {
      const routeToCancel = routes.find(r => r.id === id);
      if (routeToCancel && routeToCancel.stopDetails) {
        for (const stop of routeToCancel.stopDetails) {
          try {
            if (stop.externalRequestId) {
              const reqRef = doc(db, 'external_requests', stop.externalRequestId);
              await updateDoc(reqRef, { status: 'pending' });
            } else if (stop.address && stop.address.trim() !== '' && stop.id !== `stop-${routeToCancel.stopDetails.length - 1}`) {
              // Create new demand for manual stops, ignore destination if it's the last stop and we didn't specify return
              await addDoc(collection(db, 'external_requests'), {
                type: 'entrega',
                address: stop.address,
                orderNumber: stop.orderNumber || '',
                requesterName: stop.customerName || '',
                contactPhone: stop.customerPhone || '',
                observations: stop.observation || '',
                scheduledDate: '',
                status: 'pending',
                read: true,
                createdAt: new Date().toISOString(),
                lat: stop.lat || null,
                lng: stop.lng || null
              });
            }
          } catch (err) {
            console.error("Failed to restore stop", stop, err);
          }
        }
      }
      await remove(id);
      setIsManageModalOpen(false);
    }
  };


  const currentManageRoute = selectedRoute ? (routes.find(r => r.id === selectedRoute.id) || selectedRoute) : null;

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
                    {drivers?.filter((d: any) => d.status === 'active' || d.status === 'on_route').map((d: any) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
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

                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-sm font-semibold text-slate-800">Paradas da Rota</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setIsRequestsModalOpen(true)} className="text-xs font-semibold px-3 py-1.5 bg-emerald-500 text-white rounded-lg shadow-sm hover:bg-emerald-600 flex items-center gap-1.5 transition-colors">
                      <Package size={14} /> Puxar Solicitações
                    </button>

                  </div>
                </div>
                
                <div className="max-h-48 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {newRoute.intermediates?.map((waypoint, index) => (
                  <div key={index} className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative group">
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                      <div className="lg:col-span-5">
                        <label className="block text-xs font-semibold text-slate-500 mb-1 lg:hidden">
                          Parada {index + 1} - Endereço
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="hidden lg:flex w-6 h-6 bg-slate-100 text-slate-500 rounded-full text-xs items-center justify-center font-bold flex-shrink-0">
                            {index + 1}
                          </span>
                          <input 
                            type="text" 
                            value={waypoint}
                            onChange={(e) => {
                              const newIntermediates = [...(newRoute.intermediates || [])];
                              newIntermediates[index] = e.target.value;
                              setNewRoute({...newRoute, intermediates: newIntermediates});
                            }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:bg-white transition-colors"
                            placeholder="Endereço da parada"
                          />
                        </div>
                      </div>
                      
                      <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input type="text" placeholder="Nº Ped/OS" value={newRoute.intermediateMetadata?.[index]?.orderNumber || ''} onChange={(e) => {
                          const newMeta = [...(newRoute.intermediateMetadata || [])];
                          if(!newMeta[index]) newMeta[index] = {};
                          newMeta[index].orderNumber = e.target.value;
                          setNewRoute({...newRoute, intermediateMetadata: newMeta});
                        }} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-primary focus:bg-white" />
                        <input type="text" placeholder="Nome" value={newRoute.intermediateMetadata?.[index]?.customerName || ''} onChange={(e) => {
                          const newMeta = [...(newRoute.intermediateMetadata || [])];
                          if(!newMeta[index]) newMeta[index] = {};
                          newMeta[index].customerName = e.target.value;
                          setNewRoute({...newRoute, intermediateMetadata: newMeta});
                        }} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-primary focus:bg-white" />
                        <input type="text" placeholder="Telefone" value={newRoute.intermediateMetadata?.[index]?.customerPhone || ''} onChange={(e) => {
                          const newMeta = [...(newRoute.intermediateMetadata || [])];
                          if(!newMeta[index]) newMeta[index] = {};
                          newMeta[index].customerPhone = e.target.value;
                          setNewRoute({...newRoute, intermediateMetadata: newMeta});
                        }} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-primary focus:bg-white" />
                        <input type="text" placeholder="Observação" value={newRoute.intermediateMetadata?.[index]?.observation || ''} onChange={(e) => {
                          const newMeta = [...(newRoute.intermediateMetadata || [])];
                          if(!newMeta[index]) newMeta[index] = {};
                          newMeta[index].observation = e.target.value;
                          setNewRoute({...newRoute, intermediateMetadata: newMeta});
                        }} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-primary focus:bg-white" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newIntermediates = [...(newRoute.intermediates || [])];
                        newIntermediates.splice(index, 1);
                        setNewRoute({...newRoute, intermediates: newIntermediates, stops: Math.max(1, newRoute.stops - 1)});
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 lg:mt-0 mt-6"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
                </div>

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
                    className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
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
                  <div className="flex items-center gap-2 mb-3">
                    <input 
                      type="checkbox" 
                      id="returnToMatriz"
                      checked={newRoute.returnToMatriz || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setNewRoute({
                          ...newRoute, 
                          returnToMatriz: checked,
                          destination: checked ? matrizAddress : ''
                        });
                      }}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="returnToMatriz" className="text-sm font-semibold text-slate-700 cursor-pointer flex-1">
                      Ponto final é o retorno para a Matriz (Não conta como parada)
                    </label>
                  </div>
                  
                  {!newRoute.returnToMatriz && (
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Destino</label>
                        <button type="button" onClick={() => setNewRoute({...newRoute, destination: matrizAddress})} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Usar Matriz</button>
                      </div>
                      <input 
                        type="text" 
                        required={!newRoute.returnToMatriz}
                        value={newRoute.destination}
                        onChange={(e) => setNewRoute({...newRoute, destination: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                        placeholder="Endereço de chegada"
                      />
                    </div>
                  )}
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

      {isManageModalOpen && currentManageRoute && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Gerenciar Rota #{formatRouteId(currentManageRoute)}</h2>
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
                    <span className="text-sm font-medium text-slate-600">{currentManageRoute.date}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3 text-slate-700">
                    <Truck size={18} className="text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Entregador Responsável</div>
                      <div className="font-semibold">{currentManageRoute.driver}</div>
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
                          <StatusBadge status={currentManageRoute.status} />
                        </div>
                      </div>
                    </div>
                    
                    {(() => {
                      const completedStops = currentManageRoute.stopDetails?.filter(s => s.status === 'completed' || s.status === 'issue').length || (currentManageRoute.status === 'completed' ? currentManageRoute.stops : 0);
                      const totalStops = currentManageRoute.stopDetails?.length || currentManageRoute.stops || 1;
                      const progress = Math.min(100, Math.round((completedStops / totalStops) * 100));
                      
                      let estimatedEndTime = '--:--';
                      if (currentManageRoute.departureTime && currentManageRoute.estimatedTime) {
                        const [depHours, depMins] = currentManageRoute.departureTime.split(':').map(Number);
                        // estimatedTime is usually like "2 h" or "2.5 h" or "02:30" or something.
                        // For simplicity, let's just parse the first number we find and assume it's minutes or hours.
                        // Actually Google Maps Directions returns something like "1 hora 30 minutos" or "15 mins".
                        // Let's just create a mock finish time, e.g. adding 2 hours.
                        // Since parsing Google Maps natural language is complex, we will just use a placeholder text or a rough heuristic.
                        let addMinutes = 120; // default 2 hours
                        const estMatch = currentManageRoute.estimatedTime.match(/(\d+)/g);
                        if (estMatch) {
                          if (currentManageRoute.estimatedTime.includes('h') || currentManageRoute.estimatedTime.includes('hora')) {
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
                    const completedStops = currentManageRoute.stopDetails?.filter(s => s.status === 'completed' || s.status === 'issue').length || (currentManageRoute.status === 'completed' ? currentManageRoute.stops : 0);
                    const totalStops = currentManageRoute.stopDetails?.length || currentManageRoute.stops || 1;
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
                          {currentManageRoute.stops} paradas • {currentManageRoute.distance} km • est. {currentManageRoute.estimatedTime}
                        </div>
                      </div>
                    </div>
                    {currentManageRoute.origin && currentManageRoute.destination && (
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(currentManageRoute.origin)}&destination=${encodeURIComponent(currentManageRoute.destination)}${currentManageRoute.intermediates?.length ? `&waypoints=${encodeURIComponent(currentManageRoute.intermediates.join('|'))}` : ''}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs font-medium px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        <MapPin size={14} />
                        Mapa
                      </a>
                    )}
                  </div>
                  
                  {currentManageRoute.stopDetails && currentManageRoute.stopDetails.length > 0 && (
                    <div className="mt-4 space-y-3 pt-4 border-t border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Paradas</div>
                      {currentManageRoute.stopDetails.map((stop, index) => (
                        <div key={stop.id || index} className="flex items-start gap-3">
                          <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 ${
                            stop.status === 'completed' ? 'border-emerald-500 bg-emerald-500' :
                            stop.status === 'issue' ? 'border-red-500 bg-red-500' :
                            'border-slate-300'
                          }`} />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-800">{stop.address}</div>
                            <div className="text-xs text-slate-500 mb-1">
                              {stop.status === 'completed' && <span className="text-emerald-600">Entregue</span>}
                              {stop.status === 'issue' && <span className="text-red-600 font-medium">Problema reportado</span>}
                              {stop.status === 'pending' && <span>Pendente</span>}
                            </div>
                            {stop.status === 'issue' && (stop.issueDescription || stop.issuePhotoUrl) && (
                              <div className="mt-2 bg-red-50 border border-red-100 rounded-lg p-3">
                                {stop.issueDescription && (
                                  <p className="text-sm text-red-800 mb-2 whitespace-pre-wrap">{stop.issueDescription}</p>
                                )}
                                {stop.issuePhotoUrl && (
                                  <a href={stop.issuePhotoUrl} target="_blank" rel="noopener noreferrer" className="block max-w-[200px] overflow-hidden rounded-md border border-red-200">
                                    <img src={stop.issuePhotoUrl} alt="Foto do problema" className="w-full h-auto object-cover hover:scale-105 transition-transform" />
                                  </a>
                                )}
                              </div>
                            )}
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
                    onClick={() => handleDeleteRoute(currentManageRoute.id)}
                    className="flex-1 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} />
                    Excluir
                  </button>
                  <button 
                    onClick={() => {
                      setEditingRoute(currentManageRoute);
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
                    {drivers?.filter((d: any) => d.status === 'active' || d.status === 'on_route').map((d: any) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
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

                  <div className="max-h-48 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {editingRoute.intermediates?.map((waypoint, index) => (
                    <div key={index} className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative group">
                      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                        <div className="lg:col-span-5">
                          <label className="block text-xs font-semibold text-slate-500 mb-1 lg:hidden">
                            Parada {index + 1} - Endereço
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="hidden lg:flex w-6 h-6 bg-slate-100 text-slate-500 rounded-full text-xs items-center justify-center font-bold flex-shrink-0">
                              {index + 1}
                            </span>
                            <input 
                              type="text" 
                              value={waypoint}
                              onChange={(e) => {
                                const newIntermediates = [...(editingRoute.intermediates || [])];
                                newIntermediates[index] = e.target.value;
                                setEditingRoute({...editingRoute, intermediates: newIntermediates});
                              }}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary focus:bg-white transition-colors"
                              placeholder="Endereço da parada"
                            />
                          </div>
                        </div>
                        
                        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <input type="text" placeholder="Nº Ped/OS" value={editingRoute.intermediateMetadata?.[index]?.orderNumber || ''} onChange={(e) => {
                            const newMeta = [...(editingRoute.intermediateMetadata || [])];
                            if(!newMeta[index]) newMeta[index] = {};
                            newMeta[index].orderNumber = e.target.value;
                            setEditingRoute({...editingRoute, intermediateMetadata: newMeta});
                          }} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-primary focus:bg-white" />
                          <input type="text" placeholder="Nome" value={editingRoute.intermediateMetadata?.[index]?.customerName || ''} onChange={(e) => {
                            const newMeta = [...(editingRoute.intermediateMetadata || [])];
                            if(!newMeta[index]) newMeta[index] = {};
                            newMeta[index].customerName = e.target.value;
                            setEditingRoute({...editingRoute, intermediateMetadata: newMeta});
                          }} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-primary focus:bg-white" />
                          <input type="text" placeholder="Telefone" value={editingRoute.intermediateMetadata?.[index]?.customerPhone || ''} onChange={(e) => {
                            const newMeta = [...(editingRoute.intermediateMetadata || [])];
                            if(!newMeta[index]) newMeta[index] = {};
                            newMeta[index].customerPhone = e.target.value;
                            setEditingRoute({...editingRoute, intermediateMetadata: newMeta});
                          }} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-primary focus:bg-white" />
                          <input type="text" placeholder="Observação" value={editingRoute.intermediateMetadata?.[index]?.observation || ''} onChange={(e) => {
                            const newMeta = [...(editingRoute.intermediateMetadata || [])];
                            if(!newMeta[index]) newMeta[index] = {};
                            newMeta[index].observation = e.target.value;
                            setEditingRoute({...editingRoute, intermediateMetadata: newMeta});
                          }} className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-primary focus:bg-white" />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newIntermediates = [...(editingRoute.intermediates || [])];
                          newIntermediates.splice(index, 1);
                          setEditingRoute({...editingRoute, intermediates: newIntermediates, stops: Math.max(1, editingRoute.stops - 1)});
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 lg:mt-0 mt-6"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                  </div>

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
                      className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
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
                    <div className="flex items-center gap-2 mb-3">
                      <input 
                        type="checkbox" 
                        id="editReturnToMatriz"
                        checked={editingRoute.returnToMatriz || false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditingRoute({
                            ...editingRoute, 
                            returnToMatriz: checked,
                            destination: checked ? matrizAddress : editingRoute.destination
                          });
                        }}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="editReturnToMatriz" className="text-sm font-semibold text-slate-700 cursor-pointer flex-1">
                        Ponto final é o retorno para a Matriz (Não conta como parada)
                      </label>
                    </div>

                    {!editingRoute.returnToMatriz && (
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
                    )}
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

      {/* Requests Modal */}
      {isRequestsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Package size={24} className="text-emerald-500" />
                Puxar Solicitações Pendentes
              </h2>
              <button onClick={() => setIsRequestsModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
              {externalRequests?.filter(r => r.status === 'pending').length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <Package size={48} className="mx-auto mb-4 text-slate-300" />
                  <p>Não há solicitações pendentes no momento.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {externalRequests?.filter(r => r.status === 'pending').map(req => {
                    const isSelected = selectedRequestIds.includes(req.id);
                    return (
                      <div 
                        key={req.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedRequestIds(prev => prev.filter(id => id !== req.id));
                          } else {
                            setSelectedRequestIds(prev => [...prev, req.id]);
                          }
                        }}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-4 ${isSelected ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-emerald-200'}`}
                      >
                        <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                          {isSelected && <CheckCircle size={14} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-800 capitalize">{req.type}</span>
                            <span className="text-xs text-slate-500">{new Date(req.createdAt).toLocaleString('pt-BR')}</span>
                          </div>
                          <p className="text-sm font-medium text-slate-700 mb-1">{req.address}</p>
                          <div className="flex gap-4 text-xs text-slate-500">
                            <span><strong className="text-slate-600">Ped/OS:</strong> {req.orderNumber || req.osNumber || '-'}</span>
                            <span><strong className="text-slate-600">Nome:</strong> {req.requesterName || '-'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button 
                type="button"
                onClick={() => setIsRequestsModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={() => {
                  const selectedReqs = externalRequests?.filter(r => selectedRequestIds.includes(r.id)) || [];
                  const newStops = [...(newRoute.intermediates || [])];
                  const newMeta = [...(newRoute.intermediateMetadata || [])];
                  
                  selectedReqs.forEach(req => {
                    newStops.push(req.address);
                    newMeta.push({
                      orderNumber: req.orderNumber || req.osNumber || '',
                      customerName: req.requesterName || '',
                      customerPhone: req.contactPhone || '',
                      observation: req.observations || '',
                      externalRequestId: req.id
                    });
                  });
                  
                  setNewRoute({
                    ...newRoute,
                    intermediates: newStops,
                    intermediateMetadata: newMeta,
                    stops: Math.max(1, newStops.length)
                  });
                  setIsRequestsModalOpen(false);
                }}
                disabled={selectedRequestIds.length === 0}
                className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
              >
                Importar ({selectedRequestIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
