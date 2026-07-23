import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AuthResponse, Organization, TicketDetail, TicketSummary } from '@ticket/shared';
import { prisma } from '../src/lib/prisma.js';
import { call, createAdmin, createOrgWithCustomer, createTicket, createTestApp, unique } from './helpers.js';

/**
 * Bu dosya sistemin en kritik güvenlik sınırlarını kapsıyor. Buradaki bir
 * regresyon müşteri verisi sızdırır — o yüzden testler gerçek HTTP katmanından
 * ve gerçek veritabanından geçiyor.
 */
describe('Yetki ve veri izolasyonu', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await createAdmin(app)).token;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('İç notlar', () => {
    it('müşteri, destek ekibinin iç notunu göremez', async () => {
      const acme = await createOrgWithCustomer(app, adminToken);
      const ticket = await createTicket(app, acme.customerToken);

      await call(app, 'POST', `/tickets/${ticket.id}/comments`, {
        token: adminToken,
        body: { body: 'GİZLİ: bu not müşteriye gitmemeli', isInternal: true },
      });
      await call(app, 'POST', `/tickets/${ticket.id}/comments`, {
        token: adminToken,
        body: { body: 'Merhaba, ilgileniyoruz.', isInternal: false },
      });

      const asStaff = await call<TicketDetail>(app, 'GET', `/tickets/${ticket.id}`, {
        token: adminToken,
      });
      const asCustomer = await call<TicketDetail>(app, 'GET', `/tickets/${ticket.id}`, {
        token: acme.customerToken,
      });

      expect(asStaff.body.comments).toHaveLength(2);
      expect(asCustomer.body.comments).toHaveLength(1);
      expect(JSON.stringify(asCustomer.body)).not.toContain('GİZLİ');
      expect(asCustomer.body.comments.every((c) => !c.isInternal)).toBe(true);
    });

    it('yorum sayacı müşteride iç notları saymaz', async () => {
      const org = await createOrgWithCustomer(app, adminToken);
      const ticket = await createTicket(app, org.customerToken);

      await call(app, 'POST', `/tickets/${ticket.id}/comments`, {
        token: adminToken,
        body: { body: 'İç not', isInternal: true },
      });

      const list = await call<{ items: TicketSummary[] }>(app, 'GET', '/tickets', {
        token: org.customerToken,
      });
      const found = list.body.items.find((t) => t.id === ticket.id);

      // Sayaç iç notu içerse "göremediğim bir hareket var" bilgisi sızardı.
      expect(found?.commentCount).toBe(0);
    });

    it('müşteri isInternal göndererek iç not yazamaz', async () => {
      const org = await createOrgWithCustomer(app, adminToken);
      const ticket = await createTicket(app, org.customerToken);

      const result = await call<{ isInternal: boolean }>(
        app,
        'POST',
        `/tickets/${ticket.id}/comments`,
        { token: org.customerToken, body: { body: 'İç not denemesi', isInternal: true } },
      );

      expect(result.status).toBe(201);
      expect(result.body.isInternal).toBe(false);
    });
  });

  describe('Firmalar arası izolasyon', () => {
    it('başka firmanın talebi 404 döner (403 değil — varlığını sızdırmamak için)', async () => {
      const acme = await createOrgWithCustomer(app, adminToken);
      const beta = await createOrgWithCustomer(app, adminToken);
      const ticket = await createTicket(app, acme.customerToken);

      const result = await call(app, 'GET', `/tickets/${ticket.id}`, { token: beta.customerToken });
      expect(result.status).toBe(404);
    });

    it('talep listesi yalnızca kendi firmasını içerir', async () => {
      const acme = await createOrgWithCustomer(app, adminToken);
      const beta = await createOrgWithCustomer(app, adminToken);
      await createTicket(app, acme.customerToken);
      await createTicket(app, beta.customerToken);

      const acmeList = await call<{ items: TicketSummary[] }>(app, 'GET', '/tickets', {
        token: acme.customerToken,
      });

      expect(acmeList.body.items.length).toBeGreaterThan(0);
      expect(acmeList.body.items.every((t) => t.org.id === acme.orgId)).toBe(true);
    });

    it('müşteri orgId filtresiyle başka firmanın taleplerini çekemez', async () => {
      const acme = await createOrgWithCustomer(app, adminToken);
      const beta = await createOrgWithCustomer(app, adminToken);
      await createTicket(app, beta.customerToken);

      const result = await call<{ items: TicketSummary[] }>(app, 'GET', '/tickets', {
        token: acme.customerToken,
        query: { orgId: beta.orgId },
      });

      // Filtre yok sayılır, kapsam kendi firmasına sabit kalır.
      expect(result.body.items.every((t) => t.org.id === acme.orgId)).toBe(true);
    });

    it('başka firmanın talebine yorum yazılamaz', async () => {
      const acme = await createOrgWithCustomer(app, adminToken);
      const beta = await createOrgWithCustomer(app, adminToken);
      const ticket = await createTicket(app, acme.customerToken);

      const result = await call(app, 'POST', `/tickets/${ticket.id}/comments`, {
        token: beta.customerToken,
        body: { body: 'Başka firmadan yorum denemesi' },
      });

      expect(result.status).toBe(404);
    });
  });

  describe('Müşteri yetkileri', () => {
    it('öncelik / atama / kategori değiştiremez', async () => {
      const org = await createOrgWithCustomer(app, adminToken);
      const ticket = await createTicket(app, org.customerToken);

      for (const patch of [{ priority: 'URGENT' }, { assignedToId: null }, { categoryId: null }]) {
        const result = await call(app, 'PATCH', `/tickets/${ticket.id}`, {
          token: org.customerToken,
          body: patch,
        });
        expect(result.status).toBe(403);
      }
    });

    it('durumu yalnızca CLOSED yapabilir', async () => {
      const org = await createOrgWithCustomer(app, adminToken);
      const ticket = await createTicket(app, org.customerToken);

      const rejected = await call(app, 'PATCH', `/tickets/${ticket.id}`, {
        token: org.customerToken,
        body: { status: 'RESOLVED' },
      });
      expect(rejected.status).toBe(403);

      const accepted = await call<TicketSummary>(app, 'PATCH', `/tickets/${ticket.id}`, {
        token: org.customerToken,
        body: { status: 'CLOSED' },
      });
      expect(accepted.status).toBe(200);
      expect(accepted.body.status).toBe('CLOSED');
    });

    it('firma ve kullanıcı yönetimine erişemez', async () => {
      const org = await createOrgWithCustomer(app, adminToken);

      expect((await call(app, 'GET', '/orgs', { token: org.customerToken })).status).toBe(403);
      expect((await call(app, 'GET', '/users', { token: org.customerToken })).status).toBe(403);
    });

    it('kendi talebini kapattıktan sonra yazınca talep yeniden açılır', async () => {
      const org = await createOrgWithCustomer(app, adminToken);
      const ticket = await createTicket(app, org.customerToken);

      await call(app, 'PATCH', `/tickets/${ticket.id}`, {
        token: adminToken,
        body: { status: 'RESOLVED' },
      });
      await call(app, 'POST', `/tickets/${ticket.id}/comments`, {
        token: org.customerToken,
        body: { body: 'Sorun devam ediyor.' },
      });

      const after = await call<TicketDetail>(app, 'GET', `/tickets/${ticket.id}`, {
        token: adminToken,
      });
      expect(after.body.status).toBe('OPEN');
      expect(after.body.resolvedAt).toBeNull();
    });
  });

  describe('Lisans anahtarı', () => {
    it('yanlış anahtar 401 döner', async () => {
      const result = await call(app, 'POST', '/auth/activate', {
        body: {
          licenseKey: 'TCK-AAAA-BBBB-CCCC-DDDD',
          email: `${unique('yok')}@test.local`,
          name: 'Deneme Kullanıcı',
          password: 'Test1234!',
        },
      });
      expect(result.status).toBe(401);
    });

    it('kullanıcı limiti dolunca yeni kayıt reddedilir', async () => {
      const org = await createOrgWithCustomer(app, adminToken, { seatLimit: 2 });

      const second = await call(app, 'POST', '/auth/activate', {
        body: {
          licenseKey: org.licenseKey,
          email: `${unique('ikinci')}@test.local`,
          name: 'İkinci Kullanıcı',
          password: 'Test1234!',
        },
      });
      expect(second.status).toBe(200);

      const third = await call(app, 'POST', '/auth/activate', {
        body: {
          licenseKey: org.licenseKey,
          email: `${unique('ucuncu')}@test.local`,
          name: 'Üçüncü Kullanıcı',
          password: 'Test1234!',
        },
      });
      expect(third.status).toBe(403);
    });

    it('anahtar yenilenince eskisi geçersiz olur', async () => {
      const org = await createOrgWithCustomer(app, adminToken);

      await call(app, 'POST', `/orgs/${org.orgId}/license/rotate`, { token: adminToken });

      const withOldKey = await call(app, 'POST', '/auth/activate', {
        body: {
          licenseKey: org.licenseKey,
          email: `${unique('eski')}@test.local`,
          name: 'Eski Anahtar',
          password: 'Test1234!',
        },
      });
      expect(withOldKey.status).toBe(401);
    });

    it('firma devre dışıyken aktivasyon reddedilir', async () => {
      const org = await createOrgWithCustomer(app, adminToken);

      await call<Organization>(app, 'PATCH', `/orgs/${org.orgId}`, {
        token: adminToken,
        body: { isActive: false },
      });

      const result = await call(app, 'POST', '/auth/activate', {
        body: {
          licenseKey: org.licenseKey,
          email: `${unique('pasif')}@test.local`,
          name: 'Pasif Firma',
          password: 'Test1234!',
        },
      });
      expect(result.status).toBe(403);
    });

    it('ham anahtar yalnızca oluşturma cevabında döner, listede maskelenir', async () => {
      const org = await createOrgWithCustomer(app, adminToken);

      const list = await call<Organization[]>(app, 'GET', '/orgs', { token: adminToken });
      const found = list.body.find((o) => o.id === org.orgId);

      expect(JSON.stringify(list.body)).not.toContain(org.licenseKey);
      expect(found?.licenseSuffix).toHaveLength(4);
    });
  });

  describe('Oturum', () => {
    it('token olmadan istek 401 döner', async () => {
      expect((await call(app, 'GET', '/tickets')).status).toBe(401);
    });

    it('kullanıcı pasifleştirilince refresh token geçersiz olur', async () => {
      const org = await createOrgWithCustomer(app, adminToken);

      const login = await call<AuthResponse>(app, 'POST', '/auth/login', {
        body: { email: (await prisma.user.findFirstOrThrow({ where: { orgId: org.orgId } })).email, password: 'Test1234!' },
      });
      expect(login.status).toBe(200);

      await call(app, 'PATCH', `/users/${org.customerId}`, {
        token: adminToken,
        body: { isActive: false },
      });

      const refresh = await call(app, 'POST', '/auth/refresh', {
        body: { refreshToken: login.body.refreshToken },
      });
      expect(refresh.status).toBe(401);
    });
  });
});
