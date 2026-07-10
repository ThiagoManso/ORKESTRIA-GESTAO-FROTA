import React, { useEffect, useState } from 'react';
import { userService } from '../lib/services';
import { UserProfile, UserRole } from '../types';
import { Users, Shield, Truck, Search, Mail, Clock, UserPlus, ChevronRight, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { motion } from 'motion/react';
import { useAuth } from '../lib/AuthContext';

export function UserManagementView() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('driver');
  const [isInviting, setIsInviting] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmHardDelete, setConfirmHardDelete] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const { user: currentUser } = useAuth();

  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);

  useEffect(() => {
    const unsubUsers = userService.listUsers(setUsers);
    const unsubInvites = userService.listInvites(setInvites);
    return () => {
      unsubUsers();
      unsubInvites();
    };
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    
    setIsInviting(true);
    setErrorMessage(null);
    try {
      await userService.inviteUser(inviteEmail, inviteRole, inviteName);
      setInviteEmail('');
      setInviteName('');
      console.log(`Usuário ${inviteEmail} pré-registrado`);
    } catch (error: any) {
      if (error && error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Erro ao processar convite. Verifique se o e-mail já está em uso.");
      }
      console.error(error);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    if (uid === currentUser?.uid) return;
    await userService.updateUser(uid, { role: newRole });
  };

  const handleDeactivate = async (uid: string) => {
    if (uid === currentUser?.uid) return;
    await userService.updateUser(uid, { status: 'inactive' });
    setConfirmDeactivate(null);
  };

  const handleActivate = async (uid: string) => {
    await userService.updateUser(uid, { status: 'active' });
  };

  const handleHardDelete = async (uid: string) => {
    if (uid === currentUser?.uid) return;
    await userService.deleteUserProfile(uid);
    setConfirmHardDelete(null);
  };

  const handleDeleteInvite = async (id: string) => {
    await userService.deleteInvite(id);
  };

  const handleUpdateName = async (uid: string) => {
    if (!editName.trim()) return;
    await userService.updateUser(uid, { name: editName.trim() });
    setEditingUser(null);
  };

  const filteredUsers = users.filter(u => 
    (u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const activeUsers = filteredUsers.filter(u => u.status === 'active');
  const pendingUsers = filteredUsers.filter(u => u.status === 'pending');
  const inactiveUsers = filteredUsers.filter(u => u.status === 'inactive');

  const filteredInvites = invites.filter(i => {
    // Esconder invites que já tem um usuário registrado correspondente (limpar sujeira antiga do BD)
    if (users.some(u => u.email.toLowerCase() === i.email.toLowerCase())) return false;
    
    return i.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.name && i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-ork-primary/10 rounded-lg">
              <Users className="w-5 h-5 text-ork-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">Gestão de Usuários</h1>
          </div>
          <p className="text-ork-text-muted text-xs font-bold uppercase tracking-widest">Controle de acessos e permissões da plataforma</p>
        </div>

        <div className="relative group w-full sm:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ork-text-muted group-focus-within:text-ork-primary transition-colors" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-ork-surface border border-ork-border rounded-2xl text-sm text-white placeholder:text-ork-text-muted outline-none focus:border-ork-primary transition-all shadow-xl"
          />
        </div>
      </div>

      {/* Invite Section */}
      <div className="bg-ork-surface border border-ork-border rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <UserPlus className="w-24 h-24 text-ork-primary" />
        </div>
        
        <div className="relative z-10">
          <h2 className="text-xl font-black text-white uppercase italic mb-2">Pré-Registar Usuário</h2>
          <p className="text-ork-text-muted text-[10px] font-bold uppercase tracking-widest mb-6">Defina a função antes do primeiro acesso</p>
          
          <form onSubmit={handleInvite} className="flex flex-col lg:flex-row items-end gap-4">
            <div className="w-full lg:flex-1 space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-ork-text-muted ml-1">Nome do Usuário</label>
              <div className="relative group">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ork-text-muted group-focus-within:text-ork-primary transition-colors" />
                <input 
                  type="text"
                  value={inviteName}
                  onChange={(e) => {
                    setInviteName(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Nome do Condutor"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-ork-primary transition-all"
                  required
                />
              </div>
            </div>

            <div className="w-full lg:flex-1 space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-ork-text-muted ml-1">E-mail do Usuário</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ork-text-muted group-focus-within:text-ork-primary transition-colors" />
                <input 
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="exemplo@empresa.com"
                  className={cn(
                    "w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-ork-primary transition-all",
                    errorMessage && "border-red-500/50 focus:border-red-500"
                  )}
                  required
                />
              </div>
            </div>
            
            <div className="w-full lg:w-48 space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-ork-text-muted ml-1">Função</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-sm focus:outline-none focus:border-ork-primary appearance-none cursor-pointer"
              >
                <option value="driver" className="bg-ork-bg">Motorista</option>
                <option value="operator" className="bg-ork-bg">Operador (Uso/Manutenção)</option>
                <option value="manager" className="bg-ork-bg">Gestor (Acesso restrito)</option>
                <option value="purchasing" className="bg-ork-bg">Setor de Compras</option>
                <option value="admin" className="bg-ork-bg">Administrador (Acesso total)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isInviting}
              className="w-full lg:w-auto px-8 py-4 bg-ork-primary hover:bg-ork-primary/90 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-ork-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {isInviting ? 'Registrando...' : 'Autorizar Acesso'}
              {!isInviting && <ChevronRight className="w-4 h-4" />}
            </button>
          </form>

          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500"
            >
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wider">{errorMessage}</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Unified User Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Render Invites (Pending) */}
        {filteredInvites.map((invite) => (
          <motion.div
            layout
            key={`invite-${invite.id}`}
            className="bg-ork-surface border border-ork-primary/30 p-6 rounded-3xl relative overflow-hidden shadow-[0_0_20px_rgba(123,92,255,0.05)] group"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-ork-primary/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-start gap-4 mb-6 relative">
              <div className="w-12 h-12 rounded-2xl bg-ork-primary/10 border border-ork-primary/20 flex items-center justify-center font-black text-xl text-ork-primary">
                {invite.name?.charAt(0) || invite.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white tracking-tight truncate">
                    {invite.name || (invite.email || '').split('@')[0]}
                  </h3>
                  <span className="text-[7px] font-black bg-ork-primary text-white px-1.5 py-0.5 rounded-sm uppercase tracking-tighter animate-pulse shrink-0">Aguardando Login</span>
                </div>
                <div className="flex items-center gap-2 text-ork-text-muted">
                  <Mail className="w-3 h-3" />
                  <p className="text-xs truncate">{invite.email}</p>
                </div>
              </div>
              <button 
                onClick={() => handleDeleteInvite(invite.id)}
                className="p-3 rounded-xl border bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 group/btn"
                title="Remover autorização"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 relative">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-ork-text-muted" />
                  <span className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest">Autorizado em</span>
                </div>
                <span className="text-[10px] font-black text-white">
                  {invite.invitedAt?.toDate ? formatDate(invite.invitedAt.toDate()) : 'Pendente'}
                </span>
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-black text-ork-text-muted uppercase tracking-widest mb-3">Função Pré-Definida</p>
                <div className="flex items-center gap-2 w-full p-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-black uppercase text-white tracking-widest pl-1">
                    {invite.role === 'admin' ? 'Administrador' : invite.role === 'manager' ? 'Gestor' : invite.role === 'operator' ? 'Operador' : invite.role === 'purchasing' ? 'Setor de Compras' : 'Motorista'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Render Registered Active Users */}
        {activeUsers.map((u) => (
          <motion.div
            layout
            key={`active-user-${u.uid}`}
            className="bg-ork-surface border border-ork-border p-6 rounded-3xl group hover:border-ork-primary/30 transition-all shadow-xl relative overflow-hidden"
          >
            {/* Background pattern */}
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Users className="w-20 h-20" />
            </div>

            <div className="flex items-start gap-4 mb-6 relative">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-xl text-ork-primary">
                {u.name?.charAt(0) || u.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {editingUser?.uid === u.uid ? (
                    <div className="flex items-center gap-2 w-full">
                      <input 
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white w-full outline-none focus:border-ork-primary"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleUpdateName(u.uid);
                          if (e.key === 'Escape') setEditingUser(null);
                        }}
                      />
                      <button 
                        onClick={() => handleUpdateName(u.uid)}
                        className="text-[10px] font-black text-ork-secondary uppercase"
                      >
                        Salvar
                      </button>
                    </div>
                  ) : (
                    <h3 
                      className="text-lg font-black text-white tracking-tight truncate cursor-pointer hover:text-ork-primary transition-colors"
                      onClick={() => {
                        setEditingUser(u);
                        setEditName(u.name || '');
                      }}
                      title="Clique para editar o nome"
                    >
                      {u.name || (u.email || '').split('@')[0]}
                    </h3>
                  )}
                  {u.uid === currentUser?.uid && <span className="text-[8px] font-black bg-ork-primary text-white px-1.5 py-0.5 rounded-sm shrink-0">VOCÊ</span>}
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center gap-2 text-ork-text-muted">
                    <Mail className="w-3 h-3" />
                    <p className="text-xs truncate">{u.email}</p>
                  </div>
                  {(u.cargo || u.setor) && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-white/50 uppercase tracking-widest truncate">
                      {u.cargo} {u.cargo && u.setor && '•'} {u.setor}
                    </div>
                  )}
                </div>
              </div>
              {u.uid !== currentUser?.uid && (
                <div className="flex gap-2">
                  {confirmDeactivate === u.uid ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                      <button
                        onClick={() => setConfirmDeactivate(null)}
                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-ork-text-muted hover:text-white transition-colors"
                      >
                        Não
                      </button>
                      <button
                        onClick={() => handleDeactivate(u.uid)}
                        className="px-3 py-2 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                      >
                        Sim
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeactivate(u.uid)}
                      className="p-3 rounded-xl border bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 group/btn overflow-hidden relative"
                      title="Desativar acesso"
                    >
                      <Trash2 className="w-4 h-4 relative z-10" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4 relative">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-ork-text-muted" />
                  <span className="text-[10px] font-bold text-ork-text-muted uppercase tracking-widest">Desde</span>
                </div>
                <span className="text-[10px] font-black text-white">{formatDate(u.createdAt)}</span>
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-black text-ork-text-muted uppercase tracking-widest mb-3">Definir Função</p>
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-3 text-sm focus:outline-none focus:border-ork-primary appearance-none text-white cursor-pointer"
                >
                  <option value="driver">Motorista</option>
                  <option value="operator">Operador (Uso/Manutenção)</option>
                  <option value="manager">Gestor (Acesso restrito)</option>
                  <option value="purchasing">Setor de Compras</option>
                  <option value="admin">Administrador (Acesso total)</option>
                </select>
              </div>
            </div>
          </motion.div>
        ))}

        {activeUsers.length === 0 && filteredInvites.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-[2.5rem]">
            <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-ork-text-muted font-bold tracking-widest uppercase text-xs">Nenhum usuário ativo ou pendente</p>
          </div>
        )}
      </div>

      
      {pendingUsers.length > 0 && (
        <div className="space-y-6 pt-10 border-t border-white/5">
          <div>
            <h2 className="text-lg font-black text-white uppercase italic tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              Aguardando Aprovação
            </h2>
            <p className="text-ork-text-muted text-[10px] font-bold uppercase tracking-widest">Usuários que solicitaram acesso ao sistema</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {pendingUsers.map((u) => (
              <motion.div
                layout
                key={`pending-user-${u.uid}`}
                className="bg-ork-surface border border-yellow-500/20 p-6 rounded-3xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-[50px] rounded-full" />
                <div className="flex items-start justify-between relative">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center font-black text-xl text-yellow-500">
                      {u.name?.charAt(0) || u.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white tracking-tight">{u.name || u.email.split('@')[0]}</h3>
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center gap-2 text-ork-text-muted">
                          <Mail className="w-3 h-3" />
                          <p className="text-xs">{u.email}</p>
                        </div>
                        {(u.cargo || u.setor) && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-white/50 uppercase tracking-widest truncate">
                            {u.cargo} {u.cargo && u.setor && '•'} {u.setor}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 space-y-4 relative">
                  <div>
                    <p className="text-[10px] font-black text-ork-text-muted uppercase tracking-widest mb-2">Definir Função para Aprovar</p>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.uid, e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-3 text-sm focus:outline-none focus:border-ork-primary appearance-none text-white cursor-pointer"
                    >
                      <option value="driver">Motorista</option>
                      <option value="operator">Operador (Uso/Manutenção)</option>
                      <option value="manager">Gestor (Acesso restrito)</option>
                      <option value="purchasing">Setor de Compras</option>
                      <option value="admin">Administrador (Acesso total)</option>
                    </select>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeactivate(u.uid)}
                      className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-500 text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95"
                    >
                      Reprovar
                    </button>
                    <button
                      onClick={() => handleActivate(u.uid)}
                      className="flex-1 py-3 rounded-xl bg-emerald-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95"
                    >
                      Aprovar Acesso
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {inactiveUsers.length > 0 && (
        <div className="space-y-6 pt-10 border-t border-white/5">
          <div>
            <h2 className="text-lg font-black text-white uppercase italic tracking-tight">Usuários Desativados</h2>
            <p className="text-ork-text-muted text-[10px] font-bold uppercase tracking-widest">Sem acesso ao ecossistema (Histórico preservado)</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
            {inactiveUsers.map((u) => (
              <motion.div
                layout
                key={`inactive-user-${u.uid}`}
                className="bg-ork-surface border border-ork-border p-6 rounded-3xl relative overflow-hidden"
              >
                <div className="flex items-start gap-4 relative">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-xl text-ork-text-muted">
                    {u.name?.charAt(0) || u.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-white tracking-tight truncate">
                        {u.name || (u.email || '').split('@')[0]}
                      </h3>
                      <span className="text-[8px] bg-red-500/20 text-red-500 border border-red-500/30 px-1.5 py-0.5 rounded-sm uppercase font-black">Inativo</span>
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center gap-2 text-ork-text-muted">
                        <Mail className="w-3 h-3" />
                        <p className="text-xs truncate">{u.email}</p>
                      </div>
                      {(u.cargo || u.setor) && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/50 uppercase tracking-widest truncate">
                          {u.cargo} {u.cargo && u.setor && '•'} {u.setor}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {confirmHardDelete === u.uid ? (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                        <span className="text-[8px] font-black text-red-500 uppercase">Excluir Tudo?</span>
                        <button
                          onClick={() => setConfirmHardDelete(null)}
                          className="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-ork-text-muted"
                        >
                          Não
                        </button>
                        <button
                          onClick={() => handleHardDelete(u.uid)}
                          className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase"
                        >
                          Sim
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmHardDelete(u.uid)}
                        className="p-2 rounded-xl border border-red-500/20 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all"
                        title="Excluir definitivamente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleActivate(u.uid)}
                      className="p-2 rounded-xl border bg-ork-secondary/10 border-ork-secondary/20 text-ork-secondary hover:bg-ork-secondary hover:text-white transition-all active:scale-95"
                      title="Reativar acesso"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
