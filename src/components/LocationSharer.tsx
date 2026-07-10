import React, { useState, useEffect } from 'react';
import { logService, userService } from '../lib/services';
import { cn } from '../lib/utils';
import { MapPin, MapPinOff, AlertTriangle } from 'lucide-react';

export function LocationSharer({ userId, logId, compact = false }: { userId: string, logId?: string, compact?: boolean }) {
  const STORAGE_KEY = `gps_tracking_${userId}`;
  const TRACKING_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

  const [isSharing, setIsSharing] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    const { timestamp } = JSON.parse(saved);
    const now = Date.now();
    return now - timestamp < TRACKING_DURATION_MS;
  });

  const [error, setError] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState<string>('');

  useEffect(() => {
    if (!isSharing) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Save tracking start if not already exists or refresh it
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }));
    }

    const interval = setInterval(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { timestamp } = JSON.parse(saved);
        const elapsed = Date.now() - timestamp;
        if (elapsed >= TRACKING_DURATION_MS) {
          setIsSharing(false);
          localStorage.removeItem(STORAGE_KEY);
        } else {
          const remaining = TRACKING_DURATION_MS - elapsed;
          const hours = Math.floor(remaining / (1000 * 60 * 60));
          const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          setRemainingTime(`${hours}h ${mins}m`);
        }
      }
    }, 60000); // Update remaining time every minute

    return () => clearInterval(interval);
  }, [isSharing]);

  useEffect(() => {
    if (!isSharing) return;

    if (!navigator.geolocation) {
      setError('GPS não suportado');
      setIsSharing(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        // Global User update
        userService.updateLocation(userId, latitude, longitude, speed);
        // Specific Log update if exists
        if (logId) {
          logService.updateLocation(logId, latitude, longitude, speed);
        }
        setError(null);
      },
      (err) => {
        console.error(err);
        setError('Erro no GPS: Verifique as permissões do navegador');
        setIsSharing(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isSharing, userId, logId]);

  const toggleSharing = () => {
    if (!isSharing) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }));
      setIsSharing(true);
    } else {
      setIsSharing(false);
    }
  };

  if (compact) {
    return (
      <button 
        type="button"
        onClick={toggleSharing}
        className={cn(
          "p-2 rounded-xl border transition-all flex items-center justify-center relative",
          isSharing 
            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
            : "bg-white/5 text-ork-text-muted border-white/5 hover:text-white"
        )}
        title={isSharing ? `Rastreamento Ativado (${remainingTime})` : "Ativar Rastreamento"}
      >
        {isSharing ? <MapPin className="w-5 h-5" /> : <MapPinOff className="w-5 h-5" />}
        {error && <AlertTriangle className="absolute -top-1 -right-1 w-3 h-3 text-red-500" />}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <button 
        type="button"
        onClick={toggleSharing}
        className={cn(
          "w-full px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between",
          isSharing 
            ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20" 
            : "bg-white/5 text-ork-text-muted border border-white/10 hover:text-white"
        )}
      >
        <div className="flex items-center gap-3">
          {isSharing ? (
            <div className="relative">
              <MapPin className="w-4 h-4" />
              <span className="absolute inset-0 bg-slate-950 scale-150 rounded-full animate-ping opacity-20" />
            </div>
          ) : (
            <MapPinOff className="w-4 h-4" />
          )}
          <div className="flex flex-col items-start">
            <span className="leading-none">{isSharing ? 'Transmissão GPS Ativa' : 'Transmissão Desligada'}</span>
            {isSharing && remainingTime && (
              <span className="text-[7px] opacity-60 mt-0.5 tracking-normal lowercase italic">Expira em {remainingTime}</span>
            )}
          </div>
        </div>
        <div className={cn(
          "w-2 h-2 rounded-full",
          isSharing ? "bg-slate-950 animate-pulse" : "bg-white/20"
        )} />
      </button>

      {error ? (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          <p className="text-[9px] font-bold text-red-400 uppercase tracking-tight leading-none">{error}</p>
        </div>
      ) : isSharing && (
        <p className="text-[8px] font-bold text-ork-text-muted uppercase tracking-[0.2em] text-center">
          Sua localização será transmitida por 8h, mesmo com a tela bloqueada
        </p>
      )}
    </div>
  );
}
