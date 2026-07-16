import React, { useState, useEffect } from 'react';
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { useCollection } from '../lib/useCollection';
import { RouteItem, ExternalRequest } from '../types';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Building, Truck, MousePointer2, Plus } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function MapPage() {
  type FilterType = 'all' | 'unassigned' | 'assigned' | 'completed';
  const { data: routes } = useCollection<RouteItem>('routes');
  const { data: drivers } = useCollection<any>('drivers');
  const { data: externalRequests } = useCollection<ExternalRequest>('external_requests');
  const map = useMap('map_operation_view');
  const drawingLib = useMapsLibrary('drawing');
  const geometryLib = useMapsLibrary('geometry');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [drawingManager, setDrawingManager] = useState<any>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [matrizLocation, setMatrizLocation] = useState<{lat: number, lng: number, address: string} | null>(null);


  useEffect(() => {
    if (!map || !drawingLib || !geometryLib) return;

    if (isSelectionMode) {
      if (!drawingManager) {
        const manager = new drawingLib.DrawingManager({
          drawingMode: drawingLib.OverlayType.RECTANGLE,
          drawingControl: false,
          rectangleOptions: {
            fillColor: '#3b82f6',
            fillOpacity: 0.2,
            strokeWeight: 2,
            strokeColor: '#3b82f6',
            clickable: false,
            editable: false,
            zIndex: 1,
          },
        });
        
        manager.setMap(map);
        setDrawingManager(manager);

        google.maps.event.addListener(manager, 'overlaycomplete', (event: any) => {
          if (event.type === drawingLib.OverlayType.RECTANGLE) {
            const bounds = event.overlay.getBounds();
            
            // Find all pending external requests inside the bounds
            const selected = externalRequests.filter(req => {
              if (req.status === 'pending' && req.lat && req.lng) {
                const pt = new google.maps.LatLng(req.lat, req.lng);
                return bounds.contains(pt);
              }
              return false;
            });
            
            setSelectedRequestIds(prev => {
              const newIds = new Set(prev);
              selected.forEach(req => newIds.add(req.id));
              return Array.from(newIds);
            });
            
            // Remove the drawn rectangle after selection
            event.overlay.setMap(null);
          }
        });
      } else {
        drawingManager.setMap(map);
        drawingManager.setDrawingMode(drawingLib.OverlayType.RECTANGLE);
      }
    } else {
      if (drawingManager) {
        drawingManager.setMap(null);
      }
      setSelectedRequestIds([]);
    }
    
    return () => {
      if (drawingManager) drawingManager.setMap(null);
    };
  }, [map, drawingLib, geometryLib, isSelectionMode, externalRequests, drawingManager]);

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, 'settings', 'matriz');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.lat && data.lng) {
          setMatrizLocation({ lat: data.lat, lng: data.lng, address: data.address });
        }
      }
    };
    fetchSettings();
  }, []);


  const handleGenerateRoute = () => {
    localStorage.setItem('mapSelectedRequests', JSON.stringify(selectedRequestIds));
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('view', 'dashboard');
    // Using global event or just reload, but since App.tsx is root, we can trigger a state change 
    // or since this is a demo, doing a window.location change would reset states, 
    // Wait, the best way without props is to dispatch a custom event or click the sidebar link.
    // Let's use a custom event or simply click the routes link!
    const routesBtn = document.querySelector('button[title="Rotas"]') || document.querySelector('a[href="#routes"]');
    if (routesBtn) {
      (routesBtn as HTMLElement).click();
    } else {
      // Fallback if we cannot find the button
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'routes' }));
    }
  };

  const getRouteCategory = (route: RouteItem): 'unassigned' | 'assigned' | 'completed' => {
    if (route.status === 'completed') return 'completed';
    if (route.driver === 'Aguardando' || !route.driver) return 'unassigned';
    return 'assigned';
  };

  const filteredRoutes = routes.filter(route => filter === 'all' || getRouteCategory(route) === filter);

  const getMarkerColor = (route: RouteItem) => {
    if (route.status === 'completed') return '#10b981'; // Green
    if (route.driver === 'Aguardando' || !route.driver) return '#f59e0b'; // Yellow
    return '#3b82f6'; // Blue
  };

  const getStatusText = (route: RouteItem) => {
    if (route.status === 'completed') return 'Entregue / Coletado';
    if (route.driver === 'Aguardando' || !route.driver) return 'Pendente de Vinculação';
    return 'Vinculado, pendente de entrega';
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm z-10 relative">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mapa de Operação</h1>
          <p className="text-sm text-slate-500 mt-1">Visão em tempo real do status das rotas</p>
        </div>
        
        <div className="flex gap-2 items-center text-sm font-medium overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${isSelectionMode ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
          >
            <MousePointer2 size={16} />
            <span>Seleção (Arrastar)</span>
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>

          <button 
            onClick={() => { setFilter('all'); setSelectedRoute(null); setSelectedDriver(null); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${filter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => { setFilter('unassigned'); setSelectedRoute(null); setSelectedDriver(null); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${filter === 'unassigned' ? 'bg-[#f59e0b]/10 border-[#f59e0b] text-[#d97706]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></div>
            <span>Pendente de Vinculação</span>
          </button>
          <button 
            onClick={() => { setFilter('assigned'); setSelectedRoute(null); setSelectedDriver(null); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${filter === 'assigned' ? 'bg-[#3b82f6]/10 border-[#3b82f6] text-[#2563eb]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></div>
            <span>Vinculado (Pendente)</span>
          </button>
          <button 
            onClick={() => { setFilter('completed'); setSelectedRoute(null); setSelectedDriver(null); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${filter === 'completed' ? 'bg-[#10b981]/10 border-[#10b981] text-[#059669]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></div>
            <span>Entregue/Coletado</span>
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        <Map
          defaultZoom={11}
          defaultCenter={{ lat: -23.5505, lng: -46.6333 }}
          mapId="map_operation_view"
          disableDefaultUI={false}
          className="w-full h-full"
        >
          {matrizLocation && (
            <AdvancedMarker
              position={{ lat: matrizLocation.lat, lng: matrizLocation.lng }}
              title="Matriz (Industrial Complex)"
            >
              <div className="bg-slate-900 text-white p-2 rounded-xl shadow-lg border-2 border-white flex flex-col items-center">
                <Building size={20} />
                <span className="text-[10px] font-bold uppercase mt-1 tracking-wider">Matriz</span>
              </div>
            </AdvancedMarker>
          )}

          {/* External Requests (Pending) */}
          {(filter === 'all' || filter === 'unassigned') && externalRequests?.map((req) => {
            if (req.status !== 'pending' || !req.lat || !req.lng) return null;
            const isSelected = selectedRequestIds.includes(req.id);
            return (
              <AdvancedMarker
                key={`ext-${req.id}`}
                position={{ lat: req.lat, lng: req.lng }}
                onClick={() => {
                  if (isSelectionMode) {
                    setSelectedRequestIds(prev => prev.includes(req.id) ? prev.filter(id => id !== req.id) : [...prev, req.id]);
                  }
                }}
                zIndex={isSelected ? 100 : 10}
              >
                <div className={`transition-transform ${isSelected ? 'scale-125' : 'hover:scale-110'}`}>
                  <Pin background={isSelected ? '#2563eb' : '#f59e0b'} borderColor={isSelected ? '#1d4ed8' : '#d97706'} glyphColor="#fff" />
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold border border-white">✓</div>
                  )}
                </div>
              </AdvancedMarker>
            );
          })}

          {/* Route Stops */}
          {routes?.map(route => {
            if (route.status === 'completed' && filter !== 'all' && filter !== 'completed') return null;
            
            return route.stopDetails?.map(stop => {
               if (!stop.lat || !stop.lng) return null;
               
               let show = false;
               let color = '#3b82f6'; // blue default
               
               if (stop.status === 'completed' || route.status === 'completed') {
                 if (filter === 'all' || filter === 'completed') {
                    show = true;
                    color = '#10b981'; // green
                 }
               } else {
                 if (filter === 'all' || filter === 'assigned') {
                    show = true;
                    color = '#3b82f6'; // blue
                 }
               }

               if (!show) return null;
               
               return (
                 <AdvancedMarker
                   key={`stop-${route.id}-${stop.id}`}
                   position={{ lat: stop.lat, lng: stop.lng }}
                   zIndex={5}
                 >
                   <div className="hover:scale-110 transition-transform">
                     <Pin background={color} borderColor={color} glyphColor="#fff" />
                   </div>
                 </AdvancedMarker>
               );
            });
          })}

          {drivers?.filter((d: any) => (d.status === 'active' || d.status === 'on_route') && d.location?.lat && d.location?.lng).map((driver: any) => (
            <AdvancedMarker
              key={`driver-${driver.id}`}
              position={{ lat: driver.location.lat, lng: driver.location.lng }}
              onClick={() => { setSelectedDriver(driver); setSelectedRoute(null); }}
              zIndex={50} // Keep drivers on top
            >
              <div className="bg-brand-cyan text-white p-2 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)] border-2 border-white flex flex-col items-center">
                <Truck size={20} />
              </div>
            </AdvancedMarker>
          ))}
        </Map>

        {selectedRequestIds.length > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={handleGenerateRoute}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 transition-transform hover:scale-105"
            >
              <Plus size={20} />
              Gerar Rota ({selectedRequestIds.length})
            </button>
          </div>
        )}

        {selectedDriver && (
          <div className="absolute bottom-6 left-6 bg-white p-4 rounded-xl shadow-lg border border-slate-100 w-80">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-slate-900">{selectedDriver.name}</h3>
              <button 
                onClick={() => setSelectedDriver(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              <span className="font-semibold">Veículo:</span> {selectedDriver.vehicle}
            </p>
            <p className="text-sm text-slate-600 mb-1">
              <span className="font-semibold">Placa:</span> {selectedDriver.vehiclePlate}
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg w-full justify-center mt-2">
              {selectedDriver.status === 'on_route' ? 'Em Rota' : 'Online'}
            </div>
          </div>
        )}

        {selectedRoute && (
          <div className="absolute bottom-6 left-6 bg-white p-4 rounded-xl shadow-lg border border-slate-100 w-80">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-slate-900">Rota #{selectedRoute.id}</h3>
              <button 
                onClick={() => setSelectedRoute(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              <span className="font-semibold">Entregador:</span> {selectedRoute.driver}
            </p>
            <p className="text-sm text-slate-600 mb-1">
              <span className="font-semibold">Paradas:</span> {selectedRoute.stops}
            </p>
            <p className="text-sm text-slate-600 mb-3">
              <span className="font-semibold">Distância:</span> {selectedRoute.distance} km
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg w-full justify-center" style={{ backgroundColor: `${getMarkerColor(selectedRoute)}20`, color: getMarkerColor(selectedRoute) }}>
              {getStatusText(selectedRoute)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
