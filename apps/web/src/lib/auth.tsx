import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse, SessionUser } from '@ticket/shared';
import {
  apiFetch,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  setUnauthorizedHandler,
} from './api';

interface AuthContextValue {
  user: SessionUser | null;
  /** İlk açılışta oturum geri yükleniyor mu — yükleme ekranını buna göre gösteriyoruz. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  // Token yenilenemediğinde (refresh de reddedildi) oturumu düşür.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
  }, [clearSession]);

  // Sayfa yenilendiğinde access token kaybolur; refresh token'dan oturumu kurtar.
  useEffect(() => {
    const stored = getRefreshToken();
    if (!stored) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const data = await apiFetch<AuthResponse>('/auth/refresh', {
          method: 'POST',
          body: { refreshToken: stored },
          skipAuth: true,
        });
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken);
        setUser(data.user);
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    })();
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    });

    // Panel yalnızca destek ekibi için: müşteri hesabıyla girilmeye çalışılırsa
    // token'ı hiç saklamadan reddet.
    if (data.user.role === 'CUSTOMER') {
      throw new Error('Bu panel destek ekibi içindir. Müşteri hesabıyla masaüstü uygulamasını kullanın.');
    }

    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const token = getRefreshToken();
    if (token) {
      await apiFetch('/auth/logout', { method: 'POST', body: { refreshToken: token } }).catch(
        () => undefined,
      );
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}
