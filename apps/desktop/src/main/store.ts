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
  /** RustDesk gözetimsiz şifresi (safeStorage ile şifreli, base64). */
  rustdeskSifre?: string;
  /** Şifreleme kullanılamayan sistemlerde düz metin yedeği. */
  rustdeskSifrePlain?: string;
  /** RustDesk kurulumu tamamlandı mı. */
  rustdeskKuruldu?: boolean;
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

/** RustDesk gözetimsiz şifresi — refresh token ile aynı safeStorage deseni. */
export function saveRustdeskSifre(sifre: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    store.set('rustdeskSifre', safeStorage.encryptString(sifre).toString('base64'));
    store.delete('rustdeskSifrePlain');
  } else {
    store.set('rustdeskSifrePlain', sifre);
    store.delete('rustdeskSifre');
  }
}

export function readRustdeskSifre(): string | null {
  const encrypted = store.get('rustdeskSifre');
  if (encrypted) {
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch {
      store.delete('rustdeskSifre');
      return null;
    }
  }
  return store.get('rustdeskSifrePlain') ?? null;
}

export function getRustdeskKuruldu(): boolean {
  return store.get('rustdeskKuruldu') ?? false;
}

export function setRustdeskKuruldu(value: boolean): void {
  store.set('rustdeskKuruldu', value);
}
