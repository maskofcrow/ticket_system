import { session } from 'electron';
import WebSocket from 'ws';
import type { Cihaz } from '../shared/sozlesme.js';

/** crmadmin'in MeshCentral webview'i ile paylaştığı kalıcı oturum bölümü. */
export const PARTITION = 'persist:mesh';

/** Kalıcı bölümdeki oturum çerezini "ad=değer; ..." biçiminde döner. */
async function cerezBasligi(sunucu: string): Promise<string> {
  const cerezler = await session.fromPartition(PARTITION).cookies.get({ url: sunucu });
  return cerezler.map((c) => `${c.name}=${c.value}`).join('; ');
}

/** node// kimliğinden URL'deki gotonode kısmını çıkarır. MeshCentral base64'ü
 *  (A-Za-z0-9@$) URL-güvenli — encode ETME (kanıtlanmış URL'de `@` düz geçiyor). */
function gotonodeCikar(id: string): string {
  return id.startsWith('node//') ? id.slice('node//'.length) : id;
}

/**
 * MeshCentral control WS'ine bağlanıp cihaz listesini (grup adları + çevrimiçi
 * durumu) çeker. Oturum yoksa { girisGerekli: true } döner (teknisyen webview'de
 * giriş yapmalı).
 */
export async function cihazlariGetir(
  sunucu: string,
): Promise<{ ok: true; cihazlar: Cihaz[] } | { ok: false; girisGerekli?: boolean; hata?: string }> {
  const cookie = await cerezBasligi(sunucu);
  if (!cookie) return { ok: false, girisGerekli: true };

  const wsUrl = sunucu.replace(/^http/, 'ws') + '/control.ashx';

  return new Promise((resolve) => {
    let bitti = false;
    const gruplar = new Map<string, string>(); // meshid -> ad
    const cihazlar: Cihaz[] = [];
    let meshGeldi = false;
    let nodeGeldi = false;

    const ws = new WebSocket(wsUrl, {
      headers: { Cookie: cookie, Origin: sunucu },
      rejectUnauthorized: true,
    });

    const kapat = (sonuc: Awaited<ReturnType<typeof cihazlariGetir>>): void => {
      if (bitti) return;
      bitti = true;
      try {
        ws.close();
      } catch {
        /* yut */
      }
      resolve(sonuc);
    };

    const zamanAsimi = setTimeout(() => kapat({ ok: false, hata: 'Zaman aşımı' }), 15000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ action: 'meshes' }));
      ws.send(JSON.stringify({ action: 'nodes' }));
    });

    ws.on('message', (data) => {
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(data.toString());
      } catch {
        return;
      }
      // Oturum geçersizse MeshCentral 'close'/auth mesajı döner.
      if (m.action === 'close' || m.action === 'serverAuthError') {
        clearTimeout(zamanAsimi);
        return kapat({ ok: false, girisGerekli: true });
      }
      if (m.action === 'meshes' && Array.isArray(m.meshes)) {
        for (const g of m.meshes as Array<{ _id: string; name: string }>) {
          gruplar.set(g._id, g.name);
        }
        meshGeldi = true;
      }
      if (m.action === 'nodes' && m.nodes && typeof m.nodes === 'object') {
        const nodes = m.nodes as Record<string, Array<Record<string, unknown>>>;
        for (const [meshid, liste] of Object.entries(nodes)) {
          for (const n of liste) {
            const id = String(n._id ?? '');
            if (!id) continue;
            const conn = typeof n.conn === 'number' ? n.conn : 0;
            cihazlar.push({
              id,
              gotonode: gotonodeCikar(id),
              ad: String(n.name ?? n.rname ?? 'Cihaz'),
              cevrimici: (conn & 1) === 1,
              isletimSistemi: typeof n.osdesc === 'string' ? n.osdesc : undefined,
              grup: gruplar.get(meshid),
            });
          }
        }
        nodeGeldi = true;
      }
      // Her iki cevap da geldiyse grup adlarını doldurup bitir.
      if (meshGeldi && nodeGeldi) {
        for (const c of cihazlar) {
          // grup adı meshes daha sonra geldiyse eksik kalmasın diye tekrar bak
          if (!c.grup) c.grup = gruplar.get(c.id) ?? c.grup;
        }
        clearTimeout(zamanAsimi);
        kapat({ ok: true, cihazlar });
      }
    });

    ws.on('unexpected-response', (_req, res) => {
      clearTimeout(zamanAsimi);
      // 401/302 → oturum yok.
      kapat({ ok: false, girisGerekli: res.statusCode === 401 || res.statusCode === 302 });
    });
    ws.on('error', (e) => {
      clearTimeout(zamanAsimi);
      kapat({ ok: false, hata: e.message });
    });
    ws.on('close', () => {
      if (!bitti) {
        clearTimeout(zamanAsimi);
        // Veri gelmeden kapandıysa muhtemelen oturum yok.
        kapat({ ok: false, girisGerekli: !meshGeldi && !nodeGeldi });
      }
    });
  });
}
