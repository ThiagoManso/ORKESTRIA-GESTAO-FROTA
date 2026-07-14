import React, { useState, useEffect } from 'react';
import { Settings, Save, MapPin, Building, Loader2, AlertCircle } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function SettingsPage() {
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isManual, setIsManual] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error' | 'api_error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const geocodingLib = useMapsLibrary('geocoding');

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, 'settings', 'matriz');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAddress(data.address || '');
        setLat(data.lat?.toString() || '');
        setLng(data.lng?.toString() || '');
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-2">
          <Settings className="text-slate-500" size={24} /> Configurações
        </h1>
        <p className="text-slate-500 text-sm sm:text-base">Gerencie as configurações do sistema e locais importantes.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden max-w-2xl">
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
    </div>
  );
}
