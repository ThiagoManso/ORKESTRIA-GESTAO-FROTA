import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SystemUser, ViewState } from '../types';
import { Check, X, Shield, Edit2, ShieldAlert, UserCheck, AlertCircle } from 'lucide-react';

interface UsersPageProps {
  currentUser: SystemUser;
}

const AVAILABLE_PERMISSIONS: { id: ViewState; label: string }[] = [
  { id: 'dashboard', label: 'Torre de Controle' },
  { id: 'routes', label: 'Rotas' },
  { id: 'requests', label: 'Banco de Demandas' },
  { id: 'map', label: 'Mapa de Operação' },
  { id: 'drivers', label: 'Entregadores' },
  { id: 'vehicles', label: 'Veículos' },
  { id: 'financial', label: 'Financeiro' },
  { id: 'issues', label: 'Acareação' },
  { id: 'my_requests', label: 'Meus Chamados (Usuário Interno)' },
  { id: 'users', label: 'Gestão de Usuários (Apenas Admin)' },
  { id: 'settings', label: 'Configurações' },
];

export default function UsersPage({ currentUser }: UsersPageProps) {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  useEffect(() => {
    if (currentUser.role !== 'admin') return;

    const q = query(collection(db, 'system_users'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: SystemUser[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as SystemUser);
      });
      setUsers(usersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleUpdateStatus = async (userId: string, newStatus: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'system_users', userId), { status: newStatus });
    } catch (error) {
      console.error("Erro ao atualizar status do usuário:", error);
      alert("Ocorreu um erro ao atualizar o usuário.");
    }
  };

  const handleUpdatePermissions = async (userId: string, newPermissions: ViewState[]) => {
    try {
      await updateDoc(doc(db, 'system_users', userId), { permissions: newPermissions });
      setEditingUser(null);
    } catch (error) {
      console.error("Erro ao atualizar permissões:", error);
      alert("Ocorreu um erro ao atualizar as permissões.");
    }
  };

  const togglePermission = (permId: ViewState) => {
    if (!editingUser) return;
    const current = editingUser.permissions || [];
    const updated = current.includes(permId)
      ? current.filter(p => p !== permId)
      : [...current, permId];
      
    setEditingUser({ ...editingUser, permissions: updated });
  };

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <ShieldAlert size={64} className="text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-slate-700">Acesso Negado</h2>
        <p className="mt-2">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestão de Usuários</h1>
          <p className="text-slate-500 mt-1">Aprove novos cadastros e configure as permissões de acesso.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Setor</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Perfil</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{user.name}</span>
                        <span className="text-sm text-slate-500">{user.email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {user.sector}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5">
                        {user.role === 'admin' ? (
                          <><Shield size={16} className="text-purple-500" /><span className="text-sm font-medium text-purple-700">Admin</span></>
                        ) : (
                          <><UserCheck size={16} className="text-blue-500" /><span className="text-sm font-medium text-blue-700">Interno</span></>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {user.status === 'pending_approval' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <AlertCircle size={14} /> Aguardando
                        </span>
                      )}
                      {user.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <Check size={14} /> Aprovado
                        </span>
                      )}
                      {user.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <X size={14} /> Negado
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.status === 'pending_approval' && (
                          <>
                            <button 
                              onClick={() => handleUpdateStatus(user.id, 'approved')}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors tooltip"
                              title="Aprovar Usuário"
                            >
                              <Check size={18} />
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(user.id, 'rejected')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors tooltip"
                              title="Negar Acesso"
                            >
                              <X size={18} />
                            </button>
                          </>
                        )}
                        {user.status === 'approved' && (
                          <button 
                            onClick={() => setEditingUser(user)}
                            className="p-2 text-brand-cyan hover:bg-cyan-50 rounded-lg transition-colors tooltip flex items-center gap-1 text-sm font-medium"
                            title="Editar Permissões"
                          >
                            <Edit2 size={16} /> Telas
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Editar Permissões</h3>
                <p className="text-sm text-slate-500 mt-1">{editingUser.name}</p>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {AVAILABLE_PERMISSIONS.map(perm => (
                <div 
                  key={perm.id} 
                  onClick={() => togglePermission(perm.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    editingUser.permissions?.includes(perm.id) 
                      ? 'border-brand-cyan bg-cyan-50/50' 
                      : 'border-slate-200 hover:border-brand-cyan/50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                    editingUser.permissions?.includes(perm.id)
                      ? 'bg-brand-cyan border-brand-cyan'
                      : 'bg-white border-slate-300'
                  }`}>
                    {editingUser.permissions?.includes(perm.id) && <Check size={14} className="text-white" />}
                  </div>
                  <span className={`font-medium text-sm ${
                    editingUser.permissions?.includes(perm.id) ? 'text-slate-800' : 'text-slate-600'
                  }`}>
                    {perm.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setEditingUser(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleUpdatePermissions(editingUser.id, editingUser.permissions)}
                className="flex-1 px-4 py-2.5 bg-brand-cyan hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors"
              >
                Salvar Acessos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
