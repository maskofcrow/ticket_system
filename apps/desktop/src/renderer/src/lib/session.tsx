import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse, SessionUser } from '@ticket/shared';
import { apiFetch, applyAuth, clearAuth, initApi, restoreSession, setSessionLostHandler } from './api';

interface SessionValue {
  user: SessionUser | null;
  loading: boolean;
  activate: (input: {
    licenseKey: string;
    email: string;
    name: string;
    password: string;
  }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const reset = useCallback(() => {
    void clearAuth();
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionLostHandler(reset);
  }, [reset]);

  // Açılışta: kayıtlı sunucu adresini yükle, sonra oturumu geri getirmeyi dene.
  useEffect(() => {
    void (async () => {
      await initApi();
      const restored = await restoreSession();
      if (restored) setUser(restored.user);
      setLoading(false);
    })();
  }, []);

  const activate = useCallback<SessionValue['activate']>(async (input) => {
    const data = await apiFetch<AuthResponse>('/auth/activate', {
      method: 'POST',
      body: input,
      skipAuth: true,
    });
    await applyAuth(data);
    setUser(data.user);
  }, []);

  const login = useCallback<SessionValue['login']>(async (email, password) => {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    });
    await applyAuth(data);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const stored = await window.desktop.auth.getRefreshToken();
    if (stored) {
      await apiFetch('/auth/logout', { method: 'POST', body: { refreshToken: stored } }).catch(
        () => undefined,
      );
    }
    reset();
  }, [reset]);

  const value = useMemo(
    () => ({ user, loading, activate, login, logout }),
    [user, loading, activate, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession, SessionProvider içinde kullanılmalı');
  return ctx;
}
