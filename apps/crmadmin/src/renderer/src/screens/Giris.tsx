import { Button } from '../components/ui';
import '../lib/api';

/**
 * Teknisyen giriş ekranı. MeshCentral login sayfası kalıcı oturumlu bir webview'de
 * yüklenir; teknisyen giriş yaptıktan sonra "Devam et" ile cihaz listesine geçilir.
 * (Oturum çerezi persist:mesh bölümünde kalır; sonraki açılışlarda giriş istenmez.)
 */
export function Giris({ sunucu, onGiris }: { sunucu: string; onGiris: () => void }): React.ReactElement {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        <span className="min-w-0 flex-1">
          Uzak yönetim hesabınızla giriş yapın; ardından <strong>Devam et</strong>’e basın.
        </span>
        <Button onClick={onGiris}>Devam et</Button>
      </div>
      <webview
        src={sunucu}
        partition="persist:mesh"
        style={{ display: 'flex', width: '100%', flex: 1, minHeight: 0 }}
      />
    </div>
  );
}
