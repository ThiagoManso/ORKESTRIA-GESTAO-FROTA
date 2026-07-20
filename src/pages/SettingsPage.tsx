import React, { useState, useEffect } from 'react';
import { Settings, Save, MapPin, Building, Loader2, AlertCircle, Clock } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function SettingsPage() {
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isManual, setIsManual] = useState(false);
  
  // Routing settings
  const [stopTimeMinutes, setStopTimeMinutes] = useState('30');
  const [isSavingRouting, setIsSavingRouting] = useState(false);
  const [saveRoutingStatus, setSaveRoutingStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Workday settings
  const [workdayStart, setWorkdayStart] = useState('08:00');
  const [workdayEnd, setWorkdayEnd] = useState('17:48');
  const [lunchMinutes, setLunchMinutes] = useState('60');
  const [isSavingWorkday, setIsSavingWorkday] = useState(false);
  const [saveWorkdayStatus, setSaveWorkdayStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error' | 'api_error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const geocodingLib = useMapsLibrary('geocoding');

  useEffect(() => {
    const fetchSettings = async () => {
      // Matriz
      const docRef = doc(db, 'settings', 'matriz');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAddress(data.address || '');
        setLat(data.lat?.toString() || '');
        setLng(data.lng?.toString() || '');
      }
      
      // Routing
      const routingRef = doc(db, 'settings', 'routing');
      const routingSnap = await getDoc(routingRef);
      if (routingSnap.exists()) {
        const rData = routingSnap.data();
        if (rData.stopTimeMinutes !== undefined) {
          setStopTimeMinutes(rData.stopTimeMinutes.toString());
        }
      }

      // Workday
      const workdayRef = doc(db, 'settings', 'workday');
      const workdaySnap = await getDoc(workdayRef);
      if (workdaySnap.exists()) {
        const wData = workdaySnap.data();
        if (wData.start) setWorkdayStart(wData.start);
        if (wData.end) setWorkdayEnd(wData.end);
        if (wData.lunchMinutes !== undefined) setLunchMinutes(wData.lunchMinutes.toString());
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    if (isManual) {
      // Manual save
      if (!lat || !lng) {
        setSaveStatus('error');
        setErrorMessage('Preencha latitude e longitude.');
        setIsSaving(false);
        return;
      }
      const location = {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        address: address || 'Matriz (Coordenadas Manuais)',
        name: 'Matriz'
      };
      await setDoc(doc(db, 'settings', 'matriz'), location);
      setSaveStatus('success');
      setIsSaving(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
      return;
    }

    if (!address.trim()) {
       setIsSaving(false);
       return;
    }

    if (!geocodingLib) {
      setSaveStatus('error');
      setErrorMessage('Biblioteca do Google Maps não carregada.');
      setIsSaving(false);
      return;
    }

    try {
      const geocoder = new geocodingLib.Geocoder();
      const response = await geocoder.geocode({ address: address });
      
      if (response.results && response.results.length > 0) {
        const result = response.results[0];
        const location = {
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
          address: result.formatted_address,
          name: 'Matriz'
        };
        
        await setDoc(doc(db, 'settings', 'matriz'), location);
        setAddress(result.formatted_address);
        setLat(location.lat.toString());
        setLng(location.lng.toString());
        setSaveStatus('success');
      } else {
        setSaveStatus('error');
        setErrorMessage('Endereço não encontrado.');
      }
    } catch (error: any) {
      if (error?.code === 'REQUEST_DENIED' || error?.message?.includes('API key is not authorized') || error?.message?.includes('REQUEST_DENIED')) {
        setSaveStatus('api_error');
        setErrorMessage('A API de Geocoding não está ativada no seu Google Cloud Console, ou a chave de API não tem permissão. Você pode ativar a API ou usar as coordenadas manuais.');
      } else {
        setSaveStatus('error');
        setErrorMessage('Erro ao localizar o endereço.');
      }
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        if (saveStatus !== 'api_error') {
          setSaveStatus('idle');
        }
      }, 5000);
    }
  };

  const handleSaveRouting = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRouting(true);
    setSaveRoutingStatus('idle');
    try {
      await setDoc(doc(db, 'settings', 'routing'), {
        stopTimeMinutes: Number(stopTimeMinutes) || 0
      });
      setSaveRoutingStatus('success');
    } catch (err) {
      console.error(err);
      setSaveRoutingStatus('error');
    } finally {
      setIsSavingRouting(false);
      setTimeout(() => setSaveRoutingStatus('idle'), 3000);
    }
  };

  const handleSaveWorkday = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWorkday(true);
    setSaveWorkdayStatus('idle');
    try {
      await setDoc(doc(db, 'settings', 'workday'), {
        start: workdayStart,
        end: workdayEnd,
        lunchMinutes: Number(lunchMinutes) || 0
      });
      setSaveWorkdayStatus('success');
    } catch (err) {
      console.error(err);
      setSaveWorkdayStatus('error');
    } finally {
      setIsSavingWorkday(false);
      setTimeout(() => setSaveWorkdayStatus('idle'), 3000);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto custom-scrollbar">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-2">
          <Settings className="text-slate-500" size={24} /> Configurações
        </h1>
        <p className="text-slate-500 text-sm sm:text-base">Gerencie as configurações do sistema e locais importantes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
            <div className="bg-primary/10 text-primary p-2 rounded-lg">
              <Building size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Localização da Matriz</h2>
          </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <p className="text-sm text-slate-600">
            Cadastre o endereço da Matriz (Industrial Complex). Este local aparecerá em destaque no Mapa de Operação.
          </p>

          {saveStatus === 'api_error' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-amber-800 text-sm">
              <AlertCircle className="flex-shrink-0" size={20} />
              <div>
                <p className="font-semibold mb-1">Geocoding API não ativada</p>
                <p>{errorMessage}</p>
                <button 
                  type="button"
                  onClick={() => setIsManual(true)}
                  className="mt-3 font-semibold underline hover:text-amber-900"
                >
                  Usar entrada manual de coordenadas
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 mb-4">
            <button
              type="button"
              onClick={() => setIsManual(false)}
              className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${!isManual ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Busca por Endereço
            </button>
            <button
              type="button"
              onClick={() => setIsManual(true)}
              className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${isManual ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Coordenadas Manuais
            </button>
          </div>

          {!isManual ? (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Endereço Completo</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                  placeholder="Rua, Número, Bairro, Cidade - Estado"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome / Endereço de Referência</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                    placeholder="Ex: Matriz São Paulo"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Latitude <span className="text-red-500">*</span></label>
                  <input 
                    type="number"
                    step="any" 
                    required
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                    placeholder="Ex: -23.5505"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Longitude <span className="text-red-500">*</span></label>
                  <input 
                    type="number"
                    step="any"
                    required
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                    placeholder="Ex: -46.6333"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="text-sm font-medium max-w-[200px] sm:max-w-xs">
              {saveStatus === 'success' && <span className="text-emerald-600">Localização salva com sucesso!</span>}
              {saveStatus === 'error' && <span className="text-red-600">{errorMessage}</span>}
            </div>
            
            <button 
              type="submit"
              disabled={isSaving || (!isManual && !address.trim()) || (isManual && (!lat || !lng))}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar Matriz
            </button>
          </div>
        </form>
        </div>

        {/* Routing Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
            <div className="bg-brand-cyan/10 text-brand-cyan p-2 rounded-lg">
              <Clock size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Tempo de Parada</h2>
          </div>
          
          <form onSubmit={handleSaveRouting} className="p-6 space-y-6">
            <p className="text-sm text-slate-600">
              Defina o tempo médio (em minutos) que o motorista leva em cada parada (descarregamento / entrega). 
              Este tempo será adicionado automaticamente à duração total das rotas no momento da roteirização.
            </p>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tempo Médio por Parada (minutos) <span className="text-red-500">*</span></label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={stopTimeMinutes}
                  onChange={(e) => setStopTimeMinutes(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan shadow-sm transition-all"
                  placeholder="Ex: 30"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="text-sm font-medium">
                {saveRoutingStatus === 'success' && <span className="text-emerald-600">Configuração salva!</span>}
                {saveRoutingStatus === 'error' && <span className="text-red-600">Erro ao salvar.</span>}
              </div>
              
              <button 
                type="submit"
                disabled={isSavingRouting}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
              >
                {isSavingRouting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar Tempo
              </button>
            </div>
          </form>
        </div>

        {/* Workday Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
            <div className="bg-amber-500/10 text-amber-600 p-2 rounded-lg">
              <Clock size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Jornada de Trabalho</h2>
          </div>
          
          <form onSubmit={handleSaveWorkday} className="p-6 space-y-6">
            <p className="text-sm text-slate-600">
              Defina o horário comercial padrão e o tempo de pausa. O sistema utilizará esses dados para calcular se o motorista tem tempo hábil para realizar as rotas do dia.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Início do Turno <span className="text-red-500">*</span></label>
                <input 
                  type="time"
                  required
                  value={workdayStart}
                  onChange={(e) => setWorkdayStart(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fim do Turno <span className="text-red-500">*</span></label>
                <input 
                  type="time"
                  required
                  value={workdayEnd}
                  onChange={(e) => setWorkdayEnd(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pausa / Almoço (minutos) <span className="text-red-500">*</span></label>
              <input 
                type="number"
                min="0"
                step="1"
                required
                value={lunchMinutes}
                onChange={(e) => setLunchMinutes(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm transition-all"
                placeholder="Ex: 60"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="text-sm font-medium">
                {saveWorkdayStatus === 'success' && <span className="text-emerald-600">Jornada salva!</span>}
                {saveWorkdayStatus === 'error' && <span className="text-red-600">Erro ao salvar.</span>}
              </div>
              
              <button 
                type="submit"
                disabled={isSavingWorkday}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
              >
                {isSavingWorkday ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar Jornada
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
