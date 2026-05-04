/**
 * PLANET-1461: Shopify Connector via App.secrets (no core special path).
 *
 * E2E (API-driven, no UI):
 *  1. Mint tenant, create starter-app from template.
 *  2. Verify the 'Shopify Connector' BACKEND component exists with isExported=true.
 *  3. Configure App.secrets SHOPIFY_ADMIN_TOKEN + SHOPIFY_SHOP_DOMAIN with real
 *     dev creds (from SHOPIFY_DEV_SHOP / SHOPIFY_DEV_ADMIN_TOKEN env injected
 *     into the e2e job by the workflow).
 *  4. POST /run on connector with method=listProducts → expect ok:true and
 *     products: [...] (≥1 product, since we point at the real dev shop).
 *  5. POST /run on FULLSTACK 'Shopify 商品列表' → expect server result has
 *     ok:true and products: [...] (the FULLSTACK fans out to connector via
 *     ctx.callApp, exercising PLANET-1459 + PLANET-1458 + PLANET-1461 e2e).
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://app.peopleclaw.rollersoft.com.au';
const E2E_SECRET = process.env.E2E_SECRET ?? '';
const DEV_SHOP = (process.env.SHOPIFY_DEV_SHOP ?? '').trim();
const DEV_TOKEN = (process.env.SHOPIFY_DEV_ADMIN_TOKEN ?? '').replace(/\\n$/, '').trim();
const DEV_CLIENT_ID = (process.env.SHOPIFY_DEV_CLIENT_ID ?? '').trim();
const DEV_CLIENT_SECRET = (process.env.SHOPIFY_DEV_CLIENT_SECRET ?? '').trim();

interface MintResult { accessToken: string; sub: string }

async function mintToken(email: string): Promise<MintResult> {
  const res = await fetch(`${BASE_URL}/api/internal/e2e-mint-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-E2E-Secret': E2E_SECRET },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`mint failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<MintResult>;
}

async function api<T = any>(token: string, method: string, path: string, body?: any): Promise<{ status: number; json: T }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { _raw: text }; }
  return { status: res.status, json: json as T };
}

async function runAndCollect(token: string, componentId: string, body: any): Promise<{ status: number; result: any; error?: any; probes: any[] }> {
  const res = await fetch(`${BASE_URL}/api/components/${componentId}/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (res.status !== 200) {
    return { status: res.status, result: null, probes: [], error: await res.text() };
  }
  const text = await res.text();
  let result: any = null; let error: any = null;
  const probes: any[] = [];
  for (const block of text.split('\n\n')) {
    if (!block.trim()) continue;
    let event = 'message'; let data = '';
    for (const ln of block.split('\n')) {
      if (ln.startsWith('event:')) event = ln.slice(6).trim();
      else if (ln.startsWith('data:')) data += ln.slice(5).trim();
    }
    try {
      const parsed = JSON.parse(data);
      if (event === 'result') result = parsed;
      else if (event === 'error') error = parsed;
      else if (event === 'probe') probes.push(parsed);
    } catch { /* ignore */ }
  }
  return { status: 200, result, error, probes };
}

