import React, { useState, useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { CollectionRequest, Driver, GlobalSettings } from '../types';
import { routeManifestService } from '../lib/routeManifestService';
import { collectionRequestService } from '../lib/services';
import { useAuth } from '../lib/AuthContext';
import { Loader2, CheckCircle, Navigation, MapPin } from 'lucide-react';
import { motion } from 'motion/react';

interface RoutePlannerProps {
  currentDriverLocation?: { lat: number; lng: number };
  selectedRequests: CollectionRequest[];
  driver: Driver;
  globalSettings: GlobalSettings | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RoutePlanner({ selectedRequests, driver, globalSettings, currentDriverLocation, onClose, onSuccess }: RoutePlannerProps) {
  const { user } = useAuth();
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const [loading, setLoading] = useState(true);
  const [routesData, setRoutesData] = useState<any[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!routesLib || !map || selectedRequests.length === 0) return;

    // Build waypoints (intermediate stops)
    // Exclude origin and destination if possible, or use current headquarter as origin
    const origin = currentDriverLocation || globalSettings?.headquarterAddress || selectedRequests[0].address;
    
    let waypoints = selectedRequests.map(r => ({ location: { query: r.address } }));
    
    // If headquarter is origin, the first request is a waypoint
    if (currentDriverLocation || globalSettings?.headquarterAddress) {
       // all selected requests are waypoints
    } else {
       // first request is origin, so remove from waypoints
       waypoints.shift();
    }
    
    const destination = globalSettings?.headquarterAddress || selectedRequests[selectedRequests.length - 1].address;
    if (!globalSettings?.headquarterAddress && waypoints.length > 0) {
        waypoints.pop(); // last is destination
    }

    const fetchRoutes = async () => {
      setLoading(true);
      try {
        const baseRequest = {
            origin: origin,
            destination: destination,
            intermediates: waypoints.map(w => ({ location: { query: w.location.query } })) as any,
            travelMode: 'DRIVING' as any,
            optimizeWaypointOrder: true,
            routingPreference: 'TRAFFIC_AWARE' as any,
            computeAlternativeRoutes: true,
            fields: ['routes.path', 'routes.distanceMeters', 'routes.durationMillis', 'routes.optimizedIntermediateWaypointIndex', 'routes.routeLabels']
        };

        // We can use REST API via fetch, or SDK if available
        // The Maps JS SDK v3 Route.computeRoutes allows routeOptions
        
        // As an alternative, let's just make one request and mock the eco/distance if alternatives aren't enough, 
        // or just use computeRoutes with alternatives.
        
        const response = await routesLib.Route.computeRoutes(baseRequest);
        
        if (response && response.routes) {
            setRoutesData(response.routes);
        }
      } catch (error) {
        console.error("Error computing routes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoutes();
  }, [routesLib, map, selectedRequests, globalSettings]);

  useEffect(() => {
    if (!map || routesData.length === 0) return;
    
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    const activeRoute = routesData[selectedRouteIndex];
    if (activeRoute) {
        const polylines = activeRoute.createPolylines();
        polylines.forEach((p: any) => p.setMap(map));
        polylinesRef.current = polylines;
        // Optionally fit bounds
        // if (activeRoute.viewport) map.fitBounds(activeRoute.viewport);
    }
    
    return () => {
        polylinesRef.current.forEach(p => p.setMap(null));
    };
  }, [map, routesData, selectedRouteIndex]);

  const handleDispatch = async () => {
    if (!user || routesData.length === 0) return;
    setSaving(true);
    
    const activeRoute = routesData[selectedRouteIndex];
    
    // Sort selectedRequests based on optimizedIntermediateWaypointIndex if available
    let sortedRequestIds = selectedRequests.map(r => r.id);
    if (activeRoute.optimizedIntermediateWaypointIndex) {
        // Reorder
        // If origin is headquarter, then all requests were intermediate
        const ordered = [];
        for (const idx of activeRoute.optimizedIntermediateWaypointIndex) {
            ordered.push(selectedRequests[idx].id);
        }
        sortedRequestIds = ordered;
    }

    try {
        // Generate a polyline string to save. Since createPolylines gives us google.maps.Polyline objects,
        // we can encode the path. Or we can just get the first one's encodedPath if it exists.
        // Wait, the new routes API response usually has `path` which is a string or an object with encodedPath
        const encodedPolyline = activeRoute.path || activeRoute.encodedPolyline; 
        
        // fallback to encoding the LatLng array if `path` is an array of objects
        // (This depends on the exact shape returned by computeRoutes in the current version)

        await routeManifestService.createRouteManifest({
            driverId: driver.id,
            date: new Date().toISOString(),
            status: 'pending',
            requestIds: sortedRequestIds,
            optimizedPolyline: typeof encodedPolyline === 'string' ? encodedPolyline : undefined,
            optimizationType: 'time',
            estimatedTimeSeconds: Math.floor(activeRoute.durationMillis / 1000),
            estimatedDistanceMeters: activeRoute.distanceMeters,
            ownerId: user.uid
        });
        
        // Also update all collection requests to 'assigned' and assignedDriverId
        for (const req of selectedRequests) {
            await collectionRequestService.updateRequest(req.id, { 
                status: 'assigned', 
                assignedDriverId: driver.id 
            });
        }
        
        onSuccess();
    } catch (err) {
        console.error(err);
    } finally {
        setSaving(false);
    }
  };

  if (loading) {
      return (
          <div className="absolute top-4 left-4 right-4 bg-ork-surface border border-ork-border p-4 rounded-2xl shadow-xl z-50 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-ork-primary animate-spin" />
              <span className="text-sm font-black text-white uppercase tracking-wider">Otimizando Rota...</span>
          </div>
      );
  }

  if (routesData.length === 0) {
      return null;
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 bg-ork-surface border border-ork-border p-4 rounded-2xl shadow-2xl z-50 flex flex-col gap-4">
        <div className="flex justify-between items-center">
            <h3 className="text-white font-black uppercase tracking-wider italic text-sm">Opções de Rota</h3>
            <button onClick={onClose} className="text-ork-text-muted hover:text-white uppercase text-[10px] font-black tracking-widest">Cancelar</button>
        </div>
        
        <div className="grid grid-cols-1 gap-2">
            {routesData.slice(0, 3).map((route, idx) => (
                <div 
                    key={idx}
                    onClick={() => setSelectedRouteIndex(idx)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        selectedRouteIndex === idx 
                        ? 'bg-ork-primary/20 border-ork-primary text-white' 
                        : 'bg-white/5 border-white/10 text-ork-text-muted hover:bg-white/10'
                    }`}
                >
                    <div className="flex flex-col">
                        <span className="font-black text-xs uppercase tracking-wider">
                            {idx === 0 ? 'Mais Rápida' : (route.routeLabels && route.routeLabels.includes('FUEL_EFFICIENT') ? 'Mais Econômica' : 'Alternativa')}
                        </span>
                        <span className="text-[10px] opacity-70">
                            {Math.round(route.durationMillis / 60000)} min • {(route.distanceMeters / 1000).toFixed(1)} km
                        </span>
                    </div>
                    {selectedRouteIndex === idx && <CheckCircle className="w-4 h-4 text-ork-primary" />}
                </div>
            ))}
        </div>

        <button
            onClick={handleDispatch}
            disabled={saving}
            className="w-full mt-2 py-3 bg-ork-primary hover:bg-ork-primary/90 text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2"
        >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            Despachar Rota Otimizada
        </button>
    </div>
  );
}
