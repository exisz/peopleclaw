import { Router } from 'express';
import { getPrisma } from '../lib/prisma.js';

export const healthRouter = Router();

// Lightweight liveness — fast, no external calls.
healthRouter.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now(), service: 'peopleclaw-admin' });
});

// Deep readiness — pings DB + Logto, reports config presence (PLANET-912 item 7).
// Returns 200 if DB ok, 503 if DB unreachable. Logto/Stripe are reported but never block.
healthRouter.get('/health/ready', async (_req, res) => {
  const checks: Record<string, { ok: boolean; ms?: number; error?: string; note?: string }> = {};

  // DB ping
  const tDb = Date.now();
  try {
    const prisma = getPrisma();
    await prisma.$queryRawUnsafe('SELECT 1');
    checks.db = { ok: true, ms: Date.now() - tDb };
  } catch (e) {
    checks.db = { ok: false, ms: Date.now() - tDb, error: e instanceof Error ? e.message : String(e) };
  }

  // Logto ping (OIDC discovery)
  const logtoEndpoint = process.env.LOGTO_ENDPOINT || process.env.VITE_LOGTO_ENDPOINT;
  if (logtoEndpoint) {
    const tLogto = Date.now();
    try {
      const r = await fetch(`${logtoEndpoint.replace(/\/$/, '')}/oidc/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(2500),
      });
      checks.logto = r.ok
        ? { ok: true, ms: Date.now() - tLogto }
        : { ok: false, ms: Date.now() - tLogto, error: `HTTP ${r.status}` };
    } catch (e) {
      checks.logto = { ok: false, ms: Date.now() - tLogto, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    checks.logto = { ok: false, note: 'LOGTO_ENDPOINT not set' };
  }

  // Stripe key presence (no API call — keys may be live)
  checks.stripe = {
    ok: Boolean(process.env.STRIPE_SECRET_KEY),
    note: process.env.STRIPE_WEBHOOK_SECRET ? 'webhook secret set' : 'webhook secret MISSING',
  };

  const dbOk = checks.db.ok === true;
  res.status(dbOk ? 200 : 503).json({
    ok: dbOk,
    ts: Date.now(),
    service: 'peopleclaw-admin',
    checks,
  });
});
