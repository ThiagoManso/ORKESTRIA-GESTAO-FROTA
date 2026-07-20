import React, { useState, useEffect } from 'react';
import { useCollection } from '../lib/useCollection';
import { ExternalRequest } from '../types';
import { Package, MapPin, CheckCircle, Clock, Search, Trash2, Calendar, Upload, Download, Plus, LayoutGrid, List as ListIcon, X, Edit2 } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { addDoc, collection, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RouteItem } from '../types';

export default function RequestsPage() {
  const { data: requests, update, remove, loading } = useCollection<ExternalRequest>('external_requests');
  const { data: routes } = useCollection<RouteItem>('routes');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'on_route' | 'completed'>('all');
  const [filterDate, setFilterDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [manualAssignRequest, setManualAssignRequest] = useState<ExternalRequest | null>(null);
  const [selectedAssignRouteId, setSelectedAssignRouteId] = useState<string>('');
  const [selectedAssignIndex, setSelectedAssignIndex] = useState<number>(-1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const geocodingLibrary = useMapsLibrary('geocoding');

  // Manual form state
  const [manualForm, setManualForm] = useState({
    type: 'entrega' as 'coleta' | 'entrega',
    address: '',
    requesterName: '',
    contactPhone: '',
    osNumber: '',
    orderNumber: '',
    observations: '',
    scheduledDate: '',
    status: 'pending' as 'pending' | 'on_route' | 'completed'
  });

  useEffect(() => {
    if (requests) {
      const unread = requests.filter(r => !r.read);
      unread.forEach(req => {
        update(req.id, { read: true }).catch(console.error);
      });
    }
  }, [requests]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-cyan"></div>
      </div>
    );
  }

  const filteredRequests = requests?.filter(req => {
    const matchesSearch = 
      req.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.osNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' ? req.status !== 'completed' : req.status === filterStatus;
    const matchesDate = !filterDate || req.scheduledDate === filterDate;

    return matchesSearch && matchesStatus && matchesDate;
  }).sort((a, b) => {
      // Sort by scheduled date first, then creation date
      const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
      const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB; // Crescente
      
      const createdA = new Date(a.createdAt).getTime();
      const createdB = new Date(b.createdAt).getTime();
      return createdA - createdB;
  });

  // Group by Date
  const groupedRequests = filteredRequests?.reduce((acc, req) => {
    const date = req.scheduledDate || 'sem_data';
    if (!acc[date]) acc[date] = [];
    acc[date].push(req);
    return acc;
  }, {} as Record<string, ExternalRequest[]>) || {};

  const sortedDates = Object.keys(groupedRequests).sort((a, b) => {
    if (a === 'sem_data') return 1;
    if (b === 'sem_data') return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  const downloadCSVTemplate = () => {
    const csvContent = "Tipo;Endereço;N° Pedido / OS;Nome;Telefone;Observação;Data\nEx: entrega;Rua das Flores 123 - SP;1001;João Silva;11999999999;Entregar na portaria;2026-07-20\nEx: coleta;Av Paulista 1000 - SP;OS-552;Maria Souza;11988888888;Retirar no galpão;2026-07-21";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_demandas_completo.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').map(row => row.split(';'));
        
        // Skip header
        const dataRows = rows.slice(1).filter(row => row.length >= 2 && row[1].trim() !== '');
        
        let geocoder: any = null;
        if (geocodingLibrary) {
          geocoder = new geocodingLibrary.Geocoder();
        }

        let count = 0;
        for (const row of dataRows) {
          const typeRaw = row[0]?.toLowerCase().trim();
          const type = typeRaw === 'coleta' ? 'coleta' : 'entrega';
          const address = row[1]?.trim() || '';
          const orderOs = row[2]?.trim() || '';
          const name = row[3]?.trim() || '';
          const phone = row[4]?.trim() || '';
          const obs = row[5]?.trim() || '';
          const dateStr = row[6]?.trim() || '';

          if (!address) continue;

          let lat = null;
          let lng = null;

          if (geocoder) {
            try {
               const response = await geocoder.geocode({ address: address });
               if (response.results && response.results[0]) {
                 lat = response.results[0].geometry.location.lat();
                 lng = response.results[0].geometry.location.lng();
               }
            } catch (err) {
               console.warn("Geocode failed for", address, err);
            }
            await new Promise(r => setTimeout(r, 200));
          }

          await addDoc(collection(db, 'external_requests'), {
            type,
            address,
            osNumber: type === 'coleta' ? orderOs : '',
            orderNumber: type === 'entrega' ? orderOs : '',
            requesterName: name,
            contactPhone: phone,
            observations: obs,
            scheduledDate: dateStr,
            status: 'pending',
            read: true,
            createdAt: new Date().toISOString(),
            lat,
            lng
          });
          
          count++;
          setImportProgress(Math.round((count / dataRows.length) * 100));
        }

        alert(`${count} demandas importadas com sucesso!`);
      } catch (err) {
        console.error("Error importing CSV:", err);
        alert("Erro ao importar CSV.");
      } finally {
        setIsImporting(false);
        setImportProgress(0);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

    reader.readAsText(file);
  };

  const handleEditClick = (e: React.MouseEvent, req: ExternalRequest) => {
    e.stopPropagation();
    setEditingId(req.id);
    setManualForm({
      type: req.type as 'coleta' | 'entrega',
      address: req.address,
      requesterName: req.requesterName || '',
      contactPhone: req.contactPhone || '',
      osNumber: req.osNumber || '',
      orderNumber: req.orderNumber || '',
      observations: req.observations || '',
      scheduledDate: req.scheduledDate || '',
      status: req.status || 'pending'
    });
    setIsModalOpen(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.address) return;
    
    let lat = null;
    let lng = null;

    if (geocodingLibrary) {
      const geocoder = new geocodingLibrary.Geocoder();
      try {
         const response = await geocoder.geocode({ address: manualForm.address });
         if (response.results && response.results[0]) {
           lat = response.results[0].geometry.location.lat();
           lng = response.results[0].geometry.location.lng();
         }
      } catch (err) {
         console.warn("Geocode failed for manual entry", manualForm.address, err);
      }
    }

    if (editingId) {
      await update(editingId, {
        ...manualForm,
        ...(lat && lng ? { lat, lng } : {})
      });
    } else {
      await addDoc(collection(db, 'external_requests'), {
        ...manualForm,
        read: true,
        createdAt: new Date().toISOString(),
        lat,
        lng
      });
    }

    setIsModalOpen(false);
    setEditingId(null);
    setManualForm({
      type: 'entrega',
      address: '',
      requesterName: '',
      contactPhone: '',
      osNumber: '',
      orderNumber: '',
      observations: '',
      scheduledDate: '',
      status: 'pending'
    });
  };

  const handleGenerateRoute = () => {
    localStorage.setItem('mapSelectedRequests', JSON.stringify(selectedIds));
    const routesBtn = document.querySelector('button[title="Rotas"]') || document.querySelector('a[href="#routes"]');
    if (routesBtn) {
      (routesBtn as HTMLElement).click();
    } else {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'routes' }));
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllInDate = (date: string, reqs: ExternalRequest[]) => {
    const ids = reqs.map(r => r.id);
    const allSelected = ids.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleMarkConverted = async (id: string) => {
    await update(id, { status: 'on_route' });
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getSuggestionForRequest = (req: ExternalRequest) => {
    if (!req.lat || !req.lng || !routes) return null;
    if (req.status !== 'pending') return null;

    let bestSuggestion: { routeId: string, routeName: string, distance: number, bestInsertIndex: number } | null = null;

    routes.filter(r => r.status === 'in_progress' || r.status === 'pending').forEach(route => {
      if (!route.stopDetails || route.stopDetails.length === 0) return;
      
      let isClose = false;
      for (const stop of route.stopDetails) {
        if (stop.lat && stop.lng) {
          const dist = getDistance(req.lat!, req.lng!, stop.lat, stop.lng);
          if (dist <= 5) { // 5km threshold
            isClose = true;
            break;
          }
        }
      }

      if (isClose) {
        const firstPendingIndex = route.stopDetails.findIndex(s => s.status === 'pending');
        const startIdx = firstPendingIndex === -1 ? route.stopDetails.length : firstPendingIndex;
        
        let minAdditionalDistance = Infinity;
        let bestIdx = startIdx;
        
        for (let i = startIdx; i <= route.stopDetails.length; i++) {
          const prev = i > 0 ? route.stopDetails[i - 1] : null;
          const next = i < route.stopDetails.length ? route.stopDetails[i] : null;

          let cost = 0;
          const distToPrev = (prev && prev.lat && prev.lng) ? getDistance(prev.lat, prev.lng, req.lat!, req.lng!) : 0;
          const distToNext = (next && next.lat && next.lng) ? getDistance(req.lat!, req.lng!, next.lat, next.lng) : 0;
          const distPrevToNext = (prev && prev.lat && prev.lng && next && next.lat && next.lng) 
            ? getDistance(prev.lat, prev.lng, next.lat, next.lng) : 0;

          if (prev && next) {
            cost = distToPrev + distToNext - distPrevToNext;
          } else if (prev && !next) {
            cost = distToPrev;
          } else if (!prev && next) {
            cost = distToNext;
          }

          if (cost < minAdditionalDistance) {
            minAdditionalDistance = cost;
            bestIdx = i;
          }
        }

        let minDistanceToStop = Infinity;
        route.stopDetails.forEach(s => {
          if (s.lat && s.lng) {
            const d = getDistance(req.lat!, req.lng!, s.lat, s.lng);
            if (d < minDistanceToStop) minDistanceToStop = d;
          }
        });

        if (!bestSuggestion || minDistanceToStop < bestSuggestion.distance) {
          bestSuggestion = {
            routeId: route.id,
            routeName: route.routeNumber ? `Rota #${String(route.routeNumber).padStart(7, '0')}` : `Rota #${route.id.slice(0, 8).toUpperCase()}`,
            distance: minDistanceToStop,
            bestInsertIndex: bestIdx
          };
        }
      }
    });

    return bestSuggestion;
  };

  const handleEncaixarRota = async (req: ExternalRequest, suggestion: any) => {
    const routeRef = doc(db, 'routes', suggestion.routeId);
    const route = routes?.find(r => r.id === suggestion.routeId);
    if (!route) return;

    try {
      const newStopDetail = {
        id: `stop-${Date.now()}`,
        address: req.address,
        status: 'pending' as 'pending',
        externalRequestId: req.id,
        customerName: req.requesterName || '',
        customerPhone: req.contactPhone || '',
        orderNumber: req.orderNumber || req.osNumber || '',
        observation: req.observations || '',
        lat: req.lat || null,
        lng: req.lng || null
      };

      const newIntermediates = [...(route.intermediates || [])];
      const newMeta = [...((route as any).intermediateMetadata || [])];
      const newStopDetails = [...(route.stopDetails || [])];

      const metaItem = {
         address: req.address,
         lat: req.lat || null,
         lng: req.lng || null,
         externalRequestId: req.id
      };

      const insertInterIdx = Math.min(suggestion.bestInsertIndex, newIntermediates.length);

      newIntermediates.splice(insertInterIdx, 0, req.address);
      newMeta.splice(insertInterIdx, 0, metaItem);
      newStopDetails.splice(suggestion.bestInsertIndex, 0, newStopDetail);

      await updateDoc(routeRef, {
        intermediates: newIntermediates,
        intermediateMetadata: newMeta,
        stopDetails: newStopDetails,
        stops: newStopDetails.length
      });

      await update(req.id, { status: 'on_route' });

      alert(`Parada encaixada de forma otimizada na ${suggestion.routeName}!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao encaixar parada na rota.');
    }
  };

  const handleDesvincular = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja desvincular esta demanda da rota e retornar para Pendente?')) return;
    
    try {
      // Update request to pending
      await update(id, { status: 'pending' });
      
      // Try to find the route containing this request and remove it
      if (routes) {
        for (const route of routes) {
          const stopIndex = route.stopDetails?.findIndex(s => s.externalRequestId === id);
          if (stopIndex !== undefined && stopIndex !== -1 && route.stopDetails) {
            let newIntermediates = [...(route.intermediates || [])];
            let newMeta = [...(route.intermediateMetadata || [])];
            
            const address = route.stopDetails[stopIndex].address;
            const indexToRemove = newIntermediates.findIndex(addr => addr === address);
            if (indexToRemove !== -1) {
              newIntermediates.splice(indexToRemove, 1);
              newMeta.splice(indexToRemove, 1);
            }

            const newStopDetails = route.stopDetails.filter(s => s.externalRequestId !== id);
            const newStopsCount = Math.max(1, newStopDetails.length);
            
            const routeRef = doc(db, 'routes', route.id);
            await updateDoc(routeRef, {
              intermediates: newIntermediates,
              intermediateMetadata: newMeta,
              stopDetails: newStopDetails,
              stops: newStopsCount
            });
          }
        }
      }
      
      alert('Demanda desvinculada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao desvincular demanda.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta demanda?')) {
      await remove(id);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === 'sem_data') return 'Sem Data Agendada';
    const d = new Date(dateStr + 'T12:00:00');
    return `${d.toLocaleDateString('pt-BR')} - ${d.toLocaleDateString('pt-BR', { weekday: 'long' })}`;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Banco de Demandas</h1>
          <p className="text-slate-500">Gerencie todas as paradas (Público, CSV, Manual) pendentes para roteirização.</p>
        </div>

        <div className="flex flex-wrap gap-3 w-full sm:w-auto mt-4 sm:mt-0 items-center">
          {selectedIds.length > 0 && (
            <button 
              onClick={handleGenerateRoute}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm animate-in zoom-in"
            >
              <MapPin size={18} /> Roteirizar ({selectedIds.length})
            </button>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 bg-brand-cyan text-white rounded-xl font-medium hover:bg-brand-blue transition-colors shadow-sm"
          >
            <Plus size={18} /> Nova Demanda
          </button>
          <button 
            onClick={downloadCSVTemplate}
            className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download size={18} /> Modelo CSV
          </button>
          <label className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors shadow-sm cursor-pointer relative overflow-hidden">
            <Upload size={18} /> 
            {isImporting ? `Importando (${importProgress}%)` : 'Importar CSV'}
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isImporting} />
            {isImporting && (
              <div className="absolute bottom-0 left-0 h-1 bg-brand-cyan" style={{width: `${importProgress}%`}}></div>
            )}
          </label>

        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por endereço, nome ou pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none shadow-sm font-medium text-slate-700"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none shadow-sm font-medium text-slate-700"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendentes</option>
              <option value="on_route">Em Rota</option>
              <option value="completed">Concluídos</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50/50 custom-scrollbar">
          {filteredRequests?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <Package size={48} className="text-slate-300" />
              <p className="text-lg font-medium text-slate-500">Nenhuma demanda encontrada</p>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedDates.map(date => (
                <div key={date} className="space-y-4">
                  {/* Date Header */}
                  <div className="flex items-center gap-3">
                    <div className="h-px bg-slate-200 flex-1"></div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm capitalize">
                      📅 {formatDateLabel(date)}
                      <button 
                        onClick={() => selectAllInDate(date, groupedRequests[date])}
                        className="ml-2 text-xs text-brand-cyan hover:underline font-semibold"
                      >
                        (Selecionar Todos)
                      </button>
                    </div>
                    <div className="h-px bg-slate-200 flex-1"></div>
                  </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="p-3 w-12 text-center">
                              <input 
                                type="checkbox" 
                                checked={groupedRequests[date].every(r => selectedIds.includes(r.id))}
                                onChange={() => selectAllInDate(date, groupedRequests[date])}
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                              />
                            </th>
                            <th className="p-3 font-semibold">Status</th>
                            <th className="p-3 font-semibold">Tipo</th>
                            <th className="p-3 font-semibold">Endereço</th>
                            <th className="p-3 font-semibold">Cliente</th>
                            <th className="p-3 font-semibold">OS/Pedido</th>
                            <th className="p-3 w-16 text-center font-semibold">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {groupedRequests[date].map(request => (
                            <tr 
                              key={request.id} 
                              className={`hover:bg-slate-50 cursor-pointer ${selectedIds.includes(request.id) ? 'bg-primary/5' : ''}`}
                              onClick={() => toggleSelection(request.id)}
                            >
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  checked={selectedIds.includes(request.id)} 
                                  onChange={() => toggleSelection(request.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                />
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                                  request.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                                  request.status === 'on_route' ? 'bg-blue-100 text-blue-700' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {request.status === 'pending' ? 'Pendente' : request.status === 'on_route' ? 'Em Rota' : 'Concluído'}
                                </span>
                              </td>
                              <td className="p-3 capitalize font-medium text-slate-700">{request.type}</td>
                              <td className="p-3 text-slate-600 truncate max-w-[200px]" title={request.address}>{request.address}</td>
                              <td className="p-3 text-slate-600 truncate max-w-[150px]">{request.requesterName}</td>
                              <td className="p-3 text-slate-600">{request.orderNumber || request.osNumber || '-'}</td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {(() => {
                                    const suggestion = getSuggestionForRequest(request);
                                    return (
                                      <>
                                        {suggestion && request.status === 'pending' && (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleEncaixarRota(request, suggestion); }}
                                            className="flex items-center gap-1 px-2 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[10px] font-semibold border border-indigo-200 transition-colors whitespace-nowrap"
                                            title={`Encaixar na ${suggestion.routeName} (adiciona +${suggestion.distance.toFixed(1)}km)`}
                                          >
                                            <MapPin size={12} /> Sugestão ({suggestion.distance.toFixed(1)}km)
                                          </button>
                                        )}
                                        {request.status === 'pending' && (
                                          <button
                                            onClick={(e) => {
                                               e.stopPropagation();
                                               setManualAssignRequest(request);
                                               setSelectedAssignRouteId('');
                                               setSelectedAssignIndex(-1);
                                            }}
                                            className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg text-[10px] font-semibold border border-slate-200 transition-colors whitespace-nowrap"
                                            title="Encaixe Manual em Rota Existente"
                                          >
                                            <ListIcon size={12} /> Manual
                                          </button>
                                        )}
                                      </>
                                    );
                                  })()}
                                  {request.status === 'on_route' && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDesvincular(request.id); }}
                                      title="Desvincular da rota"
                                      className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                                    >
                                      <X size={16} />
                                    </button>
                                  )}
                                  <button 
                                    onClick={(e) => handleEditClick(e, request)}
                                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Editar"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(request.id); }}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Excluir"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-100 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Plus className="text-brand-cyan" />
                {editingId ? 'Editar Demanda' : 'Nova Demanda'}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-200 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleManualSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Tarefa</label>
                  <select 
                    value={manualForm.type}
                    onChange={(e) => setManualForm({...manualForm, type: e.target.value as any})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none text-slate-700 font-medium"
                  >
                    <option value="entrega">Entrega</option>
                    <option value="coleta">Coleta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                  <select 
                    value={manualForm.status}
                    onChange={(e) => setManualForm({...manualForm, status: e.target.value as any})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none text-slate-700 font-medium"
                  >
                    <option value="pending">Pendente</option>
                    <option value="on_route">Em Rota</option>
                    <option value="completed">Concluído</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Data Agendada (Opcional)</label>
                  <input 
                    type="date"
                    value={manualForm.scheduledDate}
                    onChange={(e) => setManualForm({...manualForm, scheduledDate: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none text-slate-700 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Endereço Completo</label>
                <input 
                  type="text"
                  required
                  value={manualForm.address}
                  onChange={(e) => setManualForm({...manualForm, address: e.target.value})}
                  placeholder="Ex: Rua das Flores, 123, São Paulo - SP"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Cliente/Fornecedor</label>
                  <input 
                    type="text"
                    required
                    value={manualForm.requesterName}
                    onChange={(e) => setManualForm({...manualForm, requesterName: e.target.value})}
                    placeholder="Nome completo ou empresa"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Telefone</label>
                  <input 
                    type="tel"
                    required
                    value={manualForm.contactPhone}
                    onChange={(e) => setManualForm({...manualForm, contactPhone: e.target.value})}
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {manualForm.type === 'coleta' ? (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Nº da OS</label>
                    <input 
                      type="text"
                      value={manualForm.osNumber}
                      onChange={(e) => setManualForm({...manualForm, osNumber: e.target.value})}
                      placeholder="Ex: OS-1029"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Nº do Pedido</label>
                    <input 
                      type="text"
                      value={manualForm.orderNumber}
                      onChange={(e) => setManualForm({...manualForm, orderNumber: e.target.value})}
                      placeholder="Ex: PED-5521"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Observações Adicionais</label>
                <textarea 
                  value={manualForm.observations}
                  onChange={(e) => setManualForm({...manualForm, observations: e.target.value})}
                  rows={3}
                  placeholder="Instruções de entrega, horário limite, etc."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none resize-none"
                ></textarea>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingId(null); }}
                  className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-brand-cyan text-white rounded-xl font-semibold hover:bg-brand-blue transition-colors"
                >
                  {editingId ? 'Salvar Alterações' : 'Salvar Demanda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {manualAssignRequest && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Encaixe Manual de Rota</h2>
              <button 
                onClick={() => setManualAssignRequest(null)}
                className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">1. Selecione a Rota</label>
                <select 
                  value={selectedAssignRouteId}
                  onChange={(e) => {
                    setSelectedAssignRouteId(e.target.value);
                    setSelectedAssignIndex(-1); // reset index
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none text-slate-700 font-medium"
                >
                  <option value="">Selecione uma rota ativa...</option>
                  {routes?.filter(r => r.status === 'in_progress' || r.status === 'pending').map(r => {
                    const rName = r.routeNumber ? `Rota #${String(r.routeNumber).padStart(7, '0')}` : `Rota #${r.id.slice(0, 8).toUpperCase()}`;
                    return (
                      <option key={r.id} value={r.id}>
                        {rName} - Motorista: {r.driverName || 'Não atribuído'} ({r.stops} paradas)
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedAssignRouteId && (() => {
                const route = routes?.find(r => r.id === selectedAssignRouteId);
                if (!route || !route.stopDetails) return null;

                const firstPendingIdx = route.stopDetails.findIndex(s => s.status === 'pending');
                const startIdx = firstPendingIdx === -1 ? route.stopDetails.length : firstPendingIdx;

                const bestSuggestion = getSuggestionForRequest(manualAssignRequest);
                const optimalIdx = (bestSuggestion && bestSuggestion.routeId === selectedAssignRouteId) ? bestSuggestion.bestInsertIndex : -1;

                const options = [];
                for (let i = startIdx; i <= route.stopDetails.length; i++) {
                   const isOptimal = i === optimalIdx;
                   const labelBase = i === route.stopDetails.length 
                     ? `Fim da Rota (Última parada)` 
                     : `Posição ${i + 1} (Antes de: ${route.stopDetails[i].address.split(',')[0]})`;
                   
                   options.push({
                     index: i,
                     label: isOptimal ? `${labelBase} ⭐ Recomendado` : labelBase
                   });
                }

                return (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">2. Posição de Encaixe</label>
                    <select
                      value={selectedAssignIndex}
                      onChange={(e) => setSelectedAssignIndex(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan outline-none text-slate-700 font-medium"
                    >
                      <option value={-1} disabled>Selecione a posição...</option>
                      {options.map(opt => (
                        <option key={opt.index} value={opt.index}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setManualAssignRequest(null)}
                className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                disabled={!selectedAssignRouteId || selectedAssignIndex === -1}
                onClick={() => {
                   if(selectedAssignRouteId && selectedAssignIndex !== -1) {
                      const route = routes?.find(r => r.id === selectedAssignRouteId);
                      const rName = route?.routeNumber ? `Rota #${String(route.routeNumber).padStart(7, '0')}` : `Rota #${selectedAssignRouteId.slice(0, 8).toUpperCase()}`;
                      handleEncaixarRota(manualAssignRequest, { routeId: selectedAssignRouteId, routeName: rName, bestInsertIndex: selectedAssignIndex });
                      setManualAssignRequest(null);
                   }
                }}
                className="px-6 py-2.5 bg-brand-cyan text-white font-medium rounded-xl hover:bg-brand-blue transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Encaixe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
