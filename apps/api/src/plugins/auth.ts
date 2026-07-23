import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import type { Role } from '@ticket/shared';
import { verifyAccessToken } from '../lib/tokens.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  /** CUSTOMER için dolu, AGENT/ADMIN için null. */
  orgId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
  interface FastifyInstance {
    auth: preHandlerHookHandler;
    requireRole: (...roles: Role[]) => preHandlerHookHandler;
  }
}

/** Bearer token'ı doğrular ve `request.user`'ı doldurur. */
async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized();
  }
  const payload = await verifyAccessToken(header.slice(7).trim());
  request.user = { id: payload.sub, role: payload.role, orgId: payload.orgId };
}

export const authPlugin = fp(async (app) => {
  app.decorate('auth', authenticate);

  /**
   * Rol kontrolü tek yerde. Route'larda `preHandler: app.requireRole('ADMIN')`
   * şeklinde kullanılır ve kimlik doğrulamayı da kendisi yapar.
   */
  app.decorate('requireRole', (...roles: Role[]): preHandlerHookHandler => {
    return async function roleGuard(request, reply) {
      await authenticate(request, reply);
      if (!roles.includes(request.user!.role)) {
        throw forbidden();
      }
    };
  });
});

/** İstek sahibinin destek ekibinden olup olmadığı — her yerde tekrarlanan kontrol. */
export function isStaff(user: AuthenticatedUser): boolean {
  return user.role === 'AGENT' || user.role === 'ADMIN';
}

export function requireUser(request: FastifyRequest): AuthenticatedUser {
  if (!request.user) throw unauthorized();
  return request.user;
}
