import { hostname, totalmem, networkInterfaces } from 'node:os';
import { app } from 'electron';
import si from 'systeminformation';
import type { DeviceInfo } from '@ticket/shared';

/**
 * Ticket açılırken toplanan makine bilgisi. Kullanıcıya ne gönderileceği
 * gösterilir ve onay kutusuyla eklenir — sessizce toplanmaz.
 *
 * Bilinçli olarak toplanmayanlar: kullanıcı adı, kurulu program listesi,
 * çalışan süreçler, seri numarası. Destek için gerekmiyorlar ve gereksiz
 * kişisel veri toplamak istemiyoruz.
 */
export async function collectDeviceInfo(): Promise<DeviceInfo> {
  const [os, cpu, disks] = await Promise.all([
    si.osInfo().catch(() => null),
    si.cpu().catch(() => null),
    si.fsSize().catch(() => [] as si.Systeminformation.FsSizeData[]),
  ]);

  // Sistem diski (mount "/" veya "C:") — birden çok disk varsa en büyüğü.
  const systemDisk =
    disks.find((d) => d.mount === '/' || d.mount === 'C:') ??
    disks.sort((a, b) => b.size - a.size)[0];

  return {
    os: os ? `${os.distro} ${os.release}`.trim() : process.platform,
    hostname: hostname(),
    cpu: cpu ? `${cpu.manufacturer} ${cpu.brand}`.trim() : 'bilinmiyor',
    totalMemMb: Math.round(totalmem() / 1024 / 1024),
    freeDiskGb: systemDisk ? Math.round(systemDisk.available / 1024 ** 3) : 0,
    localIp: firstLocalIp(),
    appVersion: app.getVersion(),
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
