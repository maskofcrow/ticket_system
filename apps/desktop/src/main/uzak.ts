import { app } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getRustdeskKuruldu, setRustdeskKuruldu } from './store.js';

const execFileP = promisify(execFile);

/**
 * Uzak masaüstü desteği — YALNIZCA Windows.
 *
 * Esta Bilişim'in kendi (MeshCentral tabanlı, markalı) uzak destek ajanını kurar.
 * Ajan grubumuza+sunucumuza önceden ayarlıdır (self-contained exe); kurulunca
 * cihaz Esta konsolunda görünür ve destek ekibi tarayıcıdan bağlanır. "RustDesk"
 * ya da "MeshCentral" markası kullanıcıya görünmez.
 *
 * ŞEFFAF, RIZAYA DAYALI: kullanıcı "Kur" der, yalnızca bir Windows yönetici (UAC)
 * onayı görünür. Kurulum yükseltilmiş olarak ATEŞLENİR (fire-and-forget); bitişi
 * bir işaret dosyasıyla saptanır (bekleme asılmaz).
 */

// Kurulu MeshCentral ajanının varsayılan Windows yolu.
const KURULU_AJAN = 'C:\\Program Files\\Mesh Agent\\MeshAgent.exe';

const win = (): boolean => process.platform === 'win32';

function kurulumDir(): string {
  return join(app.getPath('userData'), 'uzak-destek');
}
function markerYolu(): string {
  return join(kurulumDir(), '.kuruldu');
}
/** Gömülü ajan exe yolu (paketlenmişte resources/, dev'de yok). */
function gomuluAjan(): string | null {
  if (!app.isPackaged) return null;
  const yol = join(process.resourcesPath, 'meshagent.exe');
  return existsSync(yol) ? yol : null;
}
export function uzakDestekMumkun(): boolean {
  return win() && gomuluAjan() !== null;
}

/** Kurulum tamamlandı mı: store bayrağı, işaret dosyası ya da kurulu ajan. */
async function tamamMi(): Promise<boolean> {
  if (await getRustdeskKuruldu()) return true;
  if (existsSync(markerYolu()) || existsSync(KURULU_AJAN)) {
    await setRustdeskKuruldu(true);
    return true;
  }
  return false;
}

export async function uzakKurulumBaslat(): Promise<{ ok: boolean; hata?: string }> {
  if (!win()) return { ok: false, hata: 'Uzak destek yalnızca Windows’ta.' };
  const ajan = gomuluAjan();
  if (!ajan) return { ok: false, hata: 'Kurulum dosyası bulunamadı.' };
  try {
    await mkdir(kurulumDir(), { recursive: true });
    // Ajanı yazılabilir bir dizine kopyalayıp oradan kur (resources salt-okunur olabilir).
    const yerel = join(kurulumDir(), 'meshagent.exe');
    await copyFile(ajan, yerel);

    // Yükseltilmiş betik: ajanı sessizce kur (-fullinstall, servis olarak) →
    // kurulu ajan oluşana kadar yokla → işaret dosyasını yaz. -EncodedCommand ile
    // geçilir (tırnak/değişken kaçışı sorunsuz). Betik beklenmeden ATEŞLENİR.
    const q = (s: string): string => s.replace(/'/g, "''");
    const script = [
      `Start-Process -FilePath '${q(yerel)}' -ArgumentList '-fullinstall'`,
      `$n=0`,
      `while(-not (Test-Path '${q(KURULU_AJAN)}') -and $n -lt 40){ Start-Sleep -Seconds 2; $n++ }`,
      `if (Test-Path '${q(KURULU_AJAN)}') { Start-Sleep -Seconds 2; New-Item -ItemType File -Force -Path '${q(markerYolu())}' | Out-Null }`,
    ].join('\n');
    const b64 = Buffer.from(script, 'utf16le').toString('base64');

    void execFileP(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Start-Process powershell -ArgumentList '-NoProfile','-EncodedCommand','${b64}' -Verb RunAs`,
      ],
      { timeout: 300000 },
    ).catch((e) => console.error('[uzak] kurulum betiği başlatılamadı:', e));

    return { ok: true };
  } catch (e) {
    console.error('[uzak] kurulum hatası:', e);
    return { ok: false, hata: 'Kurulum başlatılamadı.' };
  }
}

export async function uzakDurumUI(): Promise<{ mumkun: boolean; kuruldu: boolean }> {
  if (!win()) return { mumkun: false, kuruldu: false };
  return { mumkun: uzakDestekMumkun(), kuruldu: await tamamMi() };
}

/** Envanterle bildirilecek uzak durum (MeshCentral için ek alan gerekmiyor). */
export async function uzakDurum(): Promise<{ rustdeskId?: string; rustdeskSifre?: string }> {
  return {};
}
