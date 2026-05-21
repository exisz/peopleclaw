import crypto from 'node:crypto';
import type { ExternalAgentKey, Tenant, App } from '../generated/prisma/index.js';
import { parseStoredExternalAgentScopes, type ExternalAgentScope } from './externalAgentSafety.js';

export const EXTERNAL_AGENT_TOKEN_PREFIX = 'pc_m2m';

export type ExternalAgentTokenRecord = Pick<ExternalAgentKey, 'id' | 'tenantId' | 'appId' | 'name' | 'prefix' | 'tokenHash' | 'scopes' | 'createdAt' | 'lastUsedAt' | 'revokedAt'> & {
  tenant?: Pick<Tenant, 'id' | 'slug' | 'name'>;
  app?: Pick<App, 'id' | 'name'> | null;
};

export type VerifiedExternalAgent = {
  keyId: string;
  tenantId: string;
  appId: string | null;
  name: string;
  prefix: string;
  scopes: ExternalAgentScope[];
};

export function hashExternalAgentToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function safeCompareTokenHash(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function createExternalAgentToken(): { token: string; prefix: string; tokenHash: string } {
  const prefix = crypto.randomBytes(5).toString('hex');
  const secret = crypto.randomBytes(32).toString('base64url');
  const token = `${EXTERNAL_AGENT_TOKEN_PREFIX}_${prefix}_${secret}`;
  return { token, prefix, tokenHash: hashExternalAgentToken(token) };
}

export function extractExternalAgentTokenPrefix(token: string): string | null {
  const match = /^pc_m2m_([a-f0-9]{10})_([A-Za-z0-9_-]{24,})$/.exec(token);
  return match?.[1] ?? null;
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  return authHeader.slice(7).trim();
}

export function verifyExternalAgentTokenRecord(token: string, record: ExternalAgentTokenRecord): VerifiedExternalAgent {
  if (record.revokedAt) throw new Error('external agent token has been revoked');
  if (extractExternalAgentTokenPrefix(token) !== record.prefix) throw new Error('external agent token prefix mismatch');
  const presentedHash = hashExternalAgentToken(token);
  if (!safeCompareTokenHash(presentedHash, record.tokenHash)) throw new Error('invalid external agent token');
  return {
    keyId: record.id,
    tenantId: record.tenantId,
    appId: record.appId ?? null,
    name: record.name,
    prefix: record.prefix,
    scopes: parseStoredExternalAgentScopes(record.scopes),
  };
}

export function publicExternalAgentKey(record: ExternalAgentTokenRecord) {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    tenantId: record.tenantId,
    appId: record.appId ?? null,
    scopes: parseStoredExternalAgentScopes(record.scopes),
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    revokedAt: record.revokedAt,
    app: record.app ? { id: record.app.id, name: record.app.name } : null,
  };
}
