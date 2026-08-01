import { hostname, totalmem, networkInterfaces, userInfo } from 'node:os';
import { app } from 'electron';
import si from 'systeminformation';
import type { CihazBilgisi, EnvanterBilgisi } from '../shared/sozlesme.js';

/**
 * Ticket açılırken toplanan makine bilgisi. Kullanıcıya ne gönderileceği
 * gösterilir ve onay kutusuyla eklenir — sessizce toplanmaz.
 *
 * Bilinçli olarak toplanmayanlar: kullanıcı adı, kurulu program listesi,
 * çalışan süreçler, seri numarası. Destek için gerekmiyorlar ve gereksiz
 * kişisel veri toplamak istemiyoruz.
 */
export async function collectDeviceInfo(): Promise<CihazBilgisi> {
  const [os, cpu, disks] = await Promise.all([
    si.osInfo().catch(() => null),
    si.cpu().catch(() => null),
    si.fsSize().catch(() => [] as si.Systeminformation.FsSizeData[]),
  ]);

  // Sistem diski (mount "/" veya "C:") — birden çok disk varsa en büyüğü.
  const systemDisk =
    disks.find((d) => d.mount === '/' || d.mount === 'C:') ??
    disks.sort((a, b) => b.size - a.size)[0];

  // Alan adları CRM'in cihazBilgisiSema'sıyla birebir aynı olmalı.
  return {
    isletimSistemi: os ? `${os.distro} ${os.release}`.trim() : process.platform,
    bilgisayarAdi: hostname(),
    islemci: cpu ? `${cpu.manufacturer} ${cpu.brand}`.trim() : 'bilinmiyor',
    toplamBellekMb: Math.round(totalmem() / 1024 / 1024),
    bosDiskGb: systemDisk ? Math.round(systemDisk.available / 1024 ** 3) : 0,
    yerelIp: firstLocalIp(),
    uygulamaSurumu: app.getVersion(),
  };
}

/**
 * Ağ sorunlarında destek ekibinin ilk sorduğu şey bu. Yalnızca yerel (özel)
 * adres döner — genel IP'yi tespit etmek için dış servise çıkmıyoruz.
 */
function firstLocalIp(): string | null {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return null;
}

/**
 * Envanter/varlık yönetimi için detaylı, otomatik toplanan donanım+ağ bilgisi.
 * Ticket'a bağlı değil — kullanıcı başına gönderilip CRM'de o kullanıcının
 * sayfasına işlenir. Her alan best-effort; hata olursa o alan boş geçilir.
 */
export async function collectInventory(): Promise<EnvanterBilgisi> {
  const [os, cpu, mem, disk, board, sys, chassis, wifi, disIp] = await Promise.all([
    si.osInfo().catch(() => null),
    si.cpu().catch(() => null),
    si.memLayout().catch(() => [] as si.Systeminformation.MemLayoutData[]),
    si.diskLayout().catch(() => [] as si.Systeminformation.DiskLayoutData[]),
    si.baseboard().catch(() => null),
    si.system().catch(() => null),
    si.chassis().catch(() => null),
    si.wifiConnections().catch(() => [] as si.Systeminformation.WifiConnectionData[]),
    disIpAl(),
  ]);

  const doluModuller = mem.filter((m) => m.size > 0);
  const bosSlot = mem.filter((m) => m.size === 0).length;

  return {
    bilgisayarAdi: hostname(),
    isletimSistemi: os ? `${os.distro} ${os.release}`.trim() : process.platform,
    islemci: cpu ? `${cpu.manufacturer} ${cpu.brand}`.trim() : undefined,
    kullaniciAdi: safe(() => userInfo().username),
    toplamBellekMb: Math.round(totalmem() / 1024 / 1024),
    bellekModulleri: doluModuller.map((m) => ({
      boyutMb: Math.round(m.size / 1024 / 1024),
      tip: m.type || undefined,
      hiz: m.clockSpeed || undefined,
      uretici: m.manufacturer || undefined,
      slot: m.bank || undefined,
    })),
    bellekSlotDolu: doluModuller.length,
    bellekSlotBos: mem.length > doluModuller.length ? bosSlot : undefined,
    diskler: disk.map((d) => ({
      ad: [d.vendor, d.name].filter(Boolean).join(' ').trim() || undefined,
      tip: d.type || undefined, // HD / SSD
      arayuz: d.interfaceType || undefined, // SATA / NVMe / PCIe / USB
      boyutGb: d.size ? Math.round(d.size / 1024 ** 3) : undefined,
    })),
    anakartUretici: board?.manufacturer || undefined,
    anakartModel: board?.model || undefined,
    sistemUretici: sys?.manufacturer || undefined,
    sistemModel: sys?.model || undefined,
    sasiTipi: chassis?.type || undefined,
    yerelIp: firstLocalIp() ?? undefined,
    disIp: disIp ?? undefined,
    agAdi: wifi[0]?.ssid || undefined,
    uygulamaSurumu: app.getVersion(),
  };
}

/** Genel (dış) IP — envanter için dış servise tek bir hafif istek. */
async function disIpAl(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const veri = (await res.json()) as { ip?: string };
    return veri.ip ?? null;
  } catch {
    return null;
  }
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
