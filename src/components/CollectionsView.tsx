import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { collectionRequestService, driverService, vehicleService, logService, userService, settingsService } from '../lib/services';
import { CollectionRequest, Driver, Vehicle, VehicleLog, UserProfile, GlobalSettings } from '../types';
import { Plus, MapPin, Send, CheckCircle2, XCircle, Search, AlertTriangle, Clock, Map as MapIcon, Navigation, Users, Pencil, Trash2, Building2, X, Sparkles, Calendar, Truck, ClipboardList, Info, Link, Check, Share2, FileText } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { APIProvider, Map, Marker, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

import { RoutePlanner } from './RoutePlanner';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const FLEET_COLORS = ['#7B5CFF', '#00D1B2', '#2D9CFF', '#FFB800', '#FF4D4D', '#F06292', '#81C784'];

interface Cluster {
  id: string;
  color: string;
  requests: CollectionRequest[];
  totalEstimatedSeconds: number;
  selectedDriverId: string;
}

export function CollectionsView() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<CollectionRequest[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<VehicleLog[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [hqInput, setHqInput] = useState('');
  const [hasInitializedHq, setHasInitializedHq] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [editingRequest, setEditingRequest] = useState<CollectionRequest | null>(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [routeClusters, setRouteClusters] = useState<Cluster[]>([]);
  const [isolatedDriverId, setIsolatedDriverId] = useState<string | null>(null);
  const [showRoutePlannerForDriver, setShowRoutePlannerForDriver] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    address: '',
    type: 'coleta' as 'coleta' | 'entrega',
    priority: 'medium' as const,
    scheduledDate: '',
    observations: ''
  });
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [copiedRequestId, setCopiedRequestId] = useState<string | null>(null);

  const handleShareWhatsApp = (req: CollectionRequest) => {
    // 1. Better Driver Lookup (Check virtual drivers and internal users)
    const virtualDriver = drivers.find(d => d.id === req.assignedDriverId);
    const internalDriver = allUsers.find(u => u.uid === req.assignedDriverId);
    const driverName = virtualDriver?.name || internalDriver?.name || 'Não informado';
    
    // 2. Robust Date Handling
    // Try completedAt first, fallback to createdAt or current date
    const dateSource = req.completedAt || req.createdAt || new Date();
    const completedAt = dateSource?.toDate ? dateSource.toDate() : 
                        (dateSource instanceof Date ? dateSource : new Date(dateSource));
    
    // Final safety check for Invalid Date
    const isValidDate = !isNaN(completedAt.getTime());
    const finalDate = isValidDate ? completedAt : new Date();
                        
    const time = finalDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = finalDate.toLocaleDateString('pt-BR');
    
    const summary = `*RESUMO DE ${req.type?.toUpperCase() || 'COLETA'}*\n` +
      `📌 *Status:* ${req.status === 'refused' ? '❌ RECUSADO' : '✅ CONCLUÍDO'}\n` +
      `🏢 *Cliente:* ${req.title}\n` +
      `📍 *Endereço:* ${req.address}\n` +
      `🚚 *Motorista:* ${driverName}\n` +
      `⏰ *Data/Hora:* ${date} às ${time}\n` +
      `📝 *Obs:* ${req.observations || 'Nenhuma'}`;
    
    navigator.clipboard.writeText(summary);
    setCopiedRequestId(req.id);
    setTimeout(() => setCopiedRequestId(null), 2000);
  };

  useEffect(() => {
    if (editingRequest) {
      setFormData({
        title: editingRequest.title,
        address: editingRequest.address,
        type: editingRequest.type || 'coleta',
        priority: editingRequest.priority,
        scheduledDate: editingRequest.scheduledDate || '',
        observations: editingRequest.observations || ''
      });
      setShowAddForm(true);
    } else {
      setFormData({ title: '', address: '', type: 'coleta', priority: 'medium', scheduledDate: '', observations: '' });
    }
  }, [editingRequest]);

  useEffect(() => {
    if (!user) return;
    const unsubRequests = collectionRequestService.subscribeToRequests(setRequests);
    const unsubDrivers = driverService.subscribeToDrivers(setDrivers);
    const unsubVehicles = vehicleService.subscribeToVehicles(setVehicles);
    const unsubLogs = logService.subscribeToLogs(setLogs);
    const unsubUsers = userService.listUsers(setAllUsers);
    const unsubSettings = settingsService.getSettings((settings) => {
      setGlobalSettings(settings);
      if (!hasInitializedHq) {
        if (settings) {
          setHqInput(settings.headquarterAddress);
        }
        setHasInitializedHq(true);
      }
    });

    return () => {
      unsubRequests();
      unsubDrivers();
      unsubVehicles();
      unsubLogs();
      unsubUsers();
      unsubSettings();
    };
  }, [user]);

  // Helper to calculate distance (Haversine)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const activeLogs = useMemo(() => {
    // 1. Filter only active logs
    const active = logs.filter(l => l.status === 'active');
    
    // 2. Create a lookup for driver records status
    const driverStatusMap: Record<string, string> = {};
    drivers.forEach(d => {
      driverStatusMap[d.name] = d.status;
    });

    // 2.2 Create a lookup for user profiles
    const userProfileMap: Record<string, UserProfile> = {};
    allUsers.forEach(u => {
      userProfileMap[u.uid] = u;
    });

    // 2.5 Persistent GPS users (8h rule)
    const now = new Date();
    const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);
    const trackingUsers = allUsers.filter(u => 
      u.role === 'driver' && // Only drivers
      u.isTrackingActive && 
      u.locationUpdatedAt && 
      u.locationUpdatedAt.toDate() >= eightHoursAgo
    );

    // 3. Filter logs and remove duplicates (keep most recent)
    // Key by ownerId for better uniqueness
    const uniqueActiveLogs: Record<string, VehicleLog & { driverEmail?: string }> = {};
    
    active.forEach(log => {
      // Find the user profile to get the most accurate name AND email
      const userProfile = log.ownerId ? userProfileMap[log.ownerId] : null;
      
      // If the driver is officially marked as inactive, we don't show them
      if (userProfile && userProfile.status === 'inactive') return;
      if (!userProfile && driverStatusMap[log.driverName] === 'inactive') return;

      const enrichedName = userProfile?.name || log.driverName;
      const email = userProfile?.email;

      // Robust key selection: prefer ownerId, fallback to driverName for legacy data
      const key = log.ownerId || `legacy-${log.driverName}`;
      const existing = uniqueActiveLogs[key];
      
      if (!existing || (log.startTime?.seconds || 0) > (existing.startTime?.seconds || 0)) {
        uniqueActiveLogs[key] = {
          ...log,
          driverName: enrichedName,
          driverEmail: email
        };
      }
    });

    // 4. Add tracking users who DON'T have an active log
    trackingUsers.forEach(user => {
      if (user.status === 'inactive') return;
      if (!uniqueActiveLogs[user.uid]) {
        uniqueActiveLogs[user.uid] = {
          id: `tracking-${user.uid}`,
          driverName: user.name || 'Motorista',
          driverEmail: user.email,
          vehicleId: '',
          startMileage: 0,
          status: 'active',
          ownerId: user.uid,
          startTime: user.locationUpdatedAt,
          currentLat: user.lastLocation?.lat,
          currentLng: user.lastLocation?.lng
        } as any;
      }
    });

    const result = Object.values(uniqueActiveLogs);
    console.log("Active drivers found:", result.length);
    return result;
  }, [logs, drivers, allUsers]);

  const virtualFleetDrivers = useMemo(() => {
    return drivers.filter(d => d.isVirtual && d.status === 'active');
  }, [drivers]);

  const dispatchOptions = useMemo(() => {
    const options: { id: string; name: string; email?: string; vehiclePlate?: string; isVirtual: boolean }[] = [];
    
    // 1. Add logged drivers (Internal) - ONLY those with a valid session today
    activeLogs.forEach(log => {
      // Checklist is mandatory for internal drivers to be seen as active in the current session
      const logDate = log.startTime?.toDate ? log.startTime.toDate() : new Date(log.startTime);
      const isToday = logDate.toDateString() === new Date().toDateString();
      
      if (isToday) {
        options.push({
          id: log.ownerId || `legacy-${log.driverName}`,
          name: log.driverName,
          email: (log as any).driverEmail,
          vehiclePlate: vehicles.find(v => v.id === log.vehicleId)?.plate,
          isVirtual: false
        });
      }
    });

    // 2. Add virtual drivers (Frota Terceirizada)
    virtualFleetDrivers.forEach(vd => {
      // Ensure we don't duplicate if a virtual driver somehow has a log
      if (!options.find(o => o.id === vd.id)) {
        options.push({
          id: vd.id,
          name: vd.name,
          email: vd.phone,
          isVirtual: true
        });
      }
    });

    return options;
  }, [activeLogs, virtualFleetDrivers, vehicles]);

  // Logic to find closest driver and sort them
  const sortedDriversByProximity = useMemo(() => {
    return (requestId: string) => {
      const request = requests.find(r => r.id === requestId);
      if (!request || !request.lat || !request.lng) return activeLogs;

      return [...activeLogs].sort((a, b) => {
        if (!a.currentLat || !a.currentLng) return 1;
        if (!b.currentLat || !b.currentLng) return -1;
        
        const distA = calculateDistance(request.lat!, request.lng!, a.currentLat, a.currentLng);
        const distB = calculateDistance(request.lat!, request.lng!, b.currentLat, b.currentLng);
        return distA - distB;
      });
    };
  }, [requests, activeLogs]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let lat, lng;
    // Attempt geocoding if Google Maps API is available
    if (window.google?.maps?.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      try {
        const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode({ address: formData.address }, (results, status) => {
            if (status === 'OK' && results) resolve(results);
            else reject(status);
          });
        });
        if (result[0]) {
          lat = result[0].geometry.location.lat();
          lng = result[0].geometry.location.lng();
        }
      } catch (err) {
        console.warn("Geocoding failed, creating without coordinates:", err);
      }
    }

    if (editingRequest) {
      await collectionRequestService.updateRequest(editingRequest.id, {
        ...formData,
        lat: lat ?? editingRequest.lat,
        lng: lng ?? editingRequest.lng
      });
    } else {
      await collectionRequestService.addRequest({
        ...formData,
        status: 'pending',
        lat: lat ?? null,
        lng: lng ?? null
      }, user.uid);
    }

    setShowAddForm(false);
    setEditingRequest(null);
    setFormData({ title: '', address: '', priority: 'medium', scheduledDate: '', observations: '' });
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteRequest = async (id: string) => {
    await collectionRequestService.deleteRequest(id);
    setConfirmDeleteId(null);
  };

  const handleAssign = async (requestId: string, driverId: string) => {
    if (!requestId || !driverId) {
      console.error("Assignment failed: Missing ID", { requestId, driverId });
      return;
    }
    
    // Find vehicle ID from active log (or virtual vehicles)
    const activeLog = activeLogs.find(l => l.ownerId === driverId || `legacy-${l.driverName}` === driverId);
    let vehicleId = activeLog?.vehicleId || '';

    if (!vehicleId) {
      // Maybe it's a virtual driver with a virtual vehicle
      const virtualDriver = virtualFleetDrivers.find(vd => vd.id === driverId);
      if (virtualDriver) {
        // Find a virtual vehicle or any active vehicle
        const virtualVehicle = vehicles.find(v => v.isVirtual && v.status === 'active');
        vehicleId = virtualVehicle?.id || '';
      }
    }

    console.log(`Assigning request ${requestId} to driver ${driverId} (Vehicle: ${vehicleId})`);
    await collectionRequestService.assignDriver(requestId, driverId, vehicleId);
  };

  const handleUnassign = async (requestId: string) => {
    if (!requestId) return;
    await collectionRequestService.unassignRequest(requestId);
  };

  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleIntelligentDistribution = () => {
    if (selectedRequestIds.size === 0) return;
    setIsOptimizing(true);

    try {
      const selectedRequests = requests.filter(r => 
        selectedRequestIds.has(r.id) && 
        r.status === 'pending' && 
        typeof r.lat === 'number' && 
        typeof r.lng === 'number'
      );

      if (selectedRequests.length === 0) {
        alert("Nenhuma das solicitações selecionadas possui coordenadas válidas para roteirização.");
        return;
      }

      const MAX_SECONDS = 7 * 60 * 60; // 7 Hours target
      const AVG_SPEED_KMH = 30;
      const SERVICE_TIME_SECONDS = 15 * 60; // 15 Minutes per stop as requested

      let remainingRequests = [...selectedRequests];
      const clusters: Cluster[] = [];
      const colors = [
        'border-ork-primary bg-ork-primary/10',
        'border-ork-accent bg-ork-accent/10',
        'border-ork-secondary bg-ork-secondary/10',
        'border-emerald-500 bg-emerald-500/10',
        'border-amber-500 bg-amber-500/10',
        'border-rose-500 bg-rose-500/10',
        'border-blue-500 bg-blue-500/10',
        'border-purple-500 bg-purple-500/10'
      ];

      // Use Matriz (Headquarter) as starting point if available, else first request
      let currentPos = globalSettings?.headquarterAddress && requests.length > 0
        ? { lat: -23.5505, lng: -46.6333 } // Fallback coords for "Matriz", in a real app would geocode HQ
        : { lat: selectedRequests[0].lat!, lng: selectedRequests[0].lng! };

      let currentCluster: CollectionRequest[] = [];
      let currentClusterSeconds = 0;

      while (remainingRequests.length > 0) {
        let bestIdx = -1;
        let minDistance = Infinity;

        for (let i = 0; i < remainingRequests.length; i++) {
          const req = remainingRequests[i];
          const dist = calculateDistance(currentPos.lat, currentPos.lng, req.lat!, req.lng!);
          if (dist < minDistance) {
            minDistance = dist;
            bestIdx = i;
          }
        }

        if (bestIdx !== -1) {
          const req = remainingRequests[bestIdx];
          const travelTime = (minDistance / AVG_SPEED_KMH) * 3600;
          const totalStopSeconds = travelTime + SERVICE_TIME_SECONDS;

          // Check if adding this stop exceeds the 7h limit
          if (currentClusterSeconds + totalStopSeconds > MAX_SECONDS && currentCluster.length > 0) {
            // Close current cluster
            clusters.push({
              id: Math.random().toString(36).substr(2, 9),
              color: colors[clusters.length % colors.length],
              requests: currentCluster,
              totalEstimatedSeconds: currentClusterSeconds,
              selectedDriverId: ''
            });

            // Reset for new cluster
            currentCluster = [];
            currentClusterSeconds = 0;
            // New cluster starts from Matriz or previous position? 
            // Better to restart from Matriz if possible to balance geographically
          }

          currentCluster.push(req);
          currentClusterSeconds += totalStopSeconds;
          currentPos = { lat: req.lat!, lng: req.lng! };
          remainingRequests.splice(bestIdx, 1);
        }
      }

      // Add final cluster
      if (currentCluster.length > 0) {
        clusters.push({
          id: Math.random().toString(36).substr(2, 9),
          color: colors[clusters.length % colors.length],
          requests: currentCluster,
          totalEstimatedSeconds: currentClusterSeconds,
          selectedDriverId: ''
        });
      }

      setRouteClusters(clusters);
      setSelectedRequestIds(new Set());
      
    } catch (error) {
      console.error("Clustering Error:", error);
      alert("Erro ao gerar agrupamentos geográficos.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleConfirmDispatch = async (clusterId: string) => {
    const cluster = routeClusters.find(c => c.id === clusterId);
    if (!cluster || !cluster.selectedDriverId) {
      alert("Selecione um motorista para este grupo.");
      return;
    }

    const { selectedDriverId } = cluster;
    const activeLog = activeLogs.find(l => l.ownerId === selectedDriverId || `legacy-${l.driverName}` === selectedDriverId);
    let vehicleId = activeLog?.vehicleId || '';

    if (!vehicleId) {
      const virtualDriver = virtualFleetDrivers.find(vd => vd.id === selectedDriverId);
      if (virtualDriver) {
        const virtualVehicle = vehicles.find(v => v.isVirtual && v.status === 'active');
        vehicleId = virtualVehicle?.id || '';
      }
    }

    const requestIds = cluster.requests.map(r => r.id);

    try {
      await collectionRequestService.batchAssignDrivers(requestIds, selectedDriverId, vehicleId);
      setRouteClusters(prev => prev.filter(c => c.id !== clusterId));
    } catch (error) {
      console.error("Dispatch error:", error);
      alert("Erro ao confirmar despacho.");
    }
  };

  const updateClusterDriver = (clusterId: string, driverId: string) => {
    setRouteClusters(prev => prev.map(c => 
      c.id === clusterId ? { ...c, selectedDriverId: driverId } : c
    ));
  };

  const handleBatchAssign = async (driverId: string) => {
    if (!driverId || selectedRequestIds.size === 0) return;
    setShowRoutePlannerForDriver(driverId);
  };

  const handleSaveHeadquarter = async () => {
    await settingsService.updateHeadquarter(hqInput);
  };

  const generateGoogleMapsRoute = (requestList: CollectionRequest[]) => {
    if (requestList.length === 0) return '';
    
    const stops = requestList
      .filter(r => r.address)
      .map(r => encodeURIComponent(r.address));
    
    const destination = globalSettings?.headquarterAddress 
      ? encodeURIComponent(globalSettings.headquarterAddress) 
      : (stops[stops.length - 1] || stops[0]);
    
    return `https://www.google.com/maps/dir/?api=1&origin=${stops[0]}&waypoints=${stops.slice(1).join('|')}&destination=${destination}&travelmode=driving`;
  };

  const toggleSelectAll = () => {
    if (selectedRequestIds.size === requests.filter(r => r.status === 'pending').length) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(requests.filter(r => r.status === 'pending').map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedRequestIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRequestIds(next);
  };

  const handleManualComplete = async (requestId: string) => {
    await collectionRequestService.updateRequest(requestId, {
      status: 'delivered_manual',
    });
  };

  const renderRequestCard = (req: CollectionRequest) => {
    const assignedDriver = drivers.find(d => d.id === req.assignedDriverId);
    const isVirtual = assignedDriver?.isVirtual;

    const statusLabel = req.status === 'pending' ? 'Pendente de Atribuição' : 
                        (req.status === 'assigned' || req.status === 'accepted') ? 'Pendente de Coleta' :
                        (req.status === 'completed' || req.status === 'delivered_manual') ? 'Coletado' : 'Recusado';

    const statusColor = req.status === 'pending' ? "bg-white/5 text-ork-text-muted border-white/10" :
                        (req.status === 'assigned' || req.status === 'accepted') ? "bg-ork-secondary/10 text-ork-secondary border-ork-secondary/20" :
                        (req.status === 'refused') ? "bg-red-500/10 text-red-500 border-red-500/20" :
                        "bg-emerald-500/20 text-emerald-500 border-emerald-500/30";

    return (
    <motion.div 
      layout
      key={req.id}
      className={cn(
        "bg-ork-surface/30 border border-white/5 rounded-2xl p-4 hover:border-ork-primary/40 transition-all group relative overflow-hidden",
        selectedRequestIds.has(req.id) && "border-ork-primary bg-ork-primary/[0.02]",
        (req.status === 'completed' || req.status === 'delivered_manual') && "opacity-60 grayscale-[0.3]"
      )}
    >
      <div className="absolute top-0 right-0 p-1 opacity-[0.03]">
        <Send size={24} className="text-ork-primary" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-start gap-2 mb-2 flex-wrap">
          {req.status === 'pending' && (
            <button 
              onClick={() => toggleSelect(req.id)}
              className={cn(
                "mt-0.5 w-4 h-4 rounded border transition-all flex items-center justify-center shrink-0",
                selectedRequestIds.has(req.id) 
                  ? "bg-ork-primary border-ork-primary text-white" 
                  : "bg-white/5 border-white/10 text-transparent"
              )}
            >
              <CheckCircle2 className="w-2.5 h-2.5" />
            </button>
          )}
          <span className={cn(
            "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm",
            req.priority === 'high' ? "bg-red-500 text-white" :
            req.priority === 'medium' ? "bg-ork-primary text-white" :
            "bg-ork-accent text-white"
          )}>
            {req.priority === 'high' ? 'Urgente' : req.priority === 'medium' ? 'Normal' : 'Baixa'}
          </span>
          <div className={cn(
            "px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border",
            statusColor
          )}>
            {statusLabel}
          </div>
        </div>

        <h4 className="text-[11px] font-bold text-white group-hover:text-ork-primary transition-colors leading-tight line-clamp-1">{req.title}</h4>
        {req.scheduledDate && (
          <div className="flex items-center gap-1 mt-1 text-[8px] font-black text-ork-accent uppercase tracking-widest">
            <Calendar className="w-2.5 h-2.5" />
            Agenda: {req.scheduledDate}
          </div>
        )}
        <p className="text-[9px] text-ork-text-muted flex items-start gap-1.5 mt-1.5 leading-relaxed line-clamp-2">
          <MapPin className="w-3 h-3 shrink-0 text-ork-accent mt-0.5" />
          {req.address}
        </p>

        {req.observations && (
          <div className="mt-2 p-2 bg-ork-primary/5 border border-ork-primary/10 rounded-lg flex items-start gap-2">
            <Info size={10} className="text-ork-primary mt-0.5 shrink-0" />
            <p className="text-[8px] text-ork-text-muted leading-tight line-clamp-2 italic">
              {req.observations}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-1.5">
            {req.status !== 'completed' && req.status !== 'delivered_manual' && req.status !== 'pending' && (
              <button 
                onClick={() => handleManualComplete(req.id)}
                title="Baixa Manual (Administrador)"
                className="p-1.5 bg-ork-accent/10 border border-ork-accent/20 rounded-lg text-ork-accent hover:bg-ork-accent hover:text-slate-950 transition-all active:scale-95"
              >
                <ClipboardList className="w-3 h-3" />
              </button>
            )}
            <button 
              onClick={() => setEditingRequest(req)}
              className="p-1.5 bg-ork-surface border border-ork-border rounded-lg text-ork-text-muted hover:text-ork-primary transition-all active:scale-95"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button 
              onClick={() => setConfirmDeleteId(req.id)}
              className="p-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            {(req.status === 'completed' || req.status === 'delivered_manual' || req.status === 'refused') && (
              <button 
                onClick={() => handleShareWhatsApp(req)}
                title="Compartilhar no WhatsApp"
                className={cn(
                  "p-1.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 min-w-[32px]",
                  copiedRequestId === req.id 
                    ? "bg-emerald-500 text-white" 
                    : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white"
                )}
              >
                {copiedRequestId === req.id ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
              </button>
            )}
            {req.status !== 'pending' && req.status !== 'completed' && req.status !== 'delivered_manual' && (
              <button 
                onClick={() => handleUnassign(req.id)}
                title="Remover Atribuição"
                className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-white/50 hover:text-white transition-all active:scale-95"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <span className="text-[8px] font-bold text-ork-text-muted uppercase">ID: {req.id.slice(-4)}</span>
        </div>
      </div>
    </motion.div>
    );
  };

  function renderLanes() {
    // 1. Filter for planning (available queue and active driver rows)
    const activeOperationalRequests = requests.filter(r => {
      if (!dateFilter) return true;
      // Requests planned for today
      return !r.scheduledDate || r.scheduledDate === dateFilter;
    });

    // 2. Filter and Sort for History Lane
    const historyRequests = requests
      .filter(r => {
        if (r.status !== 'completed' && r.status !== 'delivered_manual' && r.status !== 'refused') return false;
        if (!dateFilter) return true;
        if (!r.completedAt) return r.scheduledDate === dateFilter; // Fallback for legacy
        
        const completedDate = r.completedAt.toDate ? r.completedAt.toDate() : new Date(r.completedAt);
        const yyyymmdd = completedDate.toISOString().split('T')[0];
        return yyyymmdd === dateFilter;
      })
      .sort((a, b) => {
        const timeA = a.completedAt?.toMillis ? a.completedAt.toMillis() : new Date(a.completedAt || 0).getTime();
        const timeB = b.completedAt?.toMillis ? b.completedAt.toMillis() : new Date(b.completedAt || 0).getTime();
        return timeA - timeB; // Ascending order
      });

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-24">
        {/* OPERATIONAL LANES */}
        <div className="lg:col-span-8 flex flex-col gap-12">
          
          {/* Lane: Unassigned Queue */}
          <section className="space-y-6">
             <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-ork-text-muted rounded-full animate-pulse" />
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.4em] italic">Fila Não Atribuída</h3>
                  <span className="text-[10px] font-black text-ork-text-muted ml-2 opacity-50">{activeOperationalRequests.filter(r => r.status === 'pending').length} ITENS</span>
                </div>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
               {activeOperationalRequests.filter(r => r.status === 'pending').map(req => renderRequestCard(req))}
               {activeOperationalRequests.filter(r => r.status === 'pending').length === 0 && (
                 <div className="col-span-full py-20 border border-dashed border-ork-border rounded-[3rem] flex flex-col items-center justify-center text-ork-text-muted/30">
                   <p className="text-[10px] font-black uppercase tracking-[0.4em] italic leading-relaxed text-center">Nenhum agendamento para este dia</p>
                 </div>
               )}
             </div>
          </section>

          {/* Lane: Driver Dispatch Areas */}
          <div className="space-y-16">
            {/* Lane: Virtual Fleet (Terceirizados) */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-ork-accent rounded-full shadow-[0_0_10px_rgba(0,209,178,0.5)]" />
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.4em] italic">Frota Virtual (Pendente de Coleta)</h3>
                  <span className="text-[10px] font-black text-ork-text-muted ml-2 opacity-50">
                    {activeOperationalRequests.filter(r => {
                      const driver = drivers.find(d => d.id === r.assignedDriverId);
                      return r.status !== 'completed' && r.status !== 'delivered_manual' && driver?.isVirtual;
                    }).length} ITENS
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeOperationalRequests.filter(r => {
                  const driver = drivers.find(d => d.id === r.assignedDriverId);
                  return r.status !== 'completed' && r.status !== 'delivered_manual' && driver?.isVirtual;
                }).map(req => {
                  const driver = drivers.find(d => d.id === req.assignedDriverId);
                  return (
                    <div key={req.id} className="relative">
                      {renderRequestCard(req)}
                      <div className="absolute -top-1.5 -left-1.5 bg-ork-accent text-slate-950 px-1.5 py-0.5 rounded-md text-[6px] font-black uppercase tracking-widest z-20 shadow-lg">
                        {driver?.name?.split(' ')[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {activeLogs.map(log => {
              const driverId = log.ownerId || `legacy-${log.driverName}`;
              const driverTasks = activeOperationalRequests.filter(r => r.assignedDriverId === driverId && r.status !== 'completed' && r.status !== 'delivered_manual');
              
              return (
                <section key={log.id} className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-[2rem] border border-white/5">
                    <div className="flex items-center gap-5">
                       <img src={`https://ui-avatars.com/api/?name=${log.driverName}&background=7B5CFF&color=fff`} className="w-14 h-14 rounded-[1.2rem] border-2 border-ork-primary" />
                       <div>
                         <h3 className="text-base font-black text-white uppercase italic tracking-tight mb-0.5">{log.driverName}</h3>
                         <div className="flex items-center gap-3">
                           <span className="text-[9px] font-black text-ork-primary uppercase tracking-[0.2em]">{vehicles.find(v => v.id === log.vehicleId)?.plate}</span>
                           <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">{driverTasks.length} Paradas Pendentes</span>
                         </div>
                       </div>
                    </div>
                    <button 
                      onClick={async () => {
                        const url = generateGoogleMapsRoute(driverTasks);
                        if (url) window.open(url, '_blank');
                      }}
                      className="bg-ork-secondary text-slate-950 p-3 rounded-2xl transition-all shadow-lg active:scale-95"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 px-2">
                    {driverTasks.map((req, idx) => (
                      <div key={req.id} className="relative">
                         {renderRequestCard(req)}
                         <div className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-ork-bg border border-white/10 rounded-full flex items-center justify-center text-[7px] font-black text-white z-20 shadow-lg">
                           {idx + 1}
                         </div>
                      </div>
                    ))}
                    {driverTasks.length === 0 && (
                      <div className="col-span-full py-12 border border-dashed border-ork-border rounded-[2.5rem] flex flex-col items-center justify-center text-ork-text-muted/10 text-[9px] font-black uppercase tracking-[0.4em] italic">
                         Motorista Livre
                      </div>
                    )}
                  </div>
                </section>
              );
            })}

            {/* NEW Lane: Completed/History */}
            <section className="space-y-6 opacity-80 pt-8 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.4em] italic">Histórico de Coletas Finalizadas</h3>
                  <span className="text-[10px] font-black text-ork-text-muted ml-2 opacity-50 uppercase tracking-widest">Data: {dateFilter || 'HOJE'}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {historyRequests.map(req => renderRequestCard(req))}
                {historyRequests.length === 0 && (
                  <div className="col-span-full py-8 text-center text-[9px] font-black text-ork-text-muted/20 uppercase tracking-widest italic">
                    Nenhuma coleta finalizada nesta data
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* SIDEBAR: TELEMETRY & RADAR */}
        <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-8">
          <div className="bg-ork-surface border border-white/5 rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden group">
             <div className="flex items-center gap-4 mb-6">
                <div className="bg-ork-primary p-3 rounded-2xl">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] leading-none">Ponto de Retorno</h3>
                </div>
             </div>
             <textarea 
               placeholder="Endereço da Matriz..."
               className="w-full bg-ork-bg border border-white/10 rounded-2xl px-4 py-4 text-[10px] text-white focus:border-ork-primary/50 outline-none transition-all font-medium"
               value={hqInput}
               onChange={(e) => setHqInput(e.target.value)}
             />
             <button 
               onClick={handleSaveHeadquarter}
               className="mt-4 w-full py-3.5 bg-ork-primary text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg transition-all active:scale-95"
             >
               Confirmar Matriz
             </button>
          </div>

          <div className="bg-ork-bg border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl relative">
             <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Radar de Frota</h3>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">{activeLogs.length} Ativos</span>
                </div>
             </div>
             <div className="aspect-square bg-ork-surface/50 relative overflow-hidden">
                {API_KEY && (
                  <APIProvider apiKey={API_KEY}>
                    <Map
                      defaultCenter={{ lat: -23.5505, lng: -46.6333 }}
                      defaultZoom={11}
                      gestureHandling={'greedy'}
                      disableDefaultUI={true}
                      mapId={'RADAR_MAP'}
                      style={{ width: '100%', height: '100%' }}
                      colorScheme='DARK'
                    >
                      {/* 1. Render all collections (Tasks) for the current date or total monitoring */}
                      {requests
                        .filter(req => {
                          if (!req.lat || !req.lng) return false;
                          // If filtering for a specific driver is active, respect it
                          if (isolatedDriverId && req.assignedDriverId !== isolatedDriverId) return false;
                          // Optional: Filter by today's date if dateFilter exists
                          if (!dateFilter) return true;
                          return !req.scheduledDate || req.scheduledDate === dateFilter;
                        })
                        .map(task => {
                          const statusColor = 
                            task.status === 'pending' ? '#6B7280' :
                            (task.status === 'assigned' || task.status === 'accepted') ? '#FFB800' :
                            (task.status === 'completed' || task.status === 'delivered_manual') ? '#10B981' :
                            (task.status === 'refused') ? '#EF4444' : '#6B7280';

                          return (
                            <AdvancedMarker
                              key={`task-${task.id}`}
                              position={{ lat: task.lat!, lng: task.lng! }}
                            >
                              <div 
                                className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg transition-transform hover:scale-125 cursor-pointer"
                                style={{ backgroundColor: statusColor }}
                                title={`${task.title} - ${task.status}`}
                              />
                            </AdvancedMarker>
                          );
                        })
                      }

                      {/* 2. Vehicle Monitoring (Real-time position) */}
                      {activeLogs
                        .filter(log => {
                          const driverId = log.ownerId || `legacy-${log.driverName}`;
                          if (isolatedDriverId && driverId !== isolatedDriverId) return false;
                          return typeof log.currentLat === 'number';
                        })
                        .map((log) => (
                          <AdvancedMarker
                            key={`truck-${log.id}`}
                            position={{ lat: log.currentLat!, lng: log.currentLng! }}
                          >
                            <div className="relative flex items-center justify-center">
                              <div className="bg-ork-primary p-2 rounded-full border-2 border-white/20 shadow-[0_0_15px_rgba(123,92,255,0.5)]">
                                <Truck className="w-4 h-4 text-white" />
                              </div>
                              <div className="absolute -top-1.5 -right-1.5 bg-ork-surface border border-white/20 w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-[8px] font-black text-white">
                                  {log.driverName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </AdvancedMarker>
                        ))
                      }
                    </Map>
                    
                    {/* Map Legend Overlay */}
                    <div className="absolute top-4 left-4 bg-ork-bg/80 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-xl space-y-2 pointer-events-none">
                      <p className="text-[7px] font-black text-ork-text-muted uppercase tracking-[0.2em] mb-1">Legenda de Status</p>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#6B7280] border border-white/20" />
                        <span className="text-[8px] font-bold text-white uppercase tracking-widest">Pendente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#FFB800] border border-white/20" />
                        <span className="text-[8px] font-bold text-white uppercase tracking-widest">Atribuído/Aceito</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] border border-white/20" />
                        <span className="text-[8px] font-bold text-white uppercase tracking-widest">Coletado</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444] border border-white/20" />
                        <span className="text-[8px] font-bold text-white uppercase tracking-widest">Recusado</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                        <div className="bg-ork-primary p-1 rounded-full border border-white/20">
                          <Truck className="w-2 h-2 text-white" />
                        </div>
                        <span className="text-[8px] font-black text-ork-primary uppercase tracking-widest italic">Veículo em Tempo Real</span>
                      </div>
                    </div>
                  
                      {showRoutePlannerForDriver && (
                        <RoutePlanner 
                          selectedRequests={requests.filter(r => selectedRequestIds.has(r.id))}
                          driver={drivers.find(d => d.id === showRoutePlannerForDriver) || allUsers.find(u => u.uid === showRoutePlannerForDriver) as unknown as Driver}
                          globalSettings={globalSettings}
                          onClose={() => setShowRoutePlannerForDriver(null)}
                          onSuccess={() => {
                            setShowRoutePlannerForDriver(null);
                            setSelectedRequestIds(new Set());
                          }}
                        />
                      )}
                    </APIProvider>
                )}
             </div>

             {/* Dynamic Driver Selector */}
             <div className="p-4 bg-ork-surface/30 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                <p className="text-[8px] font-black text-ork-text-muted uppercase tracking-widest px-2 mb-3">Focar Motorista</p>
                {activeLogs.map((log, idx) => {
                  const driverId = log.ownerId || `legacy-${log.driverName}`;
                  const isIsolated = isolatedDriverId === driverId;
                  const color = FLEET_COLORS[idx % FLEET_COLORS.length];

                  return (
                    <button
                      key={log.id}
                      onClick={() => setIsolatedDriverId(isIsolated ? null : driverId)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-2xl transition-all border group",
                        isIsolated 
                          ? "bg-white/[0.05] border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                          : "bg-transparent border-transparent hover:bg-white/[0.02]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-xl border flex items-center justify-center text-[10px] font-black text-white"
                          style={{ borderColor: color, backgroundColor: `${color}20` }}
                        >
                          {log.driverName.charAt(0)}
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black text-white uppercase tracking-tight">{log.driverName}</p>
                          <p className="text-[8px] font-medium text-ork-text-muted uppercase tracking-widest group-hover:text-white/50 transition-colors">
                            {requests.filter(r => r.assignedDriverId === driverId).length} Paradas Ativas
                          </p>
                        </div>
                      </div>
                      {isIsolated && <div className="w-1.5 h-1.5 bg-ork-primary rounded-full shadow-[0_0_10px_rgba(123,92,255,1)]" />}
                    </button>
                  );
                })}
                {activeLogs.length === 0 && (
                  <p className="text-[9px] font-black text-ork-text-muted/30 uppercase text-center py-8 italic tracking-widest">Nenhuma atividade detectada</p>
                )}
             </div>
          </div>
        </div>
      </div>
    );
  }

  const publicLink = `${window.location.origin}${window.location.pathname}?public=true`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">Fluxo de Despacho</h2>
          <p className="text-ork-text-muted mt-1 uppercase tracking-widest text-[10px] font-bold opacity-60">Logística de Precisão Orkestria OS</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={async () => {
              const activeReqs = requests.filter(r => {
                const reqDate = r.scheduledDate || (r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt)).toISOString().split('T')[0];
                return reqDate === dateFilter;
              });
              const activeFleetLogs = logs.filter(l => {
                const logDate = l.startTime?.toDate ? l.startTime.toDate() : new Date(l.startTime);
                return logDate.toISOString().split('T')[0] === dateFilter;
              });
              const { generateDailyPDF } = await import('../lib/reportGenerator');
              generateDailyPDF(dateFilter, activeReqs, activeFleetLogs, drivers, user?.displayName || 'Administrador');
            }}
            className="bg-ork-primary/20 border border-ork-primary/30 hover:bg-ork-primary/30 text-ork-primary font-black px-6 py-4 rounded-2xl uppercase tracking-[0.2em] text-xs transition-all active:scale-95 flex items-center gap-2 group shadow-[0_0_20px_rgba(123,92,255,0.1)]"
          >
            <FileText className="w-4 h-4 text-ork-primary group-hover:scale-110 transition-transform" />
            PDF Relatório
          </button>
          <button 
            onClick={() => setShowShareModal(true)}
            className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black px-6 py-4 rounded-2xl uppercase tracking-[0.2em] text-xs transition-all active:scale-95 flex items-center gap-2 group"
          >
            <Share2 className="w-4 h-4 text-ork-primary group-hover:scale-110 transition-transform" />
            Compartilhar Link
          </button>
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-ork-primary hover:bg-ork-primary/90 text-white font-black px-8 py-4 rounded-2xl uppercase tracking-[0.2em] text-xs transition-all shadow-lg shadow-ork-primary/20 active:scale-95 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova Solicitação
          </button>
        </div>
      </div>

      {/* Control Station */}
      <div className="bg-ork-surface border border-white/5 rounded-[2.5rem] p-6 flex flex-wrap items-center gap-8 shadow-2xl relative z-40">
        <div className="absolute top-0 right-0 w-64 h-64 bg-ork-primary/5 rounded-full blur-[100px] pointer-events-none overflow-hidden" />
        
        <div className="flex flex-wrap items-center gap-8 w-full md:w-auto">
          <div className="flex items-center gap-4 border-r border-white/10 pr-8">
            <div className="bg-ork-bg p-3 rounded-2xl border border-white/10">
              <Send className="w-5 h-5 text-ork-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-ork-text-muted uppercase tracking-[0.2em]">Fila Global</span>
              <span className="text-lg font-black text-white italic">{requests.filter(r => r.status === 'pending').length} Pendentes</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-ork-text-muted uppercase tracking-[0.2em] mb-1">Filtrar por Data</span>
              <div className="flex items-center gap-2 bg-ork-bg border border-white/10 rounded-xl px-3 py-2">
                <Calendar className="w-3.5 h-3.5 text-ork-primary" />
                <input 
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-transparent border-none text-[10px] font-black text-white outline-none uppercase tracking-widest cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-4">
           <button 
             onClick={toggleSelectAll}
             className="text-[9px] font-black uppercase tracking-[0.2em] px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-ork-text-muted hover:text-white transition-all active:scale-95"
           >
             {selectedRequestIds.size === requests.filter(r => r.status === 'pending').length ? 'Limpar Seleção' : 'Selecionar Ativos'}
           </button>
           
           <AnimatePresence>
            {selectedRequestIds.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3"
              >
                <div className="w-px h-6 bg-white/10 mx-2" />
                <button 
                  onClick={handleIntelligentDistribution}
                  disabled={isOptimizing}
                  className="bg-ork-accent hover:bg-ork-accent/90 text-slate-950 text-[10px] font-black px-6 py-2.5 rounded-xl uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 shadow-xl shadow-ork-accent/10 active:scale-95"
                >
                  {isOptimizing ? (
                    <div className="w-3 h-3 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Analisar Agrupamentos (7h)
                </button>
                
                <div className="relative group/batch">
                  <button className="bg-ork-primary hover:bg-ork-primary/90 text-white text-[10px] font-black px-6 py-2.5 rounded-xl uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95">
                    Despachar para...
                  </button>
                  <div className="absolute left-0 lg:left-auto lg:right-0 top-full mt-2 w-72 bg-white border border-ork-border rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] opacity-0 invisible group-hover/batch:opacity-100 group-hover/batch:visible transition-all z-[60] p-3 animate-in fade-in slide-in-from-top-2">
                     <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                      {dispatchOptions.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => handleBatchAssign(opt.id)}
                          className="w-full text-left p-3 hover:bg-ork-bg rounded-xl transition-all flex items-center gap-3 group/btn"
                        >
                          <img src={`https://ui-avatars.com/api/?name=${opt.name}&background=7B5CFF&color=fff`} className="w-8 h-8 rounded-lg" />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black text-slate-900 group-hover/btn:text-ork-primary uppercase">{opt.name}</span>
                              {opt.isVirtual && <span className="bg-ork-accent/20 text-ork-accent text-[6px] font-black px-1 rounded uppercase">Virtual</span>}
                            </div>
                            <span className="text-[7px] font-bold text-slate-400 lowercase -mt-0.5">{opt.email}</span>
                            <span className="text-[8px] font-bold text-slate-400 border-t border-slate-100 mt-1 pt-1 uppercase">{opt.vehiclePlate || 'Terceirizado'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
           </AnimatePresence>
        </div>
      </div>
      
      {routeClusters.length > 0 && (
        <section className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-[0.4em] italic">Pré-visualização de Grupos Geográficos</h3>
            <button 
              onClick={() => setRouteClusters([])}
              className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline"
            >
              Cancelar Tudo
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {routeClusters.map((cluster) => {
              const totalMins = Math.round(cluster.totalEstimatedSeconds / 60);
              const hours = Math.floor(totalMins / 60);
              const mins = totalMins % 60;

              return (
                <div 
                  key={cluster.id} 
                  className={cn(
                    "rounded-[2rem] border-2 p-6 flex flex-col gap-4 shadow-xl transition-all",
                    cluster.color
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-white uppercase tracking-widest bg-white/10 px-2.5 py-1 rounded-full w-fit mb-2">
                        Grupo {cluster.id.slice(0, 4)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-white" />
                        <span className="text-base font-black text-white italic">
                          {hours > 0 ? `${hours}h ${mins}min` : `${mins}min`}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-white/60 uppercase mt-1">
                        {cluster.requests.length} Coletas Agrupadas
                      </span>
                    </div>
                    
                    <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/10">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  <div className="space-y-3 mt-2">
                    <label className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em]">Responsável pelo Despacho</label>
                    <select 
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-white/40 transition-all hover:bg-white/10"
                      value={cluster.selectedDriverId}
                      onChange={(e) => updateClusterDriver(cluster.id, e.target.value)}
                    >
                      <option value="" className="text-slate-900">Selecionar Motorista...</option>
                      {dispatchOptions.map(opt => (
                        <option 
                          key={opt.id} 
                          value={opt.id}
                          className="text-slate-900"
                        >
                          {opt.isVirtual ? '[VIRTUAL] ' : ''}{opt.name} {opt.email ? `(${ opt.email })` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 py-1">
                    {cluster.requests.map(req => (
                      <div key={req.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                          {req.priority === 'high' ? '!' : '#'}
                        </div>
                        <div className="truncate">
                          <p className="text-[10px] font-black text-white truncate uppercase">{req.title}</p>
                          <p className="text-[8px] text-white/60 truncate">{req.address}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => handleConfirmDispatch(cluster.id)}
                    disabled={!cluster.selectedDriverId}
                    className="mt-2 w-full py-3.5 bg-white text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100"
                  >
                    Confirmar Despacho
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {renderLanes()}

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 bg-ork-bg/80 backdrop-blur-md z-[70] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="ork-card w-full max-w-lg shadow-[0_0_100px_rgba(123,92,255,0.1)] my-auto max-h-[95vh] flex flex-col"
            >
              <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar">
                <h3 className="text-2xl font-bold text-white mb-1 tracking-tighter">{editingRequest ? 'Editar' : 'Registrar'} {formData.type === 'coleta' ? 'Coleta' : 'Entrega'}</h3>
                <p className="text-ork-text-muted text-[10px] font-bold uppercase tracking-widest mb-8">Informações da {editingRequest ? 'Parada' : 'Nova Parada'}</p>
                
                <form onSubmit={handleCreateRequest} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">O que vamos {formData.type === 'coleta' ? 'coletar' : 'entregar'}?</label>
                    <input 
                      required
                      placeholder="Ex: Coleta de Crachás - Getúlio Vargas"
                      className="w-full bg-ork-bg border border-ork-border rounded-2xl px-4 py-4 text-white focus:border-ork-primary/50 outline-none transition-all font-medium"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">Local da {formData.type === 'coleta' ? 'Coleta' : 'Entrega'}</label>
                    <textarea 
                      required
                      placeholder="Rua, Número, Bairro, Cidade..."
                      className="w-full bg-ork-bg border border-ork-border rounded-2xl px-4 py-4 text-white focus:border-ork-primary/50 outline-none transition-all font-medium min-h-[100px]"
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">Observações / Instruções Adicionais</label>
                    <textarea 
                      placeholder="Ex: Entrar pelo portão 2, falar com Sr. João..."
                      className="w-full bg-ork-bg border border-ork-border rounded-2xl px-4 py-4 text-white focus:border-ork-primary/50 outline-none transition-all font-medium min-h-[80px]"
                      value={formData.observations}
                      onChange={e => setFormData({...formData, observations: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">Data Agendada da {formData.type === 'coleta' ? 'Coleta' : 'Entrega'} (Opcional)</label>
                    <input 
                      type="date"
                      className="w-full bg-ork-bg border border-ork-border rounded-2xl px-4 py-4 text-white focus:border-ork-primary/50 outline-none transition-all font-medium"
                      value={formData.scheduledDate}
                      onChange={e => setFormData({...formData, scheduledDate: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">Tipo de Serviço</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['coleta', 'entrega'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFormData({...formData, type: t})}
                          className={cn(
                            "py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                            formData.type === t 
                              ? "bg-ork-primary/10 border-ork-primary text-ork-primary" 
                              : "bg-ork-bg border-ork-border text-ork-text-muted"
                          )}
                        >
                          {t === 'coleta' ? 'Coleta' : 'Entrega'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest px-1">Prioridade</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormData({...formData, priority: p})}
                          className={cn(
                            "py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                            formData.priority === p 
                              ? "bg-ork-primary/10 border-ork-primary text-ork-primary" 
                              : "bg-ork-bg border-ork-border text-ork-text-muted"
                          )}
                        >
                          {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={async () => {
                        setShowAddForm(false);
                        setEditingRequest(null);
                      }}
                      className="flex-1 py-4 text-ork-text-muted text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] ork-button-primary uppercase tracking-widest text-xs"
                    >
                      Enviar para Fila
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setConfirmDeleteId(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-ork-surface border border-ork-border p-8 rounded-[2.5rem] w-full max-w-sm relative overflow-hidden text-center z-10"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="text-red-500 w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-white uppercase italic mb-2">Excluir Coleta?</h3>
              <p className="text-ork-text-muted text-[10px] font-bold uppercase tracking-widest mb-8">Esta ação não pode ser desfeita e removerá o registro permanentemente.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteRequest(confirmDeleteId)}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowShareModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-ork-surface border border-ork-border p-8 rounded-[3rem] w-full max-w-lg relative overflow-hidden z-10"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-ork-primary/10 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none" />
              
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-ork-primary/20 rounded-2xl flex items-center justify-center">
                    <Share2 className="text-ork-primary w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic leading-none">Compartilhar Link</h3>
                    <p className="text-ork-text-muted text-[10px] font-bold uppercase tracking-widest mt-1">Cadastro Externo de Coletas</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-white/50 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-ork-bg rounded-[2rem] border border-white/5">
                  <p className="text-sm font-medium text-white/70 leading-relaxed mb-6">
                    Envie este link para seus clientes ou parceiros. As coletas cadastradas através dele aparecerão instantaneamente na sua lista de pendentes.
                  </p>
                  
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-ork-primary">
                      <Link size={16} />
                    </div>
                    <input 
                      readOnly
                      value={publicLink}
                      className="w-full bg-ork-surface border border-white/10 rounded-xl py-4 pl-12 pr-4 text-xs font-mono text-ork-primary outline-none"
                    />
                  </div>
                </div>

                <button 
                  onClick={copyToClipboard}
                  className={cn(
                    "w-full py-5 rounded-2xl font-black uppercase tracking-[0.3em] italic text-xs transition-all flex items-center justify-center gap-3",
                    copiedLink 
                      ? "bg-emerald-500 text-white" 
                      : "bg-ork-primary text-white shadow-xl shadow-ork-primary/20 hover:-translate-y-1"
                  )}
                >
                  {copiedLink ? (
                    <>
                      <Check size={18} />
                      Copiado com Sucesso!
                    </>
                  ) : (
                    <>
                      <ClipboardList size={18} />
                      Copiar Link de Cadastro
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
