import type { AuthResponse, ErrorResponse } from '@ticket/shared';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const REFRESH_STORAGE_KEY = 'ticket.refreshToken';

/**
 * İstemci tarafı hata tipi. `fields` doğrudan form altındaki hata mesajlarına
 * bağlanır — sunucudaki doğrulama mesajlarını yeniden yazmaya gerek kalmaz.
 */
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

/**
 * Access token yalnızca bellekte tutulur; kalıcı olan sadece refresh token.
 * Böylece XSS ile çalınabilecek pencere kısalır (yine de localStorage bir SPA
 * için bilinen bir ödünleşme — httpOnly cookie'ye geçilecekse CSRF koruması gerekir).
 */
let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_STORAGE_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (token) localStorage.setItem(REFRESH_STORAGE_KEY, token);
  else localStorage.removeItem(REFRESH_STORAGE_KEY);
}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Eşzamanlı 401'lerde tek bir yenileme yapılsın diye devam eden istek paylaşılır.
 * Aksi halde sayfa açılışındaki 4-5 paralel sorgu 4-5 kez refresh tetikler ve
 * rotasyon yüzünden hepsi birden geçersiz olurdu.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const token = getRefreshToken();
  if (!token) return false;

  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (!res.ok) return false;

      const data = (await res.json()) as AuthResponse;
      accessToken = data.accessToken;
      setRefreshToken(data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | string[] | undefined>;
  /** Yenileme denemesini kapatır — refresh/login uçları için. */
  skipAuth?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
    else url.searchParams.set(key, String(value));
  }

  const send = async (): Promise<Response> =>
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
    /**
     * `fetch` yalnızca ağ seviyesinde başarısız olunca fırlatır: API kapalı,
     * sunucuya ulaşılamıyor veya CORS reddi. Yakalanmazsa arayüze tarayıcının
     * ham "Failed to fetch" metni düşüyor ve kullanıcı ne olduğunu anlamıyor.
     */
    throw new ApiError(
      0,
      'NETWORK',
      'Sunucuya bağlanılamadı. API çalışmıyor olabilir — ' +
        'terminalde `npm run dev:api` komutunun çalıştığından emin olun.',
    );
  }

  // Token süresi dolmuşsa bir kez yenileyip isteği tekrarla.
  if (response.status === 401 && !options.skipAuth) {
    if (await refreshSession()) {
      response = await send();
    } else {
      onUnauthorized?.();
    }
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
