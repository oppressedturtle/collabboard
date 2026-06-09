import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { api } from '../lib/api';
import { AuthContext, type User } from './context';

interface AuthResponse {
  user: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap the session on mount: ask the server who we are. A 401 simply
  // means "not logged in".
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { user: me } = await api.get<AuthResponse>('/auth/me');
        if (active) setUser(me);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: me } = await api.post<AuthResponse>('/auth/login', {
      email,
      password,
    });
    setUser(me);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const { user: me } = await api.post<AuthResponse>('/auth/register', {
        email,
        password,
        name,
      });
      setUser(me);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
