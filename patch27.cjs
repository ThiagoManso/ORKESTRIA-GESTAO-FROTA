const fs = require('fs');
let code = fs.readFileSync('src/components/UserManagementView.tsx', 'utf8');

const pendingUsersSection = `
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
                key={\`pending-user-\${u.uid}\`}
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
                      <div className="flex items-center gap-2 text-ork-text-muted">
                        <Mail className="w-3 h-3" />
                        <p className="text-xs">{u.email}</p>
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
`;

code = code.replace(/\{inactiveUsers\.length > 0 && \(/, pendingUsersSection + "\n      {inactiveUsers.length > 0 && (");

fs.writeFileSync('src/components/UserManagementView.tsx', code);
