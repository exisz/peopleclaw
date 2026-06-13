import * as crypto from 'node:crypto';

/**
 * Customer token format: `pcv_<base32-ish-id>.<base64url-secret>`.
 * The id is short, public, audit-friendly. The secret is 32 bytes.
 *
 * On disk the broker only stores `id` + `secretHash` (sha-256 of secret).
 */

const ID_BYTES = 6; // 12 hex chars
const SECRET_BYTES = 32;

export function generateToken(): { id: string; secret: string; full: string; secretHash: string } {
  const id = crypto.randomBytes(ID_BYTES).toString('hex');
  const secret = crypto.randomBytes(SECRET_BYTES).toString('base64url');
  const full = `pcv_${id}.${secret}`;
  const secretHash = sha256Hex(secret);
  return { id, secret, full, secretHash };
}

export function parseToken(value: string): { id: string; secret: string } | null {
  if (!value || typeof value !== 'string') return null;
  if (!value.startsWith('pcv_')) return null;
  const rest = value.slice(4);
  const dot = rest.indexOf('.');
  if (dot <= 0 || dot >= rest.length - 1) return null;
  const id = rest.slice(0, dot);
  const secret = rest.slice(dot + 1);
  if (!/^[0-9a-f]+$/i.test(id)) return null;
  return { id, secret };
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
