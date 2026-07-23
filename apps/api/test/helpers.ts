import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { AuthResponse, LicenseKeyResponse, TicketDetail } from '@ticket/shared';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';

/** Testler arasında çakışmayı önlemek için her kayıt benzersiz bir ek alır. */
export const unique = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

interface CallOptions {
  token?: string;
  body?: unknown;
  query?: Record<string, string>;
}

/**
 * Fastify'ın `inject`'i ile gerçek HTTP katmanından geçer — yetkilendirme
 * preHandler'ları, şema doğrulaması ve serileştirme dahil. Servis
 * fonksiyonlarını doğrudan çağırmak bu katmanları atlardı.
 */
export async function call<T>(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  options: CallOptions = {},
): Promise<{ status: number; body: T }> {
  const response = await app.inject({
    method,
    url,
    query: options.query,
    headers: options.token ? { authorization: `Bearer ${options.token}` } : {},
    payload: options.body as never,
  });

  return {
    status: response.statusCode,
    body: response.body ? (JSON.parse(response.body) as T) : (undefined as T),
  };
}

export async function createAdmin(app: FastifyInstance): Promise<{ token: string; id: string }> {
  const email = `${unique('admin')}@test.local`;
  const user = await prisma.user.create({
    data: { email, name: 'Test Yöneticisi', role: 'ADMIN', passwordHash: await hashPassword('Test1234!') },
  });

  const login = await call<AuthResponse>(app, 'POST', '/auth/login', {
    body: { email, password: 'Test1234!' },
  });

  return { token: login.body.accessToken, id: user.id };
}

/** Firma + o firmaya ait bir müşteri hesabı oluşturur. */
export async function createOrgWithCustomer(
  app: FastifyInstance,
  adminToken: string,
  options: { seatLimit?: number } = {},
): Promise<{ orgId: string; licenseKey: string; customerToken: string; customerId: string }> {
  const org = await call<LicenseKeyResponse>(app, 'POST', '/orgs', {
    token: adminToken,
    body: { name: unique('Firma'), seatLimit: options.seatLimit ?? 10 },
  });

  const email = `${unique('musteri')}@test.local`;
  const activation = await call<AuthResponse>(app, 'POST', '/auth/activate', {
    body: {
      licenseKey: org.body.licenseKey,
      email,
      name: 'Test Müşterisi',
      password: 'Test1234!',
    },
  });

  return {
    orgId: org.body.organization.id,
    licenseKey: org.body.licenseKey,
    customerToken: activation.body.accessToken,
    customerId: activation.body.user.id,
  };
}

export async function createTicket(
  app: FastifyInstance,
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<TicketDetail> {
  const result = await call<TicketDetail>(app, 'POST', '/tickets', {
    token,
    body: {
      title: unique('Test talebi'),
      body: 'Test amaçlı oluşturulmuş bir destek talebi açıklaması.',
      priority: 'NORMAL',
      ...overrides,
    },
  });
  return result.body;
}
