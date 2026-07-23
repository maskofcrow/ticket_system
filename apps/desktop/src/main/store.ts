import { safeStorage } from 'electron';
import Store from 'electron-store';

interface StoreSchema {
  /** safeStorage ile şifrelenmiş refresh token (base64). */
  refreshToken?: string;
  /** Şifreleme kullanılamayan sistemlerde düz metin yedeği. */
  refreshTokenPlain?: string;
  apiUrl?: string;
  /** Sistem bilgisi gönderme onayı — kullanıcı bir kez karar verir, sonra hatırlanır. */
  shareDeviceInfo?: boolean;
}

const store = new Store<StoreSchema>({ name: 'ticket-desktop' });

/**
 * Refresh token OS anahtar zincirine bağlı safeStorage ile şifrelenir
 * (macOS Keychain, Windows DPAPI). Böylece disk üzerindeki dosya çalınsa bile
 * token başka bir makinede çözülemez.
 *
 * Bazı Linux masaüstlerinde anahtarlık servisi olmayabilir; o durumda
 * şifrelemesiz saklıyoruz — kullanıcıyı oturumdan tamamen mahrum etmemek için
 * bilinçli bir ödünleşme.
 */
export function saveRefreshToken(token: string | null): void {
  if (!token) {
    store.delete('refreshToken');
    store.delete('refreshTokenPlain');
    return;
  }

  if (safeStorage.isEncryptionAvailable()) {
    store.set('refreshToken', safeStorage.encryptString(token).toString('base64'));
    store.delete('refreshTokenPlain');
  } else {
    store.set('refreshTokenPlain', token);
    store.delete('refreshToken');
  }
}

export function readRefreshToken(): string | null {
  const encrypted = store.get('refreshToken');
  if (encrypted) {
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch {
      // Anahtar zinciri değişmiş veya başka makinede açılmış — oturumu sıfırla.
      store.delete('refreshToken');
      return null;
    }
  }
  return store.get('refreshTokenPlain') ?? null;
}

export function getApiUrl(fallback: string): string {
  return store.get('apiUrl') ?? fallback;
}

export function setApiUrl(url: string): void {
  store.set('apiUrl', url);
}

export function getShareDeviceInfo(): boolean {
  return store.get('shareDeviceInfo') ?? true;
}

export function setShareDeviceInfo(value: boolean): void {
  store.set('shareDeviceInfo', value);
}
