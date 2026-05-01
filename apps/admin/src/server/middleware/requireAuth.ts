import type { Request, Response, NextFunction } from 'express';
import { verifyBearer, type VerifiedClaims } from './auth.js';
import { getPrisma } from '../lib/prisma.js';
import type { User } from '../generated/prisma/index.js';
import { suggestSlug, uniqueSlug } from './tenant.js';

export interface AuthedRequest extends Request {
  user: User;
  claims: VerifiedClaims;
}

/**
 * E2E sudo bypass (PLANET-925 P3.16).
 *
 * When `E2E_TEST_TOKEN` env is set, requests carrying:
 *   `Authorization: Sudo <E2E_TEST_TOKEN>`
 *   `X-Sudo-User-Id: <numeric User.id>`
 * skip Logto verification and load `req.user` directly from DB.
 *
 * If the env var is unset OR the token doesn't match, the header is ignored
 * and normal Bearer verification runs. The endpoint that mints sudo sessions
 * (`POST /api/test/sudo-login`) is also gated by the same env var.
 */
async function trySudo(req: Request): Promise<User | null> {
  const sudoEnv = process.env.E2E_TEST_TOKEN;
  if (!sudoEnv) return null;
  const auth = req.header('authorization') || '';
  if (!auth.toLowerCase().startsWith('sudo ')) return null;
  const token = auth.slice(5).trim();
  if (token !== sudoEnv) return null;
  const userIdRaw = req.header('x-sudo-user-id');
  if (!userIdRaw) return null;
  const userId = Number(userIdRaw);
  if (!Number.isFinite(userId)) return null;
  const prisma = getPrisma();
  const u = await prisma.user.findUnique({ where: { id: userId } });
  return u;
}

/**
 * E2E mint-token bypass (PLANET-1427).
 *
 * Recognizes Bearer tokens in format `e2e:{E2E_SECRET}:{logtoId}`.
 * Only active when E2E_SECRET env var is set.
 * Upserts the user row (same as normal auth) so tests work from scratch.
 */
async function tryE2eMint(req: Request): Promise<{ user: User; claims: VerifiedClaims } | null> {
  const e2eSecret = process.env.E2E_SECRET;
  if (!e2eSecret) return null;
  const auth = req.header('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token.startsWith('e2e:')) return null;
  const parts = token.split(':');
  if (parts.length < 3) return null;
  const secret = parts[1];
  const logtoId = parts.slice(2).join(':');
  if (secret !== e2eSecret || !logtoId) return null;

  const prisma = getPrisma();
  const user = await prisma.user.upsert({
    where: { logtoId },
    create: { logtoId, email: 'e2e@peopleclaw.test', visits: 1 },
    update: {},
  });
  // Auto-provision tenant if new
  const hasTenant = await prisma.tenantUser.findFirst({ where: { userId: user.id } });
  if (!hasTenant) {
    const slug = await uniqueSlug(prisma, suggestSlug('e2e@peopleclaw.test', user.id));
    const t = await prisma.tenant.create({
      data: { name: 'E2E Workspace', slug },
    });
    await prisma.tenantUser.create({ data: { tenantId: t.id, userId: user.id, role: 'owner' } });
  }
  return { user, claims: { sub: logtoId } as VerifiedClaims };
}

/**
 * Verifies Bearer token and attaches `req.user` (creating the User row if missing).
 * Responds 401 on failure.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sudoUser = await trySudo(req);
    if (sudoUser) {
      (req as AuthedRequest).user = sudoUser;
      (req as AuthedRequest).claims = { sub: sudoUser.logtoId } as VerifiedClaims;
      next();
      return;
    }
    const e2eResult = await tryE2eMint(req);
    if (e2eResult) {
      (req as AuthedRequest).user = e2eResult.user;
      (req as AuthedRequest).claims = e2eResult.claims;
      next();
      return;
    }
    const claims = await verifyBearer(req.header('authorization'));
    const prisma = getPrisma();
    const email = typeof claims.email === 'string' ? claims.email : null;
    const wasNew = !(await prisma.user.findUnique({ where: { logtoId: claims.sub } }));
    const user = await prisma.user.upsert({
      where: { logtoId: claims.sub },
      create: { logtoId: claims.sub, email, visits: 1 },
      update: { email: email ?? undefined },
    });
    if (wasNew) {
      // Auto-provision a personal tenant for this brand-new user
      const slug = await uniqueSlug(prisma, suggestSlug(email, user.id));
      const t = await prisma.tenant.create({
        data: { name: email ? `${email}'s Workspace` : `Workspace ${user.id}`, slug },
      });
      await prisma.tenantUser.create({ data: { tenantId: t.id, userId: user.id, role: 'owner' } });
    }
    (req as AuthedRequest).user = user;
    (req as AuthedRequest).claims = claims;
    next();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(401).json({ error: msg });
  }
}
