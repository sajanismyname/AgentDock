import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Attempt initial session restore via HTTP-only refresh cookie
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        await api.auth.refresh();
        const meRes = await api.auth.getMe();
        if (isMounted) {
          setUser(meRes.user);
        }
      } catch {
        // Not authenticated
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    setUser(res.user);
  };

  const register = async (email: string, password: string) => {
    const res = await api.auth.register(email, password);
    setUser(res.user);
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  const deleteAccount = async () => {
    await api.auth.deleteAccount();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
