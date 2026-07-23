import { clipboard, desktopCapturer, screen, systemPreferences } from 'electron';

export interface CapturedImage {
  /** data: URI — renderer önizlemede gösterir, yükleme sırasında Blob'a çevirir. */
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Tam ekran görüntüsü alır.
 *
 * macOS'te bu, Ekran Kaydı (Screen Recording) TCC izni ister ve izin verilene
 * kadar boş/siyah görüntü döner — bu yüzden izni önce kontrol edip kullanıcıya
 * anlaşılır bir hata veriyoruz.
 */
export async function captureScreen(): Promise<CapturedImage | { error: string }> {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen');
    if (status !== 'granted') {
      return {
        error:
          'Ekran görüntüsü için macOS izni gerekiyor: Sistem Ayarları → Gizlilik ve Güvenlik → ' +
          'Ekran Kaydı bölümünden bu uygulamaya izin verin, sonra uygulamayı yeniden başlatın. ' +
          'Alternatif olarak Cmd+Shift+4 ile görüntü alıp mesaj kutusuna yapıştırabilirsiniz.',
      };
    }
  }

  // Kaynağı ekranın gerçek çözünürlüğünde isteyelim; varsayılan küçük thumbnail
  // okunaksız çıkıyor ve hata mesajları seçilemiyor.
  const { width, height } = screen.getPrimaryDisplay().size;
  const scale = screen.getPrimaryDisplay().scaleFactor;

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) },
  });

  const primary = sources[0];
  if (!primary || primary.thumbnail.isEmpty()) {
    return { error: 'Ekran görüntüsü alınamadı.' };
  }

  const size = primary.thumbnail.getSize();
  return { dataUrl: primary.thumbnail.toDataURL(), width: size.width, height: size.height };
}

/**
 * Panodaki görseli okur. Kullanıcı Cmd+Shift+4 / Win+Shift+S ile aldığı
 * görüntüyü doğrudan ekleyebilsin diye — bu yol hiçbir izin gerektirmez.
 */
export function readClipboardImage(): CapturedImage | null {
  const image = clipboard.readImage();
  if (image.isEmpty()) return null;

  const size = image.getSize();
  return { dataUrl: image.toDataURL(), width: size.width, height: size.height };
}
