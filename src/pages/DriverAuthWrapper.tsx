import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { Truck, LogIn, UserPlus, AlertCircle, Clock } from 'lucide-react';
import DriverViewPage from './DriverViewPage';
import { Driver } from '../types';

const getOrCreateDeviceSessionId = () => {
  let sid = localStorage.getItem('orkestria_driver_session_id');
  if (!sid) {
    sid = 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    localStorage.setItem('orkestria_driver_session_id', sid);
  }
  return sid;
};

export default function DriverAuthWrapper() {
  const [user, setUser] = useState<any>(null);
  const [driverData, setDriverData] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration fields
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnh, setCnh] = useState('');
  const [vehicleType, setVehicleType] = useState('motorcycle');
  const [vehiclePlate, setVehiclePlate] = useState('');
  
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setDriverData(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const driverRef = doc(db, 'drivers', user.uid);
    const unsubscribe = onSnapshot(driverRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const mySid = localStorage.getItem('orkestria_driver_session_id');
        if (data.currentSessionId && mySid && data.currentSessionId !== mySid) {
          alert('Acesso Bloqueado: Esta conta de entregador foi acessada em outro aparelho. O sistema proíbe logar em múltiplos dispositivos com a mesma conta.');
          signOut(auth);
          return;
        }
        setDriverData({ id: docSnap.id, ...data } as Driver);
      } else {
        getDocs(collection(db, 'drivers')).then(async (snapshot) => {
          const match = snapshot.docs.find(d => {
            const data = d.data();
            return (user.email && data.email?.toLowerCase() === user.email.toLowerCase()) ||
                   (user.displayName && data.name?.toLowerCase() === user.displayName.toLowerCase());
          });
          if (match) {
            const matchedData = match.data();
            await setDoc(doc(db, 'drivers', user.uid), matchedData);
            if (match.id !== user.uid) {
              await deleteDoc(doc(db, 'drivers', match.id));
            }
          } else {
            setDriverData(null);
          }
        }).catch(console.error);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching driver data:", err);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const sid = getOrCreateDeviceSessionId();
      await updateDoc(doc(db, 'drivers', cred.user.uid), {
        currentSessionId: sid,
        lastLoginAt: new Date().toISOString()
      }).catch(() => {});
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos.');
      } else {
        setError('Ocorreu um erro ao fazer login.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name || !whatsapp || !cpf || !cnh || !vehiclePlate) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    
    setAuthLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      
      let existingStatus = 'pending_approval';
      try {
        const driversSnap = await getDocs(collection(db, 'drivers'));
        const cleanCpf = cpf.trim().replace(/\D/g, '');
        const existingDoc = driversSnap.docs.find(d => {
          const data = d.data();
          const dCpf = (data.cpf || '').trim().replace(/\D/g, '');
          const dName = (data.name || '').trim().toLowerCase();
          return (cleanCpf && dCpf === cleanCpf) || (dName && dName === name.trim().toLowerCase());
        });
        if (existingDoc) {
          const existingData = existingDoc.data();
          if (existingData.status && existingData.status !== 'pending_approval') {
            existingStatus = existingData.status;
          }
          if (existingDoc.id !== newUser.uid) {
            await deleteDoc(doc(db, 'drivers', existingDoc.id)).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar motorista existente:', err);
      }

      const newDriver: Omit<Driver, 'id'> = {
        name,
        email,
        whatsapp,
        phone: whatsapp,
        cpf,
        cnh,
        vehicleType,
        vehicle: `${vehicleType === 'motorcycle' ? 'Moto' : vehicleType === 'car' ? 'Carro' : 'Caminhão'} - ${vehiclePlate.toUpperCase()}`,
        rating: 5.0,
        status: existingStatus as any,
        completed: 0,
        currentSessionId: getOrCreateDeviceSessionId(),
      };
      
      await setDoc(doc(db, 'drivers', newUser.uid), newDriver);

      // Cria um veículo próprio para o entregador, assim ele pode fazer o checklist e ficar online
      const newVehicle = {
        plate: vehiclePlate.toUpperCase(),
        brand: 'Veículo',
        model: 'Próprio',
        year: new Date().getFullYear().toString(),
        type: vehicleType,
        initialKm: 0,
        status: 'active'
      };
      await addDoc(collection(db, 'vehicles'), newVehicle);
      
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setError('Ocorreu um erro ao realizar o cadastro.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin text-brand-cyan"><Truck size={40} /></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 font-sans p-4 justify-center">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="p-6 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Truck size={32} />
            </div>
            <h1 className="text-2xl font-bold">Orkestria Entregador</h1>
            <p className="text-cyan-100 mt-1 font-medium">Portal do Motorista</p>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="seu@email.com" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Senha</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="••••••" />
                </div>
                <button type="submit" disabled={authLoading} className="w-full mt-6 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-bold active:scale-[0.98] transition-transform shadow-sm flex items-center justify-center gap-2 disabled:opacity-70">
                  {authLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn size={20} /> Entrar</>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome Completo</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="João da Silva" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="seu@email.com" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">WhatsApp</label>
                  <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="(00) 00000-0000" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">CPF</label>
                    <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">CNH</label>
                    <input type="text" value={cnh} onChange={e => setCnh(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="Nº da CNH" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Veículo</label>
                    <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all">
                      <option value="motorcycle">Moto</option>
                      <option value="car">Carro</option>
                      <option value="truck">Caminhão</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Placa</label>
                    <input type="text" value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="ABC-1234" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Senha</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" placeholder="••••••" />
                </div>
                <button type="submit" disabled={authLoading} className="w-full mt-6 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-bold active:scale-[0.98] transition-transform shadow-sm flex items-center justify-center gap-2 disabled:opacity-70">
                  {authLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus size={20} /> Cadastrar</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (driverData?.status === 'pending_approval') {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 font-sans p-4 justify-center">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 p-8 text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={40} className="text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Cadastro em Análise</h2>
          <p className="text-slate-600 font-medium leading-relaxed mb-8">
            Sua documentação está sendo validada pela nossa central. Avisaremos via WhatsApp assim que seu acesso for liberado!
          </p>
          <button onClick={() => signOut(auth)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return <DriverViewPage driverId={driverData?.id} driverName={driverData?.name} driverStatus={driverData?.status} />;
}
