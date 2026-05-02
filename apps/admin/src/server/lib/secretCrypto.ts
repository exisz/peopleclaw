/**
 * Per-App secret crypto (PLANET-1458).
 * AES-256-GCM with key from SECRETS_ENCRYPTION_KEY (base64-encoded 32 bytes).
 * Format: iv_b64:authTag_b64:ciphertext_b64
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const k = process.env.SECRETS_ENCRYPTION_KEY;
  if (!k) {
    throw new Error('SECRETS_ENCRYPTION_KEY env var required (base64 32 bytes)');
  }
  const buf = Buffer.from(k, 'base64');
  if (buf.length !== 32) {
    throw new Error(`SECRETS_ENCRYPTION_KEY must be 32 bytes when base64-decoded, got ${buf.length}`);
  }
  cachedKey = buf;
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

export function decrypt(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted payload');
  const [ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]);
  return pt.toString('utf8');
}

export function encryptSecretsBag(bag: Record<string, string>): string {
  return encrypt(JSON.stringify(bag));
}

export function decryptSecretsBag(payload: string | null | undefined): Record<string, string> {
  if (!payload) return {};
  try {
    const parsed = JSON.parse(decrypt(payload));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      // ensure all values are strings
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') out[k] = v;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}
