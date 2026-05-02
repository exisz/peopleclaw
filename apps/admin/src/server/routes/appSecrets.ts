/**
 * Per-App secret management API (PLANET-1458).
 * Secrets are stored encrypted (AES-256-GCM) in App.secrets as JSON.
 * Values never leave the server through these endpoints — only key names.
 */
import { Router } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { decryptSecretsBag, encryptSecretsBag } from '../lib/secretCrypto.js';

export const appSecretsRouter = Router();

const VALID_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

async function loadOwnedApp(req: any, r: TenantedRequest) {
  const prisma = getPrisma();
  const app = await prisma.app.findFirst({
    where: { id: req.params.appId, tenantId: r.tenant.id },
  });
  return app;
}

// GET /api/apps/:appId/secrets — return only key names
appSecretsRouter.get(
  '/apps/:appId/secrets',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const r = req as unknown as TenantedRequest;
    const app = await loadOwnedApp(req, r);
    if (!app) { res.status(404).json({ error: 'app not found' }); return; }
    let bag: Record<string, string> = {};
    try {
      bag = decryptSecretsBag(app.secrets);
    } catch (err: any) {
      res.status(500).json({ error: 'failed to decrypt secrets', detail: err?.message });
      return;
    }
    res.json({ keys: Object.keys(bag).sort() });
  },
);

// PUT /api/apps/:appId/secrets — upsert one key
appSecretsRouter.put(
  '/apps/:appId/secrets',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const r = req as unknown as TenantedRequest;
    const { key, value } = req.body ?? {};
    if (typeof key !== 'string' || !VALID_KEY.test(key)) {
      res.status(400).json({ error: 'invalid key (must match [A-Za-z_][A-Za-z0-9_]{0,63})' });
      return;
    }
    if (typeof value !== 'string') {
      res.status(400).json({ error: 'value must be a string' });
      return;
    }
    if (value.length > 16_384) {
      res.status(400).json({ error: 'value too large (max 16KB)' });
      return;
    }
    const app = await loadOwnedApp(req, r);
    if (!app) { res.status(404).json({ error: 'app not found' }); return; }
    const prisma = getPrisma();
    let bag: Record<string, string> = {};
    try {
      bag = decryptSecretsBag(app.secrets);
    } catch {
      // corrupted bag → start over (key rotation scenario)
      bag = {};
    }
    bag[key] = value;
    const encrypted = encryptSecretsBag(bag);
    await prisma.app.update({
      where: { id: app.id },
      data: { secrets: encrypted },
    });
    res.json({ ok: true, keys: Object.keys(bag).sort() });
  },
);

// DELETE /api/apps/:appId/secrets/:key
appSecretsRouter.delete(
  '/apps/:appId/secrets/:key',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const r = req as unknown as TenantedRequest;
    const key = req.params.key;
    if (!VALID_KEY.test(key)) {
      res.status(400).json({ error: 'invalid key' });
      return;
    }
    const app = await loadOwnedApp(req, r);
    if (!app) { res.status(404).json({ error: 'app not found' }); return; }
    const prisma = getPrisma();
    let bag: Record<string, string> = {};
    try { bag = decryptSecretsBag(app.secrets); } catch { bag = {}; }
    if (!(key in bag)) {
      res.json({ ok: true, keys: Object.keys(bag).sort() });
      return;
    }
    delete bag[key];
    const encrypted = Object.keys(bag).length > 0 ? encryptSecretsBag(bag) : null;
    await prisma.app.update({
      where: { id: app.id },
      data: { secrets: encrypted },
    });
    res.json({ ok: true, keys: Object.keys(bag).sort() });
  },
);
