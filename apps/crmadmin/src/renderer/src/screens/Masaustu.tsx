import type { Cihaz } from '../../../shared/sozlesme';
import '../lib/api';

/**
 * Seçili cihazın SADECE masaüstü görünümü, gömülü webview'de. MeshCentral'ın
 * kanıtlanmış masaüstü motoru kullanılır; menü/sekmeler `hide` ile gizlenir, yani
 * kullanıcı MeshCentral arayüzünü görmez — sadece ekran. Windows şifresi sorulmaz
 * (ajan tabanlı). URL persist:mesh bölümündeki oturumla yetkilenir.
 */
export function Masaustu({ sunucu, cihaz }: { sunucu: string; cihaz: Cihaz }): React.ReactElement {
  // viewmode=11: sadece masaüstü sekmesi; hide=63 MeshCentral çerçevesini/menülerini
  // gizler (geçerli en yüksek maske). Tarayıcıda kanıtlanan URL: viewmode=11 + gotonode.
  const url = `${sunucu}/?viewmode=11&hide=63&gotonode=${cihaz.gotonode}`;
  return (
    <div className="flex h-full flex-col bg-black">
      <div className="flex items-center gap-2 bg-slate-900 px-4 py-1.5 text-xs text-slate-300">
        <span className="size-2 rounded-full bg-emerald-500" />
        {cihaz.ad}
        {cihaz.grup && <span className="text-slate-500">· {cihaz.grup}</span>}
      </div>
      <webview
        src={url}
        partition="persist:mesh"
        allowpopups
        style={{ display: 'flex', width: '100%', flex: 1, minHeight: 0, backgroundColor: '#000' }}
      />
    </div>
  );
}
