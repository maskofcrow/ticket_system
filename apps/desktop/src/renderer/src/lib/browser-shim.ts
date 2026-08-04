import type { DesktopApi } from '../../../preload/index.js';

/**
 * Arayüzü Electron açmadan tarayıcıda geliştirebilmek için köprü taklidi.
 *
 * SADECE geliştirme derlemesinde ve `window.desktop` yokken devreye girer —
 * yani Electron içinde çalışırken hiçbir zaman kullanılmaz. Üretim derlemesinde
 * `import.meta.env.DEV` false olduğu için bu kod tamamen elenir (tree-shaking).
 *
 * Token'lar burada sessionStorage'da tutulur; gerçek uygulamada ana süreçte
 * safeStorage ile şifrelenir (bkz. src/main/store.ts).
 */
export function installBrowserShim(): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === 'undefined' || window.desktop) return;

  const shim: DesktopApi = {
    auth: {
      getRefreshToken: async () => sessionStorage.getItem('shim.refreshToken'),
      setRefreshToken: async (token) => {
        if (token) sessionStorage.setItem('shim.refreshToken', token);
        else sessionStorage.removeItem('shim.refreshToken');
      },
    },
    config: {
      getApiUrl: async () =>
        localStorage.getItem('shim.apiUrl') ?? 'https://crm.estabilisim.com',
      setApiUrl: async (url) => localStorage.setItem('shim.apiUrl', url),
    },
    device: {
      collect: async () => ({
        isletimSistemi: `${navigator.platform} (tarayıcı)`,
        bilgisayarAdi: 'tarayici-onizleme',
        islemci: 'bilinmiyor',
        toplamBellekMb: 0,
        bosDiskGb: 0,
        yerelIp: null,
        uygulamaSurumu: '0.0.0-dev',
      }),
      getSharePreference: async () => true,
      setSharePreference: async () => undefined,
    },
    inventory: {
      collect: async () => ({ bilgisayarAdi: 'tarayici-onizleme', uygulamaSurumu: '0.0.0-dev' }),
    },
    gorselGetir: async (url) => url,
    screenshot: {
      capture: async () => ({ error: 'Ekran yakalama yalnızca masaüstü uygulamasında çalışır.' }),
      fromClipboard: async () => null,
    },
    app: {
      getVersion: async () => '0.0.0-dev',
      setBadge: async () => undefined,
    },
    guncelleme: {
      onIniyor: () => () => undefined,
      onIlerleme: () => () => undefined,
      onHazir: () => () => undefined,
      kur: async () => undefined,
    },
    notify: async (title, body) => {
      console.info('[bildirim]', title, body);
    },
  };

  window.desktop = shim;
  console.info('[dev] Tarayıcı köprüsü etkin — Electron yetenekleri taklit ediliyor.');
}
