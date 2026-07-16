import React, { useState, useEffect } from 'react';
import { useCollection } from '../lib/useCollection';
import { ExternalRequest } from '../types';
import { Package, MapPin, CheckCircle, Clock, Search, Trash2, Calendar, Upload, Download, Plus } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function RequestsPage() {
  const { data: requests, update, remove, loading } = useCollection<ExternalRequest>('external_requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'on_route' | 'completed'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const geocodingLibrary = useMapsLibrary('geocoding');

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
    
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;

    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
      const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : new Date(b.createdAt).getTime();
      return dateA - dateB; // Crescente
  });


  const downloadCSVTemplate = () => {
    const csvContent = "Tipo;Endereço;N° Pedido / OS;Nome;Telefone;Observação\nEx: entrega;Rua das Flores 123 - SP;1001;João Silva;11999999999;Entregar na portaria\nEx: coleta;Av Paulista 1000 - SP;OS-552;Maria Souza;11988888888;Retirar no galpão";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_demandas.csv');
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
            // Delay to avoid quota limits (google maps client side allows ~50 qps, 200ms is safe)
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
            scheduledDate: '',
            status: 'pending',
            read: true, // Mark as read since it's imported by admin
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

  const handleMarkConverted = async (id: string) => {
    await update(id, { status: 'on_route' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta solicitação?')) {
      await remove(id);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Banco de Demandas</h1>
          <p className="text-slate-500">Gerencie todas as paradas (Link Público, CSV, Manuual) pendentes para roteirização.</p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          {selectedIds.length > 0 && (
            <button 
              onClick={handleGenerateRoute}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm animate-in zoom-in"
            >
              <Plus size={18} /> Roteirizar ({selectedIds.length})
            </button>
          )}
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
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

        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50/50">
          {filteredRequests?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <Package size={48} className="text-slate-300" />
              <p className="text-lg font-medium text-slate-500">Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRequests?.map(request => (
                
                <div 
                  key={request.id} 
                  className={`rounded-xl border p-5 shadow-sm hover:shadow-md transition-all flex flex-col cursor-pointer ${selectedIds.includes(request.id) ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 bg-white'}`}
                  onClick={() => toggleSelection(request.id)}
                >

                  <div className="flex justify-between items-start mb-4">

                    <div className="flex items-center gap-2">
                      <div className="mr-2" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(request.id)} 
                          onChange={() => toggleSelection(request.id)}
                          className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </div>
                      <div className={`p-2 rounded-lg ${request.type === 'coleta' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>

                        {request.type === 'coleta' ? <Package size={20} /> : <MapPin size={20} />}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 capitalize">{request.type}</span>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar size={12} className="text-brand-cyan" />
                          <strong className="text-brand-cyan">{request.scheduledDate ? new Date(request.scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}</strong>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={10} />
                          {new Date(request.createdAt).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      request.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                      request.status === 'on_route' ? 'bg-blue-100 text-blue-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {request.status === 'pending' ? 'Pendente' : request.status === 'on_route' ? 'Em Rota' : 'Concluído'}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 text-sm">
                    <div>
                      <span className="text-slate-400 block text-xs">Endereço:</span>
                      <span className="font-medium text-slate-700">{request.address}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400 block text-xs">Nº Pedido/OS:</span>
                        <span className="font-medium text-slate-700">{request.orderNumber || request.osNumber || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-xs">Telefone:</span>
                        <span className="font-medium text-slate-700">{request.contactPhone || '-'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-xs">Solicitante:</span>
                      <span className="font-medium text-slate-700">{request.requesterName || '-'}</span>
                    </div>
                    {request.observations && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-slate-400 block text-xs">Observações:</span>
                        <span className="text-slate-600 italic">{request.observations}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex gap-2">
                    {request.status === 'pending' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleMarkConverted(request.id); }}
                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                        title="Marcar manualmente como resolvido"
                      >
                        <CheckCircle size={16} /> Resolvido
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(request.id); }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
