import React, { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Truck, CheckCircle, Clock, X, Map, RefreshCw, Trash2, Upload, Download, Package, AlertTriangle } from 'lucide-react';
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

  const [stopTimeMinutes, setStopTimeMinutes] = useState<number>(30);
  const [workdayTotalMinutes, setWorkdayTotalMinutes] = useState<number>(528); // Default 8h 48m

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'matriz');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMatrizAddress(docSnap.data().address || '');
        }
      } catch (error) {
        console.error("Error fetching matriz settings:", error);
      }
      try {
        const routingRef = doc(db, 'settings', 'routing');
        const routingSnap = await getDoc(routingRef);
        if (routingSnap.exists()) {
          const rData = routingSnap.data();
          if (rData.stopTimeMinutes !== undefined) {
            setStopTimeMinutes(Number(rData.stopTimeMinutes));
          }
        }
      } catch (error) {
        console.error("Error fetching routing settings:", error);
      }
      try {
        const workdayRef = doc(db, 'settings', 'workday');
        const workdaySnap = await getDoc(workdayRef);
        if (workdaySnap.exists()) {
          const wData = workdaySnap.data();
          let startM = 8 * 60;
          let endM = 17 * 60 + 48;
          let lunch = 60;
          if (wData.start) {
             const [h,m] = wData.start.split(':');
             startM = parseInt(h) * 60 + parseInt(m);
          }
          if (wData.end) {
             const [h,m] = wData.end.split(':');
             endM = parseInt(h) * 60 + parseInt(m);
          }
          if (wData.lunchMinutes !== undefined) {
             lunch = Number(wData.lunchMinutes);
          }
          setWorkdayTotalMinutes((endM - startM) - lunch);
        }
      } catch (error) {
        console.error("Error fetching workday settings:", error);
      }
    };
    fetchSettings();
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
    estimatedMinutes: 0,
    returnToMatriz: false,
  });
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isFleetSaturated, setIsFleetSaturated] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'issue'>('all');
  const [filterDate, setFilterDate] = useState<string>(''); // YYYY-MM-DD

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
                lng: req.lng || null,
                type: req.type || 'entrega',
                dropoffAddress: req.dropoffAddress || ''
              });
            });

            const firstDate = selectedReqs.find(r => r.scheduledDate && r.scheduledDate !== 'sem_data')?.scheduledDate;
            let initialDepartureTime = '';
            if (firstDate) {
              initialDepartureTime = `${firstDate}T08:00`;
            }
            
            setNewRoute(prev => ({
              ...prev,
              intermediates: newStops,
              intermediateMetadata: newMeta,
              stops: Math.max(1, newStops.length),
              departureTime: initialDepartureTime
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

  const getDriverAvailability = (driverName: string, date: string) => {
    if (!routes || !driverName || !date) return { minutesLeft: workdayTotalMinutes, formatted: '' };
    const driverRoutes = routes.filter(r => r.driver === driverName && r.date === date && r.status !== 'issue');
    const totalAssignedMinutes = driverRoutes.reduce((acc, route) => acc + (route.estimatedMinutes || 0), 0);
    const minutesLeft = workdayTotalMinutes - totalAssignedMinutes;
    
    if (minutesLeft <= 0) return { minutesLeft, formatted: '0h 0m' };
    
    const h = Math.floor(minutesLeft / 60);
    const m = minutesLeft % 60;
    return { minutesLeft, formatted: `${h}h ${m}m` };
  };

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

        // Add stop time for each intermediate stop (each stop takes stopTimeMinutes)
        const numIntermediates = (routeData.intermediates || []).filter((addr: string) => addr.trim() !== '').length;
        if (numIntermediates > 0) {
           const additionalSeconds = numIntermediates * (stopTimeMinutes * 60);
           totalDuration += additionalSeconds;
        }

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
          estimatedMinutes: Math.ceil(totalDuration / 60),
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
            observation: cols[4] || '',
            type: 'entrega',
            dropoffAddress: ''
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
    setIsFleetSaturated(false); // Reset saturation flag before calculation
    const data = await calculateRouteData(newRoute);
    if (data && !data.error) {
      let suggestedDriver = newRoute.driver;
      let fleetSaturated = false;

      // Only auto-suggest if a driver hasn't been manually picked or if the user wants auto-suggestion
      // Let's always run the check. If the currently selected driver has enough time, we keep them.
      // If not, we find the one with the most time.
      const dateStr = newRoute.departureTime ? new Date(newRoute.departureTime).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
      const activeDrivers = drivers?.filter((d: any) => d.status === 'active' || d.status === 'on_route') || [];
      
      let bestDriver = '';
      let maxMinutesLeft = -1;
      
      let currentDriverHasTime = false;
      
      for (const d of activeDrivers) {
        const avail = getDriverAvailability(d.name, dateStr);
        if (d.name === suggestedDriver && avail.minutesLeft >= data.estimatedMinutes) {
           currentDriverHasTime = true;
        }
        if (avail.minutesLeft > maxMinutesLeft) {
          maxMinutesLeft = avail.minutesLeft;
          bestDriver = d.name;
        }
      }

      if (!currentDriverHasTime) {
        if (maxMinutesLeft >= data.estimatedMinutes) {
          suggestedDriver = bestDriver;
        } else {
          suggestedDriver = ''; // No one has time
          fleetSaturated = true;
        }
      }

      setIsFleetSaturated(fleetSaturated);

      setNewRoute(prev => ({
        ...prev,
        ...data,
        driver: suggestedDriver
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
    let finalEstimatedMinutes = (newRoute as any).estimatedMinutes || 0;
    let finalIntermediates = newRoute.intermediates;
    let finalMetadata = newRoute.intermediateMetadata || [];
    
    // Always compute to ensure distance/time/order are correct before saving
    if (newRoute.distance > 0) {
      // Já foi calculado antes pelo botão de calcular, vamos economizar API!
      finalDistance = newRoute.distance;
      finalEstimatedTime = newRoute.estimatedTime || '00:00 h';
      finalEstimatedMinutes = (newRoute as any).estimatedMinutes || 0;
      finalIntermediates = newRoute.intermediates;
      finalMetadata = newRoute.intermediateMetadata || [];
    } else if (routesLib && newRoute.origin && newRoute.destination) {
      const data = await calculateRouteData(newRoute);
      if (data && !data.error) {
        finalDistance = data.distance;
        finalEstimatedTime = data.estimatedTime;
        finalEstimatedMinutes = data.estimatedMinutes;
        finalIntermediates = data.intermediates;
        finalMetadata = data.intermediateMetadata || [];
      } else {
        alert('Não foi possível calcular a rota com os endereços fornecidos. Erro: ' + (data?.error || ''));
        setIsCalculating(false);
        return; // Prevent saving the route if calculation fails
      }
    }
    setIsCalculating(false);
    
    let formattedDate = new Date().toLocaleDateString('pt-BR');
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
      type: item.meta.type || 'entrega',
      dropoffAddress: item.meta.dropoffAddress || ''
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
      estimatedMinutes: finalEstimatedMinutes,
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
    let finalEstimatedMinutes = editingRoute.estimatedMinutes || 0;
    let finalIntermediates = editingRoute.intermediates;
    let finalMetadata = (editingRoute as any).intermediateMetadata || [];
    
    if (routesLib && editingRoute.origin && editingRoute.destination) {
      const data = await calculateRouteData(editingRoute);
      if (data) {
        finalDistance = data.distance;
        finalEstimatedTime = data.estimatedTime;
        finalEstimatedMinutes = data.estimatedMinutes;
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
        orderNumber: item.meta.orderNumber || existingStop?.orderNumber || '',
        customerName: item.meta.customerName || existingStop?.customerName || '',
        customerPhone: item.meta.customerPhone || existingStop?.customerPhone || '',
        observation: item.meta.observation || existingStop?.observation || '',
        externalRequestId: item.meta.externalRequestId || existingStop?.externalRequestId || '',
        lat: item.meta.lat || existingStop?.lat || null,
        lng: item.meta.lng || existingStop?.lng || null,
        type: item.meta.type || (existingStop as any)?.type || 'entrega',
        dropoffAddress: item.meta.dropoffAddress || (existingStop as any)?.dropoffAddress || '',
        collectionCompleted: (existingStop as any)?.collectionCompleted || false,
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
    const allCompleted = stopDetails.length > 0 && stopDetails.every(s => s.status === 'completed' || s.status === 'issue');
    const newStatus = allCompleted ? 'completed' : (updatedRoute.status === 'completed' ? 'in_progress' : updatedRoute.status);
    
    await update(editingRoute.id, {
      driver: updatedRoute.driver || 'Aguardando',
      status: newStatus,
      stops: updatedRoute.stops,
      distance: finalDistance,
      estimatedTime: finalEstimatedTime,
      estimatedMinutes: finalEstimatedMinutes,
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

  const handleRemoveStopFromRoute = async (routeId: string, stopToRemove: any) => {
    const route = routes.find(r => r.id === routeId);
    if (!route) return;
    
    if (!window.confirm('Tem certeza que deseja remover esta parada da rota? Ela retornará ao Banco de Demandas.')) {
      return;
    }

    try {
      if (stopToRemove.externalRequestId) {
        const reqRef = doc(db, 'external_requests', stopToRemove.externalRequestId);
        await updateDoc(reqRef, { status: 'pending' });
      } else {
        await addDoc(collection(db, 'external_requests'), {
          type: 'entrega',
          address: stopToRemove.address,
          orderNumber: stopToRemove.orderNumber || '',
          requesterName: stopToRemove.customerName || '',
          contactPhone: stopToRemove.customerPhone || '',
          observations: stopToRemove.observation || '',
          scheduledDate: '',
          status: 'pending',
          read: true,
          createdAt: new Date().toISOString(),
          lat: stopToRemove.lat || null,
          lng: stopToRemove.lng || null
        });
      }

      // Remove from arrays
      let newIntermediates = [...(route.intermediates || [])];
      let newMeta = [...((route as any).intermediateMetadata || [])];
      
      const indexToRemove = newIntermediates.findIndex(addr => addr === stopToRemove.address);
      if (indexToRemove !== -1) {
        newIntermediates.splice(indexToRemove, 1);
        newMeta.splice(indexToRemove, 1);
      }

      const newStopDetails = route.stopDetails?.filter(s => s.id !== stopToRemove.id) || [];
      const newStopsCount = Math.max(1, newStopDetails.length);
      const allCompleted = newStopDetails.length > 0 && newStopDetails.every(s => s.status === 'completed' || s.status === 'issue');

      await update(route.id, {
        intermediates: newIntermediates,
        intermediateMetadata: newMeta,
        stopDetails: newStopDetails,
        stops: newStopsCount,
        status: allCompleted ? 'completed' : (route.status === 'completed' ? 'in_progress' : route.status)
      });
      
      if (selectedRoute?.id === route.id) {
        setSelectedRoute(prev => prev ? {
          ...prev,
          intermediates: newIntermediates,
          intermediateMetadata: newMeta,
          stopDetails: newStopDetails,
          stops: newStopsCount
        } : null);
      }

      alert('Parada removida e enviada para o Banco de Demandas.');
    } catch (err) {
      console.error(err);
      alert('Erro ao remover parada.');
    }
  };

  const handleManualCompleteStop = async (routeId: string, stopIndex: number) => {
    const route = routes.find(r => r.id === routeId);
    if (!route || !route.stopDetails) return;
    
    if (!window.confirm('Tem certeza que deseja marcar esta parada como Entregue manualmente?')) return;

    try {
      const newStopDetails = [...route.stopDetails];
      newStopDetails[stopIndex] = { ...newStopDetails[stopIndex], status: 'completed' };
      
      const allCompleted = newStopDetails.length > 0 && newStopDetails.every(s => s.status === 'completed' || s.status === 'issue');
      
      await update(route.id, { 
        stopDetails: newStopDetails,
        status: allCompleted ? 'completed' : (route.status === 'completed' ? 'in_progress' : route.status)
      });

      if (newStopDetails[stopIndex].externalRequestId) {
        const reqRef = doc(db, 'external_requests', newStopDetails[stopIndex].externalRequestId!);
        await updateDoc(reqRef, { status: 'completed' });
      }

      if (selectedRoute?.id === route.id) {
        setSelectedRoute(prev => prev ? {
          ...prev,
          stopDetails: newStopDetails,
          status: allCompleted ? 'completed' : (prev.status === 'completed' ? 'in_progress' : prev.status)
        } : null);
      }
      alert('Parada marcada como entregue.');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar parada.');
    }
  };

  const handleManualIssueStop = async (routeId: string, stopIndex: number) => {
    const route = routes.find(r => r.id === routeId);
    if (!route || !route.stopDetails) return;
    
    const reason = window.prompt('Qual o problema com esta entrega? (Opcional)');
    if (reason === null) return;

    try {
      const newStopDetails = [...route.stopDetails];
      newStopDetails[stopIndex] = { 
        ...newStopDetails[stopIndex], 
        status: 'issue',
        issueDescription: reason ? `(Baixa manual ADM) ${reason}` : '(Baixa manual ADM)'
      };
      
      const allCompleted = newStopDetails.length > 0 && newStopDetails.every(s => s.status === 'completed' || s.status === 'issue');
      
      await update(route.id, { 
        stopDetails: newStopDetails,
        status: allCompleted ? 'completed' : (route.status === 'completed' ? 'in_progress' : route.status)
      });

      if (newStopDetails[stopIndex].externalRequestId) {
        const reqRef = doc(db, 'external_requests', newStopDetails[stopIndex].externalRequestId!);
        await updateDoc(reqRef, { status: 'issue' });
      }

      if (selectedRoute?.id === route.id) {
        setSelectedRoute(prev => prev ? {
          ...prev,
          stopDetails: newStopDetails,
          status: allCompleted ? 'completed' : (prev.status === 'completed' ? 'in_progress' : prev.status)
        } : null);
      }
      alert('Parada marcada com problema.');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar parada.');
    }
  };


  const currentManageRoute = selectedRoute ? (routes.find(r => r.id === selectedRoute.id) || selectedRoute) : null;

  const filteredRoutes = routes.filter(route => {
    const matchesStatus = filterStatus === 'all' ? true : route.status === filterStatus;
    let matchesDate = true;
    if (filterDate) {
      const [y, m, d] = filterDate.split('-');
      const formattedFilterDate = `${d}/${m}/${y}`;
      matchesDate = route.date === formattedFilterDate;
    }
    return matchesStatus && matchesDate;
  });

  let targetDateStr = new Date().toLocaleDateString('pt-BR');
  if (filterDate) {
    const [y, m, d] = filterDate.split('-');
    targetDateStr = `${d}/${m}/${y}`;
  }

  const activeDriversStatus = (drivers?.filter((d: any) => d.status === 'active' || d.status === 'on_route') || []).map((d: any) => {
    const avail = getDriverAvailability(d.name, targetDateStr);
    const usedMinutes = workdayTotalMinutes - avail.minutesLeft;
    const percent = Math.min(100, Math.max(0, (usedMinutes / workdayTotalMinutes) * 100));
    
    let colorClass = 'bg-emerald-500';
    if (percent > 90) colorClass = 'bg-red-500';
    else if (percent > 75) colorClass = 'bg-amber-500';
    else if (percent > 50) colorClass = 'bg-blue-500';

    return {
      name: d.name,
      usedMinutes,
      minutesLeft: avail.minutesLeft,
      formattedLeft: avail.formatted,
      percent,
      colorClass
    };
  });

  const totalFleetMinutes = activeDriversStatus.length * workdayTotalMinutes;
  const totalUsedMinutes = activeDriversStatus.reduce((sum, d) => sum + d.usedMinutes, 0);
  const totalFleetPercent = totalFleetMinutes > 0 ? Math.min(100, Math.max(0, (totalUsedMinutes / totalFleetMinutes) * 100)) : 0;
  
  let totalColorClass = 'bg-emerald-500';
  if (totalFleetPercent > 90) totalColorClass = 'bg-red-500';
  else if (totalFleetPercent > 75) totalColorClass = 'bg-amber-500';
  else if (totalFleetPercent > 50) totalColorClass = 'bg-blue-500';

  const totalMinutesLeft = totalFleetMinutes - totalUsedMinutes;
  const totalFormattedLeft = `${Math.floor(totalMinutesLeft / 60)}h ${totalMinutesLeft % 60}m`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Rotas e Serviços</h1>
          <p className="text-slate-500 text-sm sm:text-base">Gerencie a expedição e o andamento das rotas.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="flex gap-2">
            <input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none shadow-sm font-medium text-slate-700"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none shadow-sm font-medium text-slate-700"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendentes</option>
              <option value="in_progress">Em andamento</option>
              <option value="completed">Finalizadas</option>
              <option value="issue">Problema</option>
            </select>
          </div>
          <button 
            onClick={() => { setFilterDate(''); setFilterStatus('all'); }}
            className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Filter size={18} /> Limpar
          </button>
        </div>
      </div>

      {/* Driver Saturation Panel */}
      {activeDriversStatus.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wider">
            Disponibilidade da Frota ({filterDate ? targetDateStr : 'Hoje'})
          </h2>
          
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="font-bold text-slate-800 text-lg">Visão Geral da Frota</span>
                <span className="text-slate-500 text-sm ml-2">({activeDriversStatus.length} motoristas)</span>
              </div>
              <div className="text-right">
                <span className={`font-bold text-lg ${totalFleetPercent > 90 ? 'text-red-600' : 'text-slate-700'}`}>{totalFormattedLeft} livres</span>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden mb-2">
              <div className={`h-4 rounded-full ${totalColorClass} transition-all duration-500`} style={{ width: `${totalFleetPercent}%` }}></div>
            </div>
            <div className="flex justify-between items-center text-sm text-slate-500">
              <span>{totalFleetPercent.toFixed(1)}% capacidade utilizada</span>
              <span>Max total: {Math.floor(totalFleetMinutes/60)}h {totalFleetMinutes%60}m</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeDriversStatus.map((d, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-700 truncate" title={d.name}>{d.name}</span>
                  <span className={`font-bold ${d.percent > 90 ? 'text-red-600' : 'text-slate-500'}`}>{d.formattedLeft}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-2.5 rounded-full ${d.colorClass} transition-all duration-500`} style={{ width: `${d.percent}%` }}></div>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
                  <span>{d.percent.toFixed(0)}% ocupado</span>
                  <span>Max: {Math.floor(workdayTotalMinutes/60)}h {workdayTotalMinutes%60}m</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              {filteredRoutes.map(route => (
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
                    {drivers?.filter((d: any) => d.status === 'active' || d.status === 'on_route').map((d: any) => {
                      const dateStr = newRoute.departureTime ? new Date(newRoute.departureTime).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
                      const avail = getDriverAvailability(d.name, dateStr);
                      return (
                        <option key={d.id} value={d.name}>{d.name} (Livre: {avail.formatted})</option>
                      );
                    })}
                  </select>
                  {newRoute.driver && (newRoute as any).estimatedMinutes > 0 && (() => {
                    const dateStr = newRoute.departureTime ? new Date(newRoute.departureTime).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
                    const avail = getDriverAvailability(newRoute.driver, dateStr);
                    if (avail.minutesLeft < (newRoute as any).estimatedMinutes) {
                      return (
                        <p className="mt-1.5 text-xs font-semibold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                          Atenção: A rota ({newRoute.estimatedTime}) excede o tempo livre ({avail.formatted}) do motorista neste dia!
                        </p>
                      );
                    }
                    return null;
                  })()}
                  {isFleetSaturated && !newRoute.driver && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200 flex flex-col gap-2">
                      <span className="font-semibold">Frota Saturada!</span>
                      <span>Nenhum entregador tem tempo livre suficiente para esta rota hoje.</span>
                      <button 
                        type="button"
                        onClick={() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          setNewRoute(prev => ({...prev, departureTime: tomorrow.toISOString().slice(0, 16)}));
                          setIsFleetSaturated(false); // reset warning since we moved the date
                        }}
                        className="self-start px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                      >
                        Agendar para o Dia Seguinte
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data e Hora de Saída</label>
                    <input 
                      type="datetime-local" 
                      value={newRoute.departureTime}
                      onChange={(e) => setNewRoute({...newRoute, departureTime: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    />
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
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold text-slate-800">Gerenciar Rota #{formatRouteId(currentManageRoute)}</h2>
              <button 
                onClick={() => setIsManageModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Lado Esquerdo - Detalhes */}
                <div className="flex-1 space-y-6">
                  <div className="flex items-center gap-4">
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

                  <div className="space-y-4">
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
                            let addMinutes = 120;
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
                    </div>
                  </div>
                </div>

                {/* Lado Direito - Paradas */}
                <div className="flex-1 flex flex-col bg-slate-50/50 rounded-2xl border border-slate-100 p-5">
                  <div className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-3 border-b border-slate-200 flex items-center justify-between">
                    <span>Paradas da Rota</span>
                    <span className="bg-slate-200 text-slate-600 py-0.5 px-2 rounded-full text-xs">{currentManageRoute.stopDetails?.length || 0} locais</span>
                  </div>
                  
                  {currentManageRoute.stopDetails && currentManageRoute.stopDetails.length > 0 ? (
                    <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[50vh]">
                      {currentManageRoute.stopDetails.map((stop, index) => (
                        <div key={stop.id || index} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 ${
                            stop.status === 'completed' ? 'border-emerald-500 bg-emerald-500' :
                            stop.status === 'issue' ? 'border-red-500 bg-red-500' :
                            'border-slate-300'
                          }`} />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-800">{stop.address}</div>
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-slate-500 mb-1">
                                {stop.status === 'completed' && <span className="text-emerald-600">Entregue</span>}
                                {stop.status === 'issue' && <span className="text-red-600 font-medium">Problema reportado</span>}
                                {stop.status === 'pending' && <span>Pendente</span>}
                              </div>
                              {stop.status === 'pending' && (
                                <div className="flex flex-wrap gap-2 justify-end mt-2 sm:mt-0">
                                  <button
                                    onClick={() => handleManualCompleteStop(currentManageRoute.id, index)}
                                    className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1.5 bg-emerald-50 rounded-md transition-colors"
                                    title="Dar baixa manual como entregue"
                                  >
                                    <CheckCircle size={14} /> Entregue
                                  </button>
                                  <button
                                    onClick={() => handleManualIssueStop(currentManageRoute.id, index)}
                                    className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium px-2 py-1.5 bg-amber-50 rounded-md transition-colors"
                                    title="Reportar problema"
                                  >
                                    <AlertTriangle size={14} /> Problema
                                  </button>
                                  <button
                                    onClick={() => handleRemoveStopFromRoute(currentManageRoute.id, stop)}
                                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1.5 bg-red-50 rounded-md transition-colors"
                                    title="Remover da rota"
                                  >
                                    <X size={14} /> Desvincular
                                  </button>
                                </div>
                              )}
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
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500 text-sm py-8">
                      Nenhuma parada detalhada disponível.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
              <button 
                onClick={() => setIsManageModalOpen(false)}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
              >
                Fechar
              </button>
              <div className="flex-1 flex gap-3 justify-end">
                <button 
                  onClick={() => handleDeleteRoute(currentManageRoute.id)}
                  className="px-6 py-2.5 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors shadow-sm flex items-center justify-center gap-2"
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
                  className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors shadow-sm"
                >
                  Editar Rota
                </button>
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
                    {drivers?.filter((d: any) => d.status === 'active' || d.status === 'on_route').map((d: any) => {
                      const dateStr = editingRoute.departureTime ? new Date(editingRoute.departureTime).toLocaleDateString('pt-BR') : editingRoute.date;
                      const avail = getDriverAvailability(d.name, dateStr);
                      return (
                        <option key={d.id} value={d.name}>{d.name} (Livre: {avail.formatted})</option>
                      );
                    })}
                  </select>
                  {editingRoute.driver && editingRoute.driver !== 'Aguardando' && editingRoute.estimatedMinutes && editingRoute.estimatedMinutes > 0 && (() => {
                    const dateStr = editingRoute.departureTime ? new Date(editingRoute.departureTime).toLocaleDateString('pt-BR') : editingRoute.date;
                    const avail = getDriverAvailability(editingRoute.driver, dateStr);
                    // Add back the time of the current route to available time, because this route is already assigned to them and is being edited.
                    // Oh wait, if the driver is already assigned to this route, `avail.minutesLeft` already has this route's time subtracted (if it's in the DB).
                    // Actually, if we are editing, we are editing in memory but it's already in the DB.
                    // We should add back the original route time to avoid double subtraction.
                    // I will just do a simple check for now, and if they change the driver, it's a new route for the new driver.
                    const isSameDriver = (routes.find(r => r.id === editingRoute.id)?.driver === editingRoute.driver);
                    const originalMins = isSameDriver ? (routes.find(r => r.id === editingRoute.id)?.estimatedMinutes || 0) : 0;
                    
                    if ((avail.minutesLeft + originalMins) < (editingRoute.estimatedMinutes || 0)) {
                      return (
                        <p className="mt-1.5 text-xs font-semibold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                          Atenção: A rota ({editingRoute.estimatedTime}) excede o tempo livre ({avail.formatted}) do motorista neste dia!
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data e Hora de Saída</label>
                      <input 
                        type="datetime-local" 
                        value={editingRoute.departureTime || ''}
                        onChange={(e) => setEditingRoute({...editingRoute, departureTime: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      />
                    </div>
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
                      externalRequestId: req.id,
                      type: req.type || 'entrega',
                      dropoffAddress: req.dropoffAddress || '',
                      lat: req.lat || null,
                      lng: req.lng || null
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
