import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { userService } from './services';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        if (user) {
          // Check/Create profile in background, don't await it to avoid blocking initialization
          userService.ensureProfileExists(user.uid, user.email || '', user.displayName || '').catch(err => {
            console.error("Delayed profile check error:", err);
          });
          
          // Subscribe to profile changes immediately
          unsubscribeProfile = userService.getUserProfile(user.uid, (p) => {
            if (p?.status === 'inactive') {
              setProfile(null);
              setUser(null);
              signOut(auth);
              alert('Sua conta foi desativada. Entre em contato com o administrador.');
              setLoading(false);
              return;
            }

            // Fallback for developer if profile is not yet in database
            if (!p && user.email?.toLowerCase() === 'thiago.altriman.man@gmail.com') {
              setProfile({
                uid: user.uid,
                email: user.email.toLowerCase(),
                name: user.displayName || 'Thiago',
                role: 'admin',
                status: 'active'
              } as any);
            } else {
              setProfile(p);
            }
            
            setLoading(false);
          });

          // Safety timeout - if profile doesn't load in 5 seconds, stop blocking
          setTimeout(() => setLoading(false), 5000);
        } else {
          setProfile(null);
          setLoading(false);
        }
      } catch (error: any) {
        console.error("Auth initialization error:", error);
        if (error?.message?.includes('the client is offline')) {
          alert('Não foi possível conectar ao banco de dados (Offline). Verifique sua configuração do Firebase no arquivo firebase-applet-config.json ou nas variáveis de ambiente.');
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const login = async () => {
    const { GoogleAuthProvider } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(userCredential.user, { displayName: name });
    // The ensureProfileExists will be triggered by onAuthStateChanged
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, loginWithEmail, registerWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
