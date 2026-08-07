import React, { useState } from 'react';
import { Search, Truck, X, Settings, CheckCircle, CarFront, Camera, Upload, Trash2, Loader2 } from 'lucide-react';
import { Vehicle } from '../types';
import { useCollection } from '../lib/useCollection';
import { compressImageToDataUrl, ensureCompressedPhotos } from '../lib/utils';

export default function VehiclesPage() {
  const { data: vehicles, loading, add, update, remove } = useCollection<Vehicle>('vehicles');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingPosition, setUploadingPosition] = useState<'front' | 'back' | 'left' | 'right' | null>(null);

  const [newVehicle, setNewVehicle] = useState({
    plate: '',
    brand: '',
    model: '',
    color: '',
    year: new Date().getFullYear(),
    capacity: 0,
    type: 'car' as Vehicle['type'],
    initialKm: 0,
  });

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await add({
        plate: (newVehicle.plate || '').toUpperCase(),
        brand: newVehicle.brand || '',
        model: newVehicle.model || '',
        color: newVehicle.color || '',
        year: Number(newVehicle.year) || new Date().getFullYear(),
        capacity: Number(newVehicle.capacity) || 0,
        type: newVehicle.type || 'car',
        status: 'active',
        initialKm: Number(newVehicle.initialKm) || 0,
        referencePhotos: {},
      });
      
      setIsModalOpen(false);
      setNewVehicle({
        plate: '',
        brand: '',
        model: '',
        color: '',
        year: new Date().getFullYear(),
        capacity: 0,
        type: 'car',
        initialKm: 0,
      });
    } catch (error: any) {
      console.error('Erro ao adicionar veículo:', error);
      alert(`Não foi possível cadastrar o veículo: ${error?.message || 'Tente novamente.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadReferencePhoto = async (
    e: React.ChangeEvent<HTMLInputElement>,
    position: 'front' | 'back' | 'left' | 'right'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedVehicle) return;
    try {
      setUploadingPosition(position);
      const compressedDataUrl = await compressImageToDataUrl(file, 900, 0.75);
      setSelectedVehicle((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          referencePhotos: {
            ...prev.referencePhotos,
            [position]: compressedDataUrl,
          },
        };
      });
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
      alert('Não foi possível carregar a imagem. Tente novamente.');
    } finally {
      setUploadingPosition(null);
    }
  };

  const handleEditVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;
    
    setIsSaving(true);
    try {
      const compressedPhotos = await ensureCompressedPhotos(selectedVehicle.referencePhotos || {});

      await update(selectedVehicle.id, {
        plate: (selectedVehicle.plate || '').toUpperCase(),
        type: selectedVehicle.type || 'car',
        brand: selectedVehicle.brand || '',
        model: selectedVehicle.model || '',
        color: selectedVehicle.color || '',
        year: Number(selectedVehicle.year) || new Date().getFullYear(),
        capacity: Number(selectedVehicle.capacity) || 0,
        status: selectedVehicle.status || 'active',
        initialKm: Number(selectedVehicle.initialKm) || 0,
        referencePhotos: compressedPhotos,
        lastVisualInspectionDate: selectedVehicle.lastVisualInspectionDate || ''
      });
      setIsEditModalOpen(false);
      setSelectedVehicle(null);
    } catch (error: any) {
      console.error('Erro ao salvar veículo:', error);
      alert(`Não foi possível salvar as alterações do veículo: ${error?.message || 'Verifique sua conexão ou se a imagem é muito grande.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: Vehicle['status']) => {
    switch(status) {
      case 'active': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg"><CheckCircle size={14}/> Ativo</span>;
      case 'maintenance': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg"><Settings size={14}/> Manutenção</span>;
      case 'inactive': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg">Inativo</span>;
    }
  };

  const getTypeTranslation = (type: Vehicle['type']) => {
    switch(type) {
      case 'motorcycle': return 'Moto';
      case 'car': return 'Carro';
      case 'van': return 'Van';
      case 'truck': return 'Caminhão';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Veículos</h1>
          <p className="text-slate-500 text-sm sm:text-base">Gerencie o cadastro de veículos e suas especificações.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          Adicionar Veículo
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por placa ou modelo..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider font-semibold">
                <th className="px-6 py-4 font-semibold">Veículo</th>
                <th className="px-6 py-4 font-semibold">Placa</th>
                <th className="px-6 py-4 font-semibold">Capacidade</th>
                <th className="px-6 py-4 font-semibold">KM Inicial</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                        {vehicle.type === 'motorcycle' ? <CarFront size={18} /> : <Truck size={18} />}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{vehicle.brand} {vehicle.model}</div>
                        <div className="text-xs text-slate-500">{getTypeTranslation(vehicle.type)} • {vehicle.year}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded-md inline-block text-sm uppercase tracking-wider">
                      {vehicle.plate}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-600 font-medium">
                      {vehicle.capacity} kg
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-600 font-medium">
                      {vehicle.initialKm || 0} km
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(vehicle.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => {
                        setSelectedVehicle(vehicle);
                        setIsEditModalOpen(true);
                      }}
                      className="text-sm font-medium text-primary hover:text-primary-hover px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Novo Veículo</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddVehicle} className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Placa</label>
                    <input 
                      type="text" 
                      required
                      value={newVehicle.plate}
                      onChange={(e) => setNewVehicle({...newVehicle, plate: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm uppercase"
                      placeholder="ABC-1234"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tipo</label>
                    <select 
                      value={newVehicle.type}
                      onChange={(e) => setNewVehicle({...newVehicle, type: e.target.value as Vehicle['type']})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    >
                      <option value="motorcycle">Moto</option>
                      <option value="car">Carro</option>
                      <option value="van">Van</option>
                      <option value="truck">Caminhão</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Marca</label>
                    <input 
                      type="text" 
                      required
                      value={newVehicle.brand}
                      onChange={(e) => setNewVehicle({...newVehicle, brand: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="Ex: Fiat"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Modelo</label>
                    <input 
                      type="text" 
                      required
                      value={newVehicle.model}
                      onChange={(e) => setNewVehicle({...newVehicle, model: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="Ex: Fiorino"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cor (referência do Gabarito)</label>
                  <input 
                    type="text" 
                    value={newVehicle.color || ''}
                    onChange={(e) => setNewVehicle({...newVehicle, color: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    placeholder="Ex: Branco / Prata"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ano</label>
                    <input 
                      type="number" 
                      required
                      value={newVehicle.year}
                      onChange={(e) => setNewVehicle({...newVehicle, year: parseInt(e.target.value) || new Date().getFullYear()})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Capacidade (kg)</label>
                    <input 
                      type="number" 
                      required
                      value={newVehicle.capacity}
                      onChange={(e) => setNewVehicle({...newVehicle, capacity: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">KM Inicial (Atual)</label>
                  <input 
                    type="number" 
                    required
                    value={newVehicle.initialKm}
                    onChange={(e) => setNewVehicle({...newVehicle, initialKm: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    placeholder="Ex: 150000"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Veículo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedVehicle && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Editar Veículo</h2>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditVehicle} className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Placa</label>
                    <input 
                      type="text" 
                      required
                      value={selectedVehicle.plate}
                      onChange={(e) => setSelectedVehicle({...selectedVehicle, plate: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm uppercase"
                      placeholder="ABC-1234"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tipo</label>
                    <select 
                      value={selectedVehicle.type}
                      onChange={(e) => setSelectedVehicle({...selectedVehicle, type: e.target.value as Vehicle['type']})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    >
                      <option value="motorcycle">Moto</option>
                      <option value="car">Carro</option>
                      <option value="van">Van</option>
                      <option value="truck">Caminhão</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Marca</label>
                    <input 
                      type="text" 
                      required
                      value={selectedVehicle.brand}
                      onChange={(e) => setSelectedVehicle({...selectedVehicle, brand: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Modelo</label>
                    <input 
                      type="text" 
                      required
                      value={selectedVehicle.model}
                      onChange={(e) => setSelectedVehicle({...selectedVehicle, model: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cor (referência do Gabarito)</label>
                  <input 
                    type="text" 
                    value={selectedVehicle.color || ''}
                    onChange={(e) => setSelectedVehicle({...selectedVehicle, color: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    placeholder="Ex: Branco / Prata"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ano</label>
                    <input 
                      type="number" 
                      required
                      value={selectedVehicle.year}
                      onChange={(e) => setSelectedVehicle({...selectedVehicle, year: parseInt(e.target.value) || new Date().getFullYear()})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Capacidade (kg)</label>
                    <input 
                      type="number" 
                      required
                      value={selectedVehicle.capacity}
                      onChange={(e) => setSelectedVehicle({...selectedVehicle, capacity: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
                    <select 
                      value={selectedVehicle.status}
                      onChange={(e) => setSelectedVehicle({...selectedVehicle, status: e.target.value as Vehicle['status']})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    >
                      <option value="active">Ativo</option>
                      <option value="maintenance">Manutenção</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">KM Inicial (Atual)</label>
                  <input 
                    type="number" 
                    required
                    value={selectedVehicle.initialKm || 0}
                    onChange={(e) => setSelectedVehicle({...selectedVehicle, initialKm: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    placeholder="Ex: 150000"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <Camera size={16} className="text-brand-cyan" />
                    Fotos-Gabarito (Veículo Padrão Ideal para IA)
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Estas fotos servem como referência para a Inteligência Artificial avaliar a limpeza e detectar avarias nas vistorias de 3 em 3 dias.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(['front', 'back', 'left', 'right'] as const).map((pos) => {
                      const labels = {
                        front: 'Frente',
                        back: 'Traseira',
                        left: 'Lat. Esquerda',
                        right: 'Lat. Direita',
                      };
                      const photoUrl = selectedVehicle.referencePhotos?.[pos];
                      return (
                        <div key={pos} className="border border-slate-200 rounded-xl p-2 flex flex-col items-center justify-between text-center bg-slate-50 relative">
                          <span className="text-xs font-semibold text-slate-700 mb-1">{labels[pos]}</span>
                          {uploadingPosition === pos ? (
                            <div className="w-full h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center mb-2 bg-white">
                              <Loader2 size={18} className="text-brand-cyan animate-spin mb-1" />
                              <span className="text-[10px] text-slate-500 font-medium">Processando...</span>
                            </div>
                          ) : photoUrl ? (
                            <div className="relative w-full h-20 mb-2">
                              <img src={photoUrl} alt={labels[pos]} className="w-full h-full object-cover rounded-lg border border-slate-200" />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = { ...selectedVehicle.referencePhotos };
                                  delete updated[pos];
                                  setSelectedVehicle({ ...selectedVehicle, referencePhotos: updated });
                                }}
                                className="absolute top-1 right-1 bg-red-600/80 text-white p-1 rounded-full hover:bg-red-700 transition-colors"
                                title="Remover foto"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <label className="w-full h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors mb-2">
                              <Upload size={16} className="text-slate-400 mb-1" />
                              <span className="text-[10px] text-slate-500 font-medium">Enviar Foto</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleUploadReferencePhoto(e, pos)}
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSaving || uploadingPosition !== null}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
