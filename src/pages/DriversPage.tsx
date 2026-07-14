import React, { useState } from 'react';
import { Search, Star, User, Truck, ShieldCheck, Map, X } from 'lucide-react';
import { useCollection } from '../lib/useCollection';
import { Vehicle } from '../types';

export default function DriversPage() {
  const { data: drivers, loading, add, update } = useCollection<any>('drivers');
  const { data: vehicles } = useCollection<Vehicle>('vehicles');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [newDriver, setNewDriver] = useState({
    name: '',
    cpf: '',
    cnh: '',
    phone: '',
    vehicleType: 'Carro',
    vehiclePlate: '',
    existingVehicleId: '',
  });
  const [isManualVehicle, setIsManualVehicle] = useState(false);

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let vehicleStr = '';
    if (isManualVehicle) {
      vehicleStr = `${newDriver.vehicleType} (${newDriver.vehiclePlate})`;
    } else {
      const selectedV = vehicles.find(v => v.id === newDriver.existingVehicleId);
      if (selectedV) {
        vehicleStr = `${selectedV.brand} ${selectedV.model} (${selectedV.plate})`;
      } else {
        vehicleStr = 'Veículo não informado';
      }
    }

    await add({
      name: newDriver.name,
      vehicle: vehicleStr,
      rating: 5.0,
      status: 'offline',
      completed: 0,
      cpf: newDriver.cpf,
      cnh: newDriver.cnh,
      phone: newDriver.phone,
    });
    
    setIsModalOpen(false);
    setNewDriver({
      name: '',
      cpf: '',
      cnh: '',
      phone: '',
      vehicleType: 'Carro',
      vehiclePlate: '',
      existingVehicleId: '',
    });
    setIsManualVehicle(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Entregadores</h1>
          <p className="text-slate-500 text-sm sm:text-base">Gerencie a nuvem de entregadores autônomos e frotas.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          Adicionar Entregador
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {[
          { label: 'Total Cadastrados', value: '250.000', trend: '+1.2%' },
          { label: 'Ativos Hoje', value: '2.450', trend: '+5%' },
          { label: 'Em Rota Agora', value: '482', trend: null },
          { label: 'Aguardando Aprovação', value: drivers.filter((d: any) => d.status === 'pending_approval').length.toString(), trend: null },
        ].map(stat => (
          <div key={stat.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="text-sm font-semibold text-slate-500 mb-1.5">{stat.label}</div>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-slate-800 tracking-tight">{stat.value}</span>
              {stat.trend && <span className="text-sm font-medium text-emerald-500 mb-1 bg-emerald-50 px-2 py-0.5 rounded">{stat.trend}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50">
          <div className="relative w-full max-w-lg">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome, placa ou CPF..." 
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 p-4 sm:p-6 overflow-y-auto">
          {drivers.map(driver => (
            <div key={driver.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 hover:shadow-md transition-all flex flex-col h-full group">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200 flex-shrink-0 group-hover:bg-primary/5 transition-colors">
                    <User size={24} className="group-hover:text-primary transition-colors"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">{driver.name}</h3>
                    <div className="flex items-center gap-1.5 text-sm text-amber-500 font-semibold mt-0.5">
                      <Star size={14} fill="currentColor" /> {driver.rating.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                 {driver.status === 'on_route' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-100">
                    <Map size={14} /> Em rota
                  </span>
                )}
                {driver.status === 'active' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-100">
                    Disponível
                  </span>
                )}
                {driver.status === 'offline' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200">
                    Offline
                  </span>
                )}
                {driver.status === 'pending_approval' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg border border-amber-100">
                    Aguardando Aprovação
                  </span>
                )}
              </div>
              
              <div className="space-y-2.5 text-sm text-slate-600 mb-6 flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5 font-medium">
                  <Truck size={16} className="text-slate-400 flex-shrink-0" /> 
                  <span className="truncate">{driver.vehicle}</span>
                </div>
                <div className="flex items-center gap-2.5 font-medium">
                  <ShieldCheck size={16} className="text-emerald-500 flex-shrink-0" /> CNH Validada
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center mt-auto">
                <div className="text-xs text-slate-500">
                  <span className="font-bold text-slate-800 text-sm">{driver.completed}</span> entregas
                </div>
                <button 
                  onClick={() => { setSelectedDriver(driver); setIsProfileModalOpen(true); }}
                  className="text-primary text-sm font-semibold hover:text-primary-hover px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  Ver Perfil
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Adicionar Entregador</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddDriver} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome Completo</label>
                  <input 
                    type="text" 
                    required
                    value={newDriver.name}
                    onChange={(e) => setNewDriver({...newDriver, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    placeholder="Ex: João da Silva"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">CPF</label>
                    <input 
                      type="text" 
                      required
                      value={newDriver.cpf}
                      onChange={(e) => setNewDriver({...newDriver, cpf: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telefone</label>
                    <input 
                      type="text" 
                      required
                      value={newDriver.phone}
                      onChange={(e) => setNewDriver({...newDriver, phone: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">CNH</label>
                  <input 
                    type="text" 
                    required
                    value={newDriver.cnh}
                    onChange={(e) => setNewDriver({...newDriver, cnh: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                    placeholder="Número da CNH"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-4 mb-4">
                    <button
                      type="button"
                      onClick={() => setIsManualVehicle(false)}
                      className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${!isManualVehicle ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Veículo Cadastrado
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsManualVehicle(true)}
                      className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${isManualVehicle ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Entrada Manual
                    </button>
                  </div>

                  {!isManualVehicle ? (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Selecionar Veículo</label>
                      <select
                        required
                        value={newDriver.existingVehicleId}
                        onChange={(e) => setNewDriver({...newDriver, existingVehicleId: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      >
                        <option value="">Selecione um veículo...</option>
                        {vehicles.filter(v => v.status === 'active').map(v => (
                          <option key={v.id} value={v.id}>
                            {v.plate} - {v.brand} {v.model}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tipo de Veículo</label>
                        <select 
                          value={newDriver.vehicleType}
                          onChange={(e) => setNewDriver({...newDriver, vehicleType: e.target.value})}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                        >
                          <option value="Carro">Carro</option>
                          <option value="Moto">Moto</option>
                          <option value="Van">Van</option>
                          <option value="Caminhão">Caminhão</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Placa do Veículo</label>
                        <input 
                          type="text" 
                          required={isManualVehicle}
                          value={newDriver.vehiclePlate}
                          onChange={(e) => setNewDriver({...newDriver, vehiclePlate: e.target.value})}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm uppercase"
                          placeholder="ABC-1234"
                        />
                      </div>
                    </div>
                  )}
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
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-blue)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
                >
                  Salvar Entregador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isProfileModalOpen && selectedDriver && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Perfil do Entregador</h2>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200 flex-shrink-0">
                  <User size={32} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-xl">{selectedDriver.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-sm text-amber-500 font-semibold">
                      <Star size={16} fill="currentColor" /> {selectedDriver.rating.toFixed(1)}
                    </div>
                    <span className="text-slate-300">•</span>
                    <span className="text-sm font-medium text-slate-600">{selectedDriver.completed} entregas</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3 text-slate-700">
                    <Truck size={18} className="text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Veículo cadastrado</div>
                      <div className="font-semibold">{selectedDriver.vehicle}</div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3 text-slate-700">
                    <ShieldCheck size={18} className={selectedDriver.status === 'pending_approval' ? 'text-amber-500' : 'text-emerald-500'} />
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Situação de Cadastro</div>
                      <div className={`font-semibold ${selectedDriver.status === 'pending_approval' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {selectedDriver.status === 'pending_approval' ? 'Em Análise' : 'Documentação Validada'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3 text-slate-700">
                    <Map size={18} className="text-blue-500" />
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Status Atual</div>
                      <div className="font-semibold">
                        {selectedDriver.status === 'on_route' && <span className="text-blue-600">Em rota de entrega</span>}
                        {selectedDriver.status === 'active' && <span className="text-emerald-600">Disponível para rotas</span>}
                        {selectedDriver.status === 'offline' && <span className="text-slate-600">Offline / Inativo</span>}
                        {selectedDriver.status === 'pending_approval' && <span className="text-amber-600">Aguardando Avaliação</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Fechar
                </button>
                {selectedDriver.status === 'pending_approval' ? (
                  <button 
                    onClick={async () => {
                      await update(selectedDriver.id, { status: 'offline' });
                      setIsProfileModalOpen(false);
                    }}
                    className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors shadow-sm"
                  >
                    Aprovar Cadastro
                  </button>
                ) : (
                  <button className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors shadow-sm">
                    Editar Cadastro
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
