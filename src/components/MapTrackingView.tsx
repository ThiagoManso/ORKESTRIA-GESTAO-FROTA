/// <reference types="vite/client" />
import React from 'react';
import { APIProvider, Map, Marker, AdvancedMarker } from '@vis.gl/react-google-maps';
import { VehicleLog, Vehicle, CollectionRequest } from '../types';
import { MapPin, Navigation, AlertTriangle, CheckCircle2, Clock, Truck } from 'lucide-react';
import { cn } from '../lib/utils';

interface MapTrackingViewProps {
  logs: VehicleLog[];
  vehicles: Vehicle[];
  waypoints?: CollectionRequest[];
  allRequests?: CollectionRequest[];
  destination?: string | google.maps.LatLngLiteral;
  currentDriverLogId?: string | null;
  showLegend?: boolean;
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function MapTrackingView({ 
  logs, 
  vehicles, 
  waypoints = [], 
  allRequests = [], 
  destination, 
  currentDriverLogId,
  showLegend = false 
}: MapTrackingViewProps) {
  const activeTrackedLogs = logs.filter(l => l.status === 'active' && l.currentLat && l.currentLng);
  const currentDriverLog = logs.find(l => l.id === currentDriverLogId);
  const [apiError, setApiError] = React.useState<string | null>(null);

  if (!API_KEY || apiError) {
    return (
      <div className="h-[500px] w-full bg-slate-900 border border-slate-800 rounded-3xl flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-amber-500/10 p-4 rounded-full mb-4">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
        <h4 className="text-xl font-bold text-white mb-2">
          {apiError ? 'Erro Estrutural na API' : 'Google Maps Não Configurado'}
        </h4>
        <p className="text-slate-400 max-w-sm mb-6">
          {apiError 
            ? `Erro: ${apiError}. Isso geralmente significa que a API está desativada no seu console do Google Cloud.` 
            : 'Para ver o rastreamento em tempo real, insira sua chave da API do Google Maps nas configurações (VITE_GOOGLE_MAPS_API_KEY).'}
        </p>
        <div className="bg-white/5 p-6 rounded-3xl text-[10px] text-left max-w-lg space-y-4 border border-white/10 shadow-2xl">
          <div>
            <p className="font-black text-white uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Checklist de Correção
            </p>
            <div className="space-y-1 text-slate-400">
              <p>• Valide se <code className="text-ork-primary">VITE_GOOGLE_MAPS_API_KEY</code> está correta.</p>
              <p>• No <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener noreferrer" className="text-ork-primary hover:underline font-bold">Google Console &rarr; Credenciais</a>, verifique sua chave.</p>
              <p>• <span className="text-white font-bold">Restrição de Aplicativo:</span> Certifique-se de que a restrição está como <span className="text-amber-400 font-bold">"None"</span> ou <span className="text-amber-400 font-bold">"Websites"</span> (não use iOS/Android).</p>
              <p>• <span className="text-white font-bold">Restrição de API:</span> Garanta que a <span className="text-emerald-400 underline font-bold">Maps JavaScript API</span> está na lista de APIs permitidas.</p>
            </div>
          </div>
          
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 font-bold uppercase tracking-widest text-[9px]">Erro Detectado: {apiError?.includes('ApiTargetBlocked') ? 'ApiTargetBlockedMapError' : 'API Error'}</p>
            <p className="text-slate-500 mt-1">
              {apiError?.includes('ApiTargetBlocked') 
                ? 'Sua chave está configurada para outra plataforma (ex: Android/iOS). Mude para "Web" ou remova restrições de plataforma.'
                : 'Pode ser necessário ativar a API de Mapas JavaScript ou remover restrições de domínio temporariamente.'}
            </p>
          </div>
        </div>
        {apiError && (
          <button 
            onClick={() => setApiError(null)}
            className="mt-6 text-[10px] uppercase tracking-widest font-bold text-ork-primary hover:text-white transition-colors"
          >
            Tentar Novamente
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          {waypoints.length > 0 ? <Navigation className="w-5 h-5 text-ork-primary" /> : <Navigation className="w-5 h-5 text-emerald-400" />}
          {waypoints.length > 0 ? "Paradas Previstas" : `Mapa em Tempo Real (${activeTrackedLogs.length} veículos)`}
        </h3>
        {/* Route Stats removed to save API costs */}
      </div>
      
      <div className="h-[300px] lg:h-[500px] w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
        <APIProvider 
          apiKey={API_KEY} 
          onLoadError={(err) => {
            console.error("Google Maps API Load Error:", err);
            setApiError(err.message || 'Erro desconhecido');
          }}
        >
          <Map
            defaultCenter={{ lat: -23.5505, lng: -46.6333 }} // São Paulo default
            defaultZoom={11}
            gestureHandling={'greedy'}
            disableDefaultUI={false}
            mapId={'FLEET_TRACKING_MAP'}
            style={{ width: '100%', height: '100%' }}
            colorScheme='DARK'
          >
            {activeTrackedLogs.map((log) => {
              const vehicle = vehicles.find(v => v.id === log.vehicleId);
              const isCurrent = log.id === currentDriverLogId;
              const isMoving = log.currentSpeed && log.currentSpeed > 0.5;
              
              if (isCurrent && waypoints.length > 0) return null; 

              return (
                <AdvancedMarker
                  key={log.id}
                  position={{ lat: log.currentLat!, lng: log.currentLng! }}
                  title={`${vehicle?.plate || 'GPS'} - ${log.driverName} ${isMoving ? '(MOVENDO)' : '(PARADO)'}`}
                >
                  <div className="relative flex flex-col items-center group">
                    <div 
                      className="transition-transform duration-500 ease-out p-2 rounded-full bg-ork-primary border-2 border-white/20 shadow-[0_0_15px_rgba(123,92,255,0.5)]"
                      style={{ transform: `rotate(${log.currentHeading || 0}deg)` }}
                    >
                      {/* 2D Top-down view representation */}
                      <Truck className="w-5 h-5 text-white" />
                      
                      {/* Prepared for PNG/SVG Top-down image:
                      <img 
                        src="/path-to-truck-top-down.png" 
                        alt="Truck"
                        className="w-8 h-8 object-contain"
                      /> 
                      */}
                    </div>

                    {/* Label Overlay */}
                    <div className="absolute -bottom-8 bg-ork-bg/90 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      <p className="text-[7px] font-black text-white uppercase tracking-widest leading-none">
                        {vehicle?.plate || 'GPS'} • {log.driverName}
                      </p>
                    </div>

                    {/* Simple indicator dot for always-visible ID if moving */}
                    {isMoving && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-white/20 animate-pulse shadow-sm" />
                    )}
                  </div>
                </AdvancedMarker>
              );
            })}

            {/* All Requests Markers (Filtered by status/date and consolidated) */}
            {allRequests.filter(r => r.lat && r.lng).map(req => {
              const statusColor = 
                req.status === 'pending' ? '#6B7280' :
                (req.status === 'assigned' || req.status === 'accepted') ? '#FFB800' :
                (req.status === 'completed' || req.status === 'delivered_manual') ? '#10B981' :
                (req.status === 'refused') ? '#EF4444' : '#6B7280';
              
              // We show everything passed in allRequests. If it's already filtered by date, it works perfectly.
              return (
                <AdvancedMarker
                  key={req.id}
                  position={{ lat: req.lat!, lng: req.lng! }}
                >
                  <div 
                    className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg transition-transform hover:scale-125 cursor-pointer"
                    style={{ backgroundColor: statusColor }}
                    title={`${req.title} - ${req.status}`}
                  />
                </AdvancedMarker>
              );
            })}

            {/* Markers only, no dynamic route calculation to save API costs */}
            {waypoints.map(wp => {
              if (!wp.lat || !wp.lng) return null;
              return (
                <AdvancedMarker
                  key={`waypoint-${wp.id}`}
                  position={{ lat: wp.lat, lng: wp.lng }}
                >
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg bg-ork-primary" title={wp.title} />
                </AdvancedMarker>
              );
            })}
          </Map>

          {/* Map Legend Overlay */}
          {showLegend && (
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
          )}
        </APIProvider>
      </div>
    </div>
  );
}
