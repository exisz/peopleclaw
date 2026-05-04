/**
 * ctx.updateAppSecrets — generic per-App secret updater (PLANET-1579).
 *
 * Core primitive, NOT a Shopify-specific path (§1.4 compliant). Any connector
 * template that needs to persist refreshed credentials (OAuth access tokens,
 * rotated API keys, refresh-token grants, etc.) calls
 *   await ctx.updateAppSecrets({ KEY: 'value', ... })
 * to merge updates into the App's encrypted secrets bag.
 *
 * Writes are tenant-isolated (the helper is built from the running component's
 * App row and only ever updates that one App).
 *
 * After a successful update, ctx.secrets in the **current** invocation is also
 * mutated in-place so that the connector can use the fresh value immediately
 * without re-loading.
 */
import { getPrisma } from './prisma.js';
import { decryptSecretsBag, encryptSecretsBag } from './secretCrypto.js';

export type UpdateAppSecretsFn = (updates: Record<string, string>) => Promise<{
  ok: boolean;
  keys: string[];
}>;

export interface BuildUpdateAppSecretsArgs {
  appId: string;
  /** Live secrets bag handed to the running component; mutated on success so
   *  the caller sees the new value without re-reading. */
  liveSecrets?: Record<string, string>;
}

export function buildUpdateAppSecretsCtx({
  appId,
  liveSecrets,
}: BuildUpdateAppSecretsArgs): UpdateAppSecretsFn {
  return async function updateAppSecrets(updates) {
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new Error('updateAppSecrets: updates must be an object');
    }
    // Validate keys + values mirror appSecrets PUT route.
    const VALID_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
    const sanitized: Record<string, string> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (!VALID_KEY.test(k)) {
        throw new Error(`updateAppSecrets: invalid key "${k}"`);
      }
      if (typeof v !== 'string') {
        throw new Error(`updateAppSecrets: value for "${k}" must be a string`);
      }
      if (v.length > 16_384) {
        throw new Error(`updateAppSecrets: value for "${k}" too large (max 16KB)`);
      }
      sanitized[k] = v;
    }

    const prisma = getPrisma();
    const app = await prisma.app.findUnique({ where: { id: appId } });
    if (!app) throw new Error('updateAppSecrets: app not found');

    let bag: Record<string, string> = {};
    try {
      bag = decryptSecretsBag(app.secrets);
    } catch {
      bag = {};
    }
    Object.assign(bag, sanitized);
    const encrypted = encryptSecretsBag(bag);
    await prisma.app.update({
      where: { id: appId },
      data: { secrets: encrypted },
    });

    // Mutate the live ctx.secrets bag so the caller sees the new value
    // without round-tripping (e.g. retry an HTTP call with the fresh token).
    if (liveSecrets && typeof liveSecrets === 'object') {
      Object.assign(liveSecrets, sanitized);
    }

    return { ok: true, keys: Object.keys(bag).sort() };
  };
}
