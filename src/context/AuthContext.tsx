import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut as fbSignOut 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type UserRole = 'admin' | 'worker';

export interface UserProfile {
  uid: string;
  email: string;
  nama: string;
  role: UserRole;
  aktif: boolean;
}

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // 1. Ambil custom claim role dari token
          const tokenResult = await currentUser.getIdTokenResult(true);
          const claimRole = (tokenResult.claims.role as UserRole) || null;

          // 2. Ambil dokumen profil users/{uid}
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          const userData = userDoc.data();

          if (userData && userData.aktif === false) {
            await fbSignOut(auth);
            setUser(null);
            setRole(null);
            setProfile(null);
            alert('Akun Anda dinonaktifkan oleh administrator.');
            setLoading(false);
            return;
          }

          const resolvedRole = claimRole || (userData?.role as UserRole) || 'worker';
          setUser(currentUser);
          setRole(resolvedRole);
          setProfile({
            uid: currentUser.uid,
            email: currentUser.email || '',
            nama: userData?.nama || currentUser.displayName || 'Pengguna',
            role: resolvedRole,
            aktif: userData?.aktif !== false,
          });
        } catch (err) {
          console.error('Error saat memuat profil user:', err);
          setUser(currentUser);
          setRole('worker');
        }
      } else {
        setUser(null);
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    await fbSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus digunakan di dalam AuthProvider');
  return ctx;
};
