import React, { useState, useEffect } from 'react';
import { useCollection } from '../lib/useCollection';
import { RouteItem } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface FleetAvailabilityPanelProps {
  targetDateStr: string; // Expected format: 'DD/MM/YYYY'
}

export default function FleetAvailabilityPanel({ targetDateStr }: FleetAvailabilityPanelProps) {
  const { data: routes } = useCollection<RouteItem>('routes');
  const { data: drivers } = useCollection<any>('drivers');
  const [workdayTotalMinutes, setWorkdayTotalMinutes] = useState<number>(528); // Default 8h 48m

  useEffect(() => {
    const fetchWorkdaySettings = async () => {
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
    fetchWorkdaySettings();
  }, []);

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

  if (activeDriversStatus.length === 0) return null;

  const totalFleetMinutes = activeDriversStatus.length * workdayTotalMinutes;
  const totalUsedMinutes = activeDriversStatus.reduce((sum, d) => sum + d.usedMinutes, 0);
  const totalFleetPercent = totalFleetMinutes > 0 ? Math.min(100, Math.max(0, (totalUsedMinutes / totalFleetMinutes) * 100)) : 0;
  
  let totalColorClass = 'bg-emerald-500';
  if (totalFleetPercent > 90) totalColorClass = 'bg-red-500';
  else if (totalFleetPercent > 75) totalColorClass = 'bg-amber-500';
  else if (totalFleetPercent > 50) totalColorClass = 'bg-blue-500';

  const totalMinutesLeft = totalFleetMinutes - totalUsedMinutes;
  const totalFormattedLeft = `${Math.floor(totalMinutesLeft / 60)}h ${totalMinutesLeft % 60}m`;
  
  const isToday = targetDateStr === new Date().toLocaleDateString('pt-BR');

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wider">
        Disponibilidade da Frota ({isToday ? 'Hoje' : targetDateStr})
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
  );
}
