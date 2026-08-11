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
 * RustDesk'in kendi kurulum penceresi ve Windows UAC (yönetici) onayı GÖRÜNÜR
 * biçimde çıkar; kullanıcı bir kez onaylar. Gizli/sessiz/otomatik adım yok.
 * Meşru IT destek amacı: müşteri, destek ekibi bağlanabilsin diye aracı kendi kurar.
 */

const RELAY_SUNUCU = 'crm.estabilisim.com';
const RELAY_KEY = 'nS9GA3CO3yRIHgQKQtbg3YEBLDMcj1RPcD521J2vueo=';
const KURULU_RUSTDESK = 'C:\\Program Files\\RustDesk\\rustdesk.exe';

let bellekId: string | null = null;
const win = (): boolean => process.platform === 'win32';

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
    const dir = join(app.getPath('userData'), 'rustdesk-kurulum');
    await mkdir(dir, { recursive: true });
    const cfg = join(dir, `rustdesk-host=${RELAY_SUNUCU},key=${RELAY_KEY}.exe`);
    await copyFile(exe, cfg);
    // Kurulumu ateşle, kurulu istemci oluşana kadar yokla, sonra kalıcı
    // (gözetimsiz) şifreyi ata. --silent-install kurduktan sonra RustDesk'i
    // başlatıp süreçte kaldığı için doğrudan beklemek işlemi asılı bırakır;
    // bu yüzden dosya oluşumunu yokluyoruz. Betik -EncodedCommand ile geçilir
    // (çift katman tırnak/değişken kaçışını tamamen ortadan kaldırır).
    const q = (s: string): string => s.replace(/'/g, "''");
    const script = [
      `Start-Process -FilePath '${q(cfg)}' -ArgumentList '--silent-install'`,
      `$n=0`,
      `while(-not (Test-Path '${q(KURULU_RUSTDESK)}') -and $n -lt 40){ Start-Sleep -Seconds 2; $n++ }`,
      `if (Test-Path '${q(KURULU_RUSTDESK)}') { Start-Sleep -Seconds 3; Start-Process -FilePath '${q(KURULU_RUSTDESK)}' -ArgumentList '--password','${q(sifre)}' }`,
    ].join('\n');
    const b64 = Buffer.from(script, 'utf16le').toString('base64');
    await execFileP(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Start-Process powershell -ArgumentList '-NoProfile','-EncodedCommand','${b64}' -Verb RunAs -Wait`,
      ],
      { timeout: 300000 },
    );
    // Doğrula: kurulu istemci oluştu mu / ID alınabildi mi.
    await idTazele();
    const kuruldu = existsSync(KURULU_RUSTDESK) || bellekId != null;
    if (!kuruldu) {
      return { ok: false, hata: 'Kurulum doğrulanamadı. Lütfen tekrar deneyin.' };
    }
    await setRustdeskKuruldu(true);
    return { ok: true };
  } catch (e) {
    console.error('[uzak] kurulum hatası:', e);
    return { ok: false, hata: 'Kurulum tamamlanamadı (yönetici onayı reddedilmiş olabilir).' };
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
  const kuruldu = await getRustdeskKuruldu();
  if (kuruldu && !bellekId) await idTazele();
  return { mumkun: uzakDestekMumkun(), kuruldu, rustdeskId: bellekId ?? undefined };
}

export async function uzakDurum(): Promise<{ rustdeskId?: string; rustdeskSifre?: string }> {
  if (!win() || !(await getRustdeskKuruldu())) return {};
  if (!bellekId) await idTazele();
  return { rustdeskId: bellekId ?? undefined, rustdeskSifre: (await readRustdeskSifre()) ?? undefined };
}
