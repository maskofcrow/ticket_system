import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { accessTokenPayloadSchema, type AccessTokenPayload } from '@ticket/shared';
import { env } from '../env.js';
import { prisma } from './prisma.js';
import { unauthorized } from './errors.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = 'ticket-system';

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role, orgId: payload.orgId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
    return accessTokenPayloadSchema.parse(payload);
  } catch {
    throw unauthorized('Oturum süresi doldu veya token geçersiz');
  }
}

/** Access token TTL'ini saniyeye çevirir ("15m" → 900). İstemci yenilemeyi buna göre planlar. */
export function accessTokenTtlSeconds(): number {
  const match = /^(\d+)([smhd])$/.exec(env.ACCESS_TOKEN_TTL);
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit!] ?? 60);
}

/** Ham refresh token asla saklanmaz — SHA-256 özeti tutulur. */
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueRefreshToken(userId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400_000);

  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashRefreshToken(token), expiresAt, userAgent: userAgent ?? null },
  });

  return token;
}

/**
 * Refresh token rotasyonu: eski token kullanıldığı anda iptal edilir ve yenisi
 * verilir. Çalınmış bir token ikinci kez kullanılamaz.
 */
export async function rotateRefreshToken(token: string, userAgent?: string) {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
    include: { user: { include: { organization: true } } },
  });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw unauthorized('Oturum sona erdi, tekrar giriş yapın');
  }
  if (!record.user.isActive) {
    throw unauthorized('Hesabınız devre dışı bırakılmış');
  }
  // Firma pasifleştirilmişse o firmanın kullanıcıları da giremez.
  if (record.user.organization && !record.user.organization.isActive) {
    throw unauthorized('Firmanızın erişimi devre dışı bırakılmış');
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const newToken = await issueRefreshToken(record.userId, userAgent);
  return { user: record.user, refreshToken: newToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Kullanıcı pasifleştirilince / şifre değişince tüm oturumlarını düşür. */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllOrgTokens(orgId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { user: { orgId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
