import React, { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { LogIn, UserPlus, AlertCircle, Clock, Mail, Lock, User, Briefcase, ShieldCheck } from 'lucide-react';
import { SystemUser } from '../../types';
import { useNavigate } from 'react-router-dom';
import { setTenantUser } from '../../lib/tenant';
import { getUserPermissions, DEFAULT_ADMIN_PERMISSIONS } from '../../lib/permissions';

interface SystemAuthWrapperProps {
  onAuthSuccess: (user: SystemUser) => void;
}


const SECTORS = [
  "Brindes",
  "Call Center",
  "Comercial",
  "Compras",
  "Comunicação Visual",
  "Contabilidade",
  "CQD",
  "CQT",
  "Custos Lojas",
  "Estoque",
  "Financeiro",
  "Ger. de Impressão",
  "Impressão Digital",
  "Jurídico",
  "Logística",
  "Lojas",
  "Man. Máquinas",
  "MKT",
  "Novos Produtos",
  "Orçamento",
  "Pamgraf",
  "PCP",
  "Portaria",
  "Produção",
  "Pré Impressão Offset",
  "Recepção Diretoria",
  "RH",
  "Seg. do Trabalho",
  "TI",
  "Têxtil",
  "WRA Embalagens"
].sort();

export default function SystemAuthWrapper({ onAuthSuccess }: SystemAuthWrapperProps) {
  const [user, setUser] = useState<any>(null);
  const [systemUser, setSystemUser] = useState<SystemUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [name, setName] = useState('');
  const [sector, setSector] = useState(SECTORS[0]);
  const [companyName, setCompanyName] = useState('');
  
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setSystemUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Listen to SystemUser doc
    const userRef = doc(db, 'system_users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const rawData = docSnap.data();
        const baseUser: Partial<SystemUser> = {
          id: docSnap.id,
          ...rawData,
          role: rawData.role || 'internal_user',
          status: rawData.status || 'approved'
        };

        const userData = {
          ...baseUser,
          permissions: getUserPermissions(baseUser as SystemUser)
        } as SystemUser;

        setSystemUser(userData);
        setTenantUser(userData);
        // Libera o login do usuário
        onAuthSuccess(userData);
      } else {
        // Se o usuário logou pelo Firebase Auth mas ainda não tinha documento no Firestore (system_users),
        // criamos o perfil sem período de teste e com status pendente de aprovação (exceto admin principal).
        const isSuperUser = user.email?.toLowerCase() === 'thiago.manso@orkestriaos.com.br' ||
                            user.email?.toLowerCase() === 'admin@orkestriaos.com.br';
        const now = Date.now();
        const newSystemUser: Omit<SystemUser, 'id'> = {
          name: user.displayName || user.email?.split('@')[0] || 'Novo Colaborador',
          email: user.email!,
          sector: isSuperUser ? 'Administração' : 'Comercial',
          role: isSuperUser ? 'admin' : 'internal_user',
          status: isSuperUser ? 'approved' : 'pending_approval',
          permissions: isSuperUser ? DEFAULT_ADMIN_PERMISSIONS : ['dashboard', 'routes', 'drivers', 'vehicles', 'map', 'requests'],
          isDemo: false,
          createdAt: now
        };
        setDoc(doc(db, 'system_users', user.uid), newSystemUser).catch(console.error);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching system user data:", err);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user, onAuthSuccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos.');
      } else {
        setError('Ocorreu um erro ao fazer login.');
      }
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name || !email || !password || !sector) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    
    setAuthLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      
      const isAutoAdmin = email.toLowerCase() === 'thiago.manso@orkestriaos.com.br';
      
      const newSystemUser: Omit<SystemUser, 'id'> = {
        name,
        email,
        sector,
        role: isAutoAdmin ? 'admin' : 'internal_user',
        status: isAutoAdmin ? 'approved' : 'pending_approval',
        permissions: isAutoAdmin 
          ? ['dashboard', 'routes', 'drivers', 'vehicles', 'financial', 'issues', 'map', 'settings', 'requests', 'users', 'my_requests']
          : ['dashboard', 'routes', 'drivers', 'vehicles', 'map', 'requests'],
        companyName: companyName || 'ORKESTRIA OS',
        isDemo: false,
        tutorialSeen: false,
        createdAt: Date.now()
      };
      
      await setDoc(doc(db, 'system_users', newUser.uid), newSystemUser);
      
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setError('Ocorreu um erro ao realizar o cadastro.');
      }
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin text-brand-cyan"><ShieldCheck size={40} /></div>
      </div>
    );
  }

  if (systemUser?.status === 'pending_approval') {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 font-sans p-4 justify-center">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 p-8 text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={40} className="text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Cadastro em Análise</h2>
          <p className="text-slate-600 font-medium leading-relaxed mb-8">
            Sua conta está aguardando liberação do administrador. Avisaremos assim que seu acesso for autorizado.
          </p>
          <button onClick={() => signOut(auth)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">
            Sair
          </button>
        </div>
      </div>
    );
  }

  if (systemUser?.status === 'rejected') {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 font-sans p-4 justify-center">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={40} className="text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Acesso Negado</h2>
          <p className="text-slate-600 font-medium leading-relaxed mb-8">
            Infelizmente o seu acesso ao sistema não foi aprovado.
          </p>
          <button onClick={() => signOut(auth)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans p-4 justify-center">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white text-center">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20">
            <ShieldCheck size={32} className="text-brand-cyan" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Orkestria Control Tower</h1>
          <p className="text-slate-300 mt-1 font-medium text-sm">Portal Interno de Gestão de Frota</p>
        </div>
        
        <div className="flex border-b border-slate-200">
          <button 
            className={`flex-1 py-4 font-bold text-sm transition-colors ${isLogin ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            onClick={() => { setIsLogin(true); setError(''); }}
          >
            LOGIN
          </button>
          <button 
            className={`flex-1 py-4 font-bold text-sm transition-colors ${!isLogin ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            onClick={() => { setIsLogin(false); setError(''); }}
          >
            CADASTRAR
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-xl flex items-center gap-2 border border-red-100">
              <AlertCircle size={18} /> {error}
            </div>
          )}
          
          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Mail size={16} className="text-slate-400" /> E-mail
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="seu@email.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Lock size={16} className="text-slate-400" /> Senha
                </label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="••••••" />
              </div>
              <button type="submit" disabled={authLoading} className="w-full mt-6 py-3.5 bg-slate-900 text-white rounded-xl font-bold active:scale-[0.98] transition-all hover:bg-slate-800 shadow-sm flex items-center justify-center gap-2 disabled:opacity-70">
                {authLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn size={20} /> Entrar</>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User size={16} className="text-slate-400" /> Nome Completo
                </label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="João da Silva" />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Briefcase size={16} className="text-slate-400" /> Setor
                </label>
                <select value={sector} onChange={e => setSector(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all">
                  {SECTORS.map(sec => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Mail size={16} className="text-slate-400" /> E-mail
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="seu@email.com" />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Lock size={16} className="text-slate-400" /> Senha
                </label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="••••••" />
              </div>
              <button type="submit" disabled={authLoading} className="w-full mt-6 py-3.5 bg-slate-900 text-white rounded-xl font-bold active:scale-[0.98] transition-all hover:bg-slate-800 shadow-sm flex items-center justify-center gap-2 disabled:opacity-70">
                {authLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus size={20} /> Cadastrar</>}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-500 mb-3">É um motorista terceirizado?</p>
            <button 
              onClick={() => navigate('/driver')}
              className="w-full py-3 bg-cyan-50 text-brand-cyan hover:bg-cyan-100 rounded-xl font-bold transition-colors border border-cyan-200 flex items-center justify-center gap-2"
            >
              <Briefcase size={18} /> Acessar Portal do Entregador
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
