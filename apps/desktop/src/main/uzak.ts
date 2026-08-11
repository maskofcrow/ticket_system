import { app } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  readRustdeskSifre,
  saveRustdeskSifre,
  getRustdeskKuruldu,
  setRustdeskKuruldu,
} from './store.js';

const execFileP = promisify(execFile);

/**
 * Uzak masaüstü (RustDesk) entegrasyonu — YALNIZCA Windows.
 *
 * ŞEFFAF, RIZAYA DAYALI kurulum: kullanıcı uygulamada "Uzak desteği kur" der;
 * Windows UAC (yönetici) onayı GÖRÜNÜR biçimde çıkar; kullanıcı bir kez onaylar.
 * Meşru IT destek amacı: müşteri, destek ekibi bağlanabilsin diye aracı kendi kurar.
 *
 * Kurulum betiği yükseltilmiş olarak ATEŞLENİR (fire-and-forget) — beklenmez,
 * çünkü --silent-install sonrası RustDesk süreçte kalıp beklemeyi asıyordu.
 * Bitiş, betiğin en sonunda yazdığı bir işaret dosyasıyla saptanır.
 */

const RELAY_SUNUCU = 'crm.estabilisim.com';
const RELAY_KEY = 'nS9GA3CO3yRIHgQKQtbg3YEBLDMcj1RPcD521J2vueo=';
const KURULU_RUSTDESK = 'C:\\Program Files\\RustDesk\\rustdesk.exe';

let bellekId: string | null = null;
const win = (): boolean => process.platform === 'win32';

function kurulumDir(): string {
  return join(app.getPath('userData'), 'rustdesk-kurulum');
}
/** Betik başarıyla tamamlanınca yazılan işaret dosyası. */
function markerYolu(): string {
  return join(kurulumDir(), '.kuruldu');
}
function gomuluExe(): string | null {
  if (!app.isPackaged) return null;
  const yol = join(process.resourcesPath, 'rustdesk.exe');
  return existsSync(yol) ? yol : null;
}
function sifreUret(): string {
  return randomBytes(12).toString('base64url').slice(0, 16);
}
export function uzakDestekMumkun(): boolean {
  return win() && gomuluExe() !== null;
}

/** Kurulum tamamlandı mı: store bayrağı veya işaret dosyası. */
async function tamamMi(): Promise<boolean> {
  if (await getRustdeskKuruldu()) return true;
  if (existsSync(markerYolu())) {
    await setRustdeskKuruldu(true);
    return true;
  }
  return false;
}

export async function uzakKurulumBaslat(): Promise<{ ok: boolean; hata?: string }> {
  if (!win()) return { ok: false, hata: 'Uzak destek yalnızca Windows’ta.' };
  const exe = gomuluExe();
  if (!exe) return { ok: false, hata: 'Kurulum dosyası bulunamadı.' };
  try {
    let sifre = await readRustdeskSifre();
    if (!sifre) {
      sifre = sifreUret();
      await saveRustdeskSifre(sifre);
    }
    await mkdir(kurulumDir(), { recursive: true });
    const cfg = join(kurulumDir(), `rustdesk-host=${RELAY_SUNUCU},key=${RELAY_KEY}.exe`);
    await copyFile(exe, cfg);

    // Yükseltilmiş betik: config'li kurulumu ateşle → kurulu istemci oluşana
    // kadar yokla → kalıcı (gözetimsiz) şifreyi ata → işaret dosyasını yaz.
    // -EncodedCommand ile geçilir (tırnak/değişken kaçışı sorunsuz).
    const q = (s: string): string => s.replace(/'/g, "''");
    const script = [
      `Start-Process -FilePath '${q(cfg)}' -ArgumentList '--silent-install'`,
      `$n=0`,
      `while(-not (Test-Path '${q(KURULU_RUSTDESK)}') -and $n -lt 40){ Start-Sleep -Seconds 2; $n++ }`,
      `if (Test-Path '${q(KURULU_RUSTDESK)}') {`,
      `  Start-Sleep -Seconds 4`,
      `  Start-Process -FilePath '${q(KURULU_RUSTDESK)}' -ArgumentList '--password','${q(sifre)}'`,
      `  Start-Sleep -Seconds 2`,
      `  New-Item -ItemType File -Force -Path '${q(markerYolu())}' | Out-Null`,
      `}`,
    ].join('\n');
    const b64 = Buffer.from(script, 'utf16le').toString('base64');

    // Fire-and-forget: -Wait YOK. Betik arka planda çalışır; bitişini durum
    // sorgusu (işaret dosyası) saptar. execFileP yalnızca UAC diyaloğunu açar.
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

async function idTazele(): Promise<void> {
  const exe = existsSync(KURULU_RUSTDESK) ? KURULU_RUSTDESK : gomuluExe();
  if (!exe) return;
  try {
    const { stdout } = await execFileP(exe, ['--get-id'], { timeout: 15000 });
    const id = stdout.trim().replace(/\s+/g, '');
    if (/^\d{6,}$/.test(id)) bellekId = id;
  } catch (e) {
    console.error('[uzak] id okunamadı:', e);
  }
}

export async function uzakDurumUI(): Promise<{ mumkun: boolean; kuruldu: boolean; rustdeskId?: string }> {
  if (!win()) return { mumkun: false, kuruldu: false };
  const kuruldu = await tamamMi();
  if (kuruldu && !bellekId) await idTazele();
  return { mumkun: uzakDestekMumkun(), kuruldu, rustdeskId: bellekId ?? undefined };
}

export async function uzakDurum(): Promise<{ rustdeskId?: string; rustdeskSifre?: string }> {
  if (!win() || !(await tamamMi())) return {};
  if (!bellekId) await idTazele();
  return { rustdeskId: bellekId ?? undefined, rustdeskSifre: (await readRustdeskSifre()) ?? undefined };
}
