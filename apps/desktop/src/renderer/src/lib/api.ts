import type { AuthResponse, ErrorResponse } from '@ticket/shared';
import type { DesktopApi } from '../../../preload/index.js';

declare global {
  interface Window {
    desktop: DesktopApi;
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let apiUrl = 'http://localhost:3000';
let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

export async function initApi(): Promise<void> {
  apiUrl = await window.desktop.config.getApiUrl();
}

export function getApiUrl(): string {
  return apiUrl;
}

export async function setApiUrl(url: string): Promise<void> {
  apiUrl = url.replace(/\/+$/, '');
  await window.desktop.config.setApiUrl(apiUrl);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setSessionLostHandler(handler: () => void): void {
  onSessionLost = handler;
}

/**
 * Oturum bilgisini uygular: access token bellekte, refresh token ise ana süreçte
 * safeStorage ile şifrelenip diske yazılır. Renderer refresh token'ı hiç saklamaz.
 */
export async function applyAuth(data: AuthResponse): Promise<void> {
  accessToken = data.accessToken;
  await window.desktop.auth.setRefreshToken(data.refreshToken);
}

export async function clearAuth(): Promise<void> {
  accessToken = null;
  await window.desktop.auth.setRefreshToken(null);
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const stored = await window.desktop.auth.getRefreshToken();
  if (!stored) return false;

  // Paralel isteklerin hepsi 401 alınca tek bir yenileme yapılsın; aksi halde
  // rotasyon nedeniyle ilk yenileme dışındakiler geçersiz token kullanırdı.
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: stored }),
      });
      if (!res.ok) return false;
      await applyAuth((await res.json()) as AuthResponse);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Kaydedilmiş refresh token ile sessizce oturum açmayı dener. */
export async function restoreSession(): Promise<AuthResponse | null> {
  const stored = await window.desktop.auth.getRefreshToken();
  if (!stored) return null;

  try {
    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored }),
    });
    if (!res.ok) {
      await clearAuth();
      return null;
    }
    const data = (await res.json()) as AuthResponse;
    await applyAuth(data);
    return data;
  } catch {
    return null;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  skipAuth?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${apiUrl}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const send = (): Promise<Response> =>
    fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(accessToken && !options.skipAuth ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

  let response: Response;
  try {
    response = await send();
  } catch {
    throw new ApiError(0, 'NETWORK', 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.');
  }

  if (response.status === 401 && !options.skipAuth) {
    if (await refreshSession()) response = await send();
    else onSessionLost?.();
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const err = (payload as ErrorResponse | null)?.error;
    throw new ApiError(
      response.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? 'Beklenmeyen bir hata oluştu',
      err?.fields,
    );
  }

  return payload as T;
}
