import type { Organization, User } from '@prisma/client';
import type { AuthResponse, SessionUser } from '@ticket/shared';
import { accessTokenTtlSeconds, issueRefreshToken, signAccessToken } from '../../lib/tokens.js';

type UserWithOrg = User & { organization: Organization | null };

export function toSessionUser(user: UserWithOrg): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    orgId: user.orgId,
    orgName: user.organization?.name ?? null,
  };
}

/** Giriş/aktivasyon/refresh sonrası dönen ortak cevap. */
export async function buildAuthResponse(
  user: UserWithOrg,
  opts: { refreshToken?: string; userAgent?: string },
): Promise<AuthResponse> {
  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role,
    orgId: user.orgId,
  });

  const refreshToken = opts.refreshToken ?? (await issueRefreshToken(user.id, opts.userAgent));

  return {
    accessToken,
    refreshToken,
    expiresIn: accessTokenTtlSeconds(),
    user: toSessionUser(user),
  };
}
