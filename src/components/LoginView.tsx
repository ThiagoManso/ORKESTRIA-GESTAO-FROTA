import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Mail, Lock, User, AlertCircle, LogIn, UserPlus } from 'lucide-react';

export function LoginView() {
  const { login, loginWithEmail, registerWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        if (!name) throw new Error('Nome é obrigatório');
        await registerWithEmail(email, password, name);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro na autenticação');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await login();
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar com Google');
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-ork-bg text-white p-6 relative overflow-hidden">
      {/* Animated Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-ork-primary/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-ork-secondary/10 blur-[120px] rounded-full animate-pulse delay-700" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-4 border-ork-primary border-t-transparent animate-[spin_4s_linear_infinite]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-ork-secondary shadow-[0_0_20px_#2D9CFF]" />
            </div>
          </div>
          <div className="text-left">
            <h1 className="text-4xl font-black tracking-tighter leading-none mb-1 uppercase italic">
              Orkestria <span className="text-ork-primary font-light">OS</span>
            </h1>
            <p className="text-[9px] font-bold text-ork-text-muted uppercase tracking-[0.3em]">Fleet Management Ecosystem</p>
          </div>
        </div>

        <div className="bg-ork-surface border border-ork-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
          {/* Form Header Tabs */}
          <div className="flex bg-white/5 p-1 rounded-2xl mb-8 relative z-10">
            <button 
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-ork-primary text-white shadow-lg' : 'text-ork-text-muted hover:text-white'}`}
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </button>
            <button 
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'register' ? 'bg-ork-primary text-white shadow-lg' : 'text-ork-text-muted hover:text-white'}`}
            >
              <UserPlus className="w-4 h-4" />
              Criar Conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-ork-text-muted ml-1">Nome Completo</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ork-text-muted group-focus-within:text-ork-primary transition-colors" />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-ork-primary focus:bg-white/[0.07] transition-all"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-ork-text-muted ml-1">E-mail Corporativo</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ork-text-muted group-focus-within:text-ork-primary transition-colors" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@orkestria.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-ork-primary focus:bg-white/[0.07] transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-ork-text-muted ml-1">Senha de Acesso</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ork-text-muted group-focus-within:text-ork-primary transition-colors" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-ork-primary focus:bg-white/[0.07] transition-all"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-ork-primary hover:bg-ork-primary/90 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-ork-primary/20 flex items-center justify-center gap-3 mt-4 group overflow-hidden relative"
            >
              {loading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  <span className="uppercase tracking-widest text-xs">{mode === 'login' ? 'Autenticar' : 'Cadastrar'}</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-8 z-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[0.3em]">
              <span className="bg-[#0b0c10] px-4 text-ork-text-muted">Ou continue com</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 relative z-10 overflow-hidden group"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
            <span className="uppercase tracking-widest text-[10px]">Google Cloud Auth</span>
          </button>
        </div>

        <p className="text-center mt-8 text-[10px] text-ork-text-muted font-bold uppercase tracking-[0.2em] leading-relaxed">
          Gerenciado por <span className="text-white">Orkestria OS Framework</span><br />
          Sistemas Críticos & Missão de Frota
        </p>
      </motion.div>
    </div>
  );
}