test.describe('PLANET-1461: Shopify Connector via App.secrets', () => {
  test.skip(!E2E_SECRET, 'E2E_SECRET not set');

  test('starter-app provisions exported Shopify Connector + FULLSTACK fan-out works', async () => {
    test.setTimeout(120_000);

    const email = `planet1461-${Date.now()}@e2e.test`;
    const t = await mintToken(email);

    // 1. create starter-app
    const created = await api<{ app: { id: string; name: string } }>(
      t.accessToken,
      'POST',
      '/api/apps/from-template',
      { templateId: 'starter-app' },
    );
    expect(created.status, JSON.stringify(created.json)).toBe(200);
    const appId = created.json.app.id;

    // 2. inspect components
    const appResp = await api<{ app: { components: any[] } }>(
      t.accessToken,
      'GET',
      `/api/apps/${appId}`,
    );
    expect(appResp.status).toBe(200);
    const comps = appResp.json.app.components;
    const connector = comps.find((c) => c.name === 'Shopify Connector');
    const fullstack = comps.find((c) => c.name === 'Shopify 商品列表');
    expect(connector, '"Shopify Connector" component must exist').toBeTruthy();
    expect(fullstack, '"Shopify 商品列表" FULLSTACK must exist').toBeTruthy();
    expect(connector!.type).toBe('BACKEND');
    expect(connector!.isExported).toBe(true);

    // 3a. without secrets configured manually (auto-seed may or may not have
    // populated them, depending on whether SHOPIFY_DEV_* is set on prod env).
    // First, run the connector and accept either NEED_SETUP or ok:true; this
    // just proves the secret-driven path is wired (we don't rely on auto-seed).
    const beforeRun = await runAndCollect(t.accessToken, connector!.id, { method: 'listProducts' });
    expect(beforeRun.status).toBe(200);
    expect(beforeRun.result).toBeTruthy();
    // Either: secrets present (auto-seeded by env on prod) → ok:true
    //     or: no secrets → ok:false NEED_SETUP
    expect(['NEED_SETUP', undefined]).toContain(beforeRun.result.error);

    // 3b. Force secrets via API (overrides any auto-seed; ensures deterministic test).
    if (DEV_SHOP && DEV_TOKEN) {
      const putShop = await api(t.accessToken, 'PUT', `/api/apps/${appId}/secrets`, {
        key: 'SHOPIFY_SHOP_DOMAIN',
        value: DEV_SHOP,
      });
      expect(putShop.status, JSON.stringify(putShop.json)).toBe(200);
      const putTok = await api(t.accessToken, 'PUT', `/api/apps/${appId}/secrets`, {
        key: 'SHOPIFY_ADMIN_TOKEN',
        value: DEV_TOKEN,
      });
      expect(putTok.status, JSON.stringify(putTok.json)).toBe(200);

      // 4. run connector → expect real products
      const ran = await runAndCollect(t.accessToken, connector!.id, { method: 'listProducts' });
      expect(ran.status).toBe(200);
      expect(ran.result, JSON.stringify(ran)).toBeTruthy();
      expect(ran.result.ok, JSON.stringify(ran.result)).toBe(true);
      expect(Array.isArray(ran.result.products)).toBe(true);
      expect(ran.result.products.length, 'real Shopify dev shop should return ≥1 product').toBeGreaterThanOrEqual(1);

      // 5. run FULLSTACK 'Shopify 商品列表' → expect ok:true via callApp
      const ranFs = await runAndCollect(t.accessToken, fullstack!.id, {});
      expect(ranFs.status).toBe(200);
      expect(ranFs.result, JSON.stringify(ranFs)).toBeTruthy();
      expect(ranFs.result.ok, JSON.stringify(ranFs.result)).toBe(true);
      expect(Array.isArray(ranFs.result.products)).toBe(true);
      expect(ranFs.result.products.length).toBeGreaterThanOrEqual(1);
    } else {
      console.warn('[PLANET-1461] SHOPIFY_DEV_SHOP / SHOPIFY_DEV_ADMIN_TOKEN not set on e2e job — skipping live API portion.');
    }
  });

  test('PLANET-1579: on-demand refresh recovers from expired admin token via client_credentials', async () => {
    test.skip(!DEV_SHOP || !DEV_CLIENT_ID || !DEV_CLIENT_SECRET, 'live Shopify dev creds (shop + client_id + client_secret) required');
    test.setTimeout(120_000);

    const email = `planet1579-${Date.now()}@e2e.test`;
    const t = await mintToken(email);

    const created = await api<{ app: { id: string } }>(
      t.accessToken,
      'POST',
      '/api/apps/from-template',
      { templateId: 'starter-app' },
    );
    expect(created.status, JSON.stringify(created.json)).toBe(200);
    const appId = created.json.app.id;

    const appResp = await api<{ app: { components: any[] } }>(
      t.accessToken,
      'GET',
      `/api/apps/${appId}`,
    );
    const connector = appResp.json.app.components.find((c: any) => c.name === 'Shopify Connector');
    expect(connector).toBeTruthy();

    // Force shop + bogus admin token + real client creds + an expired stamp.
    // The connector should detect the expiry, mint a new token via
    // client_credentials, persist it through ctx.updateAppSecrets, and
    // successfully list products.
    for (const [k, v] of [
      ['SHOPIFY_SHOP_DOMAIN', DEV_SHOP],
      ['SHOPIFY_ADMIN_TOKEN', 'shpca_obviously_invalid_token_to_force_refresh'],
      ['SHOPIFY_TOKEN_EXPIRES_AT', new Date(Date.now() - 60_000).toISOString()],
      ['SHOPIFY_CLIENT_ID', DEV_CLIENT_ID],
      ['SHOPIFY_CLIENT_SECRET', DEV_CLIENT_SECRET],
    ] as const) {
      const put = await api(t.accessToken, 'PUT', `/api/apps/${appId}/secrets`, { key: k, value: v });
      expect(put.status, JSON.stringify(put.json)).toBe(200);
    }

    const ran = await runAndCollect(t.accessToken, connector!.id, { method: 'listProducts' });
    expect(ran.status).toBe(200);
    expect(ran.result, JSON.stringify(ran)).toBeTruthy();
    expect(ran.result.ok, JSON.stringify(ran.result)).toBe(true);
    expect(Array.isArray(ran.result.products)).toBe(true);
    expect(ran.result.products.length).toBeGreaterThanOrEqual(1);

    // Verify the persisted bag now contains a fresh expiry (sanity: the
    // GET endpoint only returns key names, but at minimum the secret keys
    // we set should still exist).
    const keysResp = await api<{ keys: string[] }>(t.accessToken, 'GET', `/api/apps/${appId}/secrets`);
    expect(keysResp.status).toBe(200);
    expect(keysResp.json.keys).toEqual(
      expect.arrayContaining([
        'SHOPIFY_ADMIN_TOKEN',
        'SHOPIFY_CLIENT_ID',
        'SHOPIFY_CLIENT_SECRET',
        'SHOPIFY_SHOP_DOMAIN',
        'SHOPIFY_TOKEN_EXPIRES_AT',
      ]),
    );
  });

  test('PLANET-1579: missing creds still surfaces NEED_SETUP (no permanent 401)', async () => {
    test.setTimeout(60_000);

    const email = `planet1579-empty-${Date.now()}@e2e.test`;
    const t = await mintToken(email);

    const created = await api<{ app: { id: string } }>(
      t.accessToken,
      'POST',
      '/api/apps/from-template',
      { templateId: 'starter-app' },
    );
    expect(created.status).toBe(200);
    const appId = created.json.app.id;

    const appResp = await api<{ app: { components: any[] } }>(
      t.accessToken,
      'GET',
      `/api/apps/${appId}`,
    );
    const connector = appResp.json.app.components.find((c: any) => c.name === 'Shopify Connector');
    expect(connector).toBeTruthy();

    // Wipe whatever was auto-seeded so we genuinely have no creds.
    for (const k of [
      'SHOPIFY_SHOP_DOMAIN',
      'SHOPIFY_ADMIN_TOKEN',
      'SHOPIFY_CLIENT_ID',
      'SHOPIFY_CLIENT_SECRET',
      'SHOPIFY_TOKEN_EXPIRES_AT',
    ]) {
      await api(t.accessToken, 'DELETE', `/api/apps/${appId}/secrets/${k}`);
    }

    const ran = await runAndCollect(t.accessToken, connector!.id, { method: 'listProducts' });
    expect(ran.status).toBe(200);
    expect(ran.result, JSON.stringify(ran)).toBeTruthy();
    expect(ran.result.ok).toBe(false);
    expect(ran.result.error).toBe('NEED_SETUP');
  });
});
