/**
 * Starter App — store/catalog starter (PLANET-1428, refactored under PLANET-1461).
 *
 * Creates a usable Shopify product browser starter app. Implementation pieces
 * stay behind the app shell; users see the app, not platform internals.
 *
 * Core no longer has any Shopify-specific code path (PLANET-1463).
 */
import type { AppTemplate } from './ecommerce-starter.js';

/**
 * Shopify Connector (BACKEND, isExported=true) — PLANET-1461 / PLANET-1579.
 * Reads creds from ctx.secrets, talks to Shopify Admin REST. When the access
 * token is missing/expired or returns 401, refreshes via OAuth
 * client_credentials and persists the new token through ctx.updateAppSecrets.
 *
 * input.method: 'listProducts' | 'createProduct' | 'updateProduct'
 */
const SHOPIFY_CONNECTOR_CODE = `function normalizeShopDomain(s: string): string {
  let v = (s || '').trim();
  if (!v) return v;
  if (!v.includes('.')) v = v + '.myshopify.com';
  return v;
}

async function shopifyFetch(shop: string, token: string, path: string, init: any = {}) {
  const url = 'https://' + shop + '/admin/api/2024-10/' + String(path).replace(/^\\//, '');
  const headers = Object.assign(
    { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    init.headers || {},
  );
  return fetch(url, Object.assign({}, init, { headers }));
}

/**
 * OAuth client_credentials exchange against Shopify Admin. Returns the new
 * access token + ISO expiry, or throws on failure. Pure connector logic — no
 * core dependency. Persistence is the caller's job (via ctx.updateAppSecrets).
 */
async function exchangeShopifyToken(shop: string, clientId: string, clientSecret: string) {
  const r = await fetch('https://' + shop + '/admin/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error('shopify_exchange_failed: ' + r.status + ' ' + body.slice(0, 200));
  }
  const data: any = await r.json();
  if (!data || !data.access_token) {
    throw new Error('shopify_exchange_failed: missing access_token');
  }
  const expiresIn = (typeof data.expires_in === 'number' && data.expires_in > 0) ? data.expires_in : 86400;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  return { token: data.access_token as string, expiresAt };
}

export default async function run(input: any, ctx: any) {
  const rawShop = ctx?.secrets?.SHOPIFY_SHOP_DOMAIN || '';
  const clientId = ctx?.secrets?.SHOPIFY_CLIENT_ID || '';
  const clientSecret = ctx?.secrets?.SHOPIFY_CLIENT_SECRET || '';
  let token = ctx?.secrets?.SHOPIFY_ADMIN_TOKEN || '';
  const tokenExpiresAt = ctx?.secrets?.SHOPIFY_TOKEN_EXPIRES_AT || '';

  function safeConnectorMessage(value: any): string {
    let text = value && value.message ? String(value.message) : String(value || '');
    for (const secret of [token, clientSecret, clientId]) {
      if (secret && String(secret).length >= 6) text = text.split(String(secret)).join('[redacted]');
    }
    return text
      .replace(/shpat_[A-Za-z0-9_\-]+/g, '[redacted]')
      .replace(/shpca_[A-Za-z0-9_\-]+/g, '[redacted]')
      .replace(/(access[_-]?token["'\\s:=]+)[^"'\\s,}]+/gi, '$1[redacted]')
      .replace(/(client[_-]?secret["'\\s:=]+)[^"'\\s,}]+/gi, '$1[redacted]')
      .slice(0, 300);
  }

  if (!rawShop) {
    return {
      ok: false,
      error: 'NEED_SETUP',
      message: 'Connect your Shopify store before loading products.',
    };
  }

  // If no token at all but client creds present → can mint one. If neither
  // token nor client creds → genuine NEED_SETUP.
  if (!token && !(clientId && clientSecret)) {
    return {
      ok: false,
      error: 'NEED_SETUP',
      message: 'Connect your Shopify store before loading products.',
    };
  }

  const shop = normalizeShopDomain(rawShop);

  const canRefresh = Boolean(clientId && clientSecret && typeof ctx?.updateAppSecrets === 'function');

  // Pre-emptive refresh: if the stored expiry is in the past (or within 60s),
  // mint a new token before making the API call. Only when client creds and
  // the platform updater are available.
  if (canRefresh) {
    const expMs = tokenExpiresAt ? Date.parse(tokenExpiresAt) : NaN;
    const expired = !token || (Number.isFinite(expMs) && expMs - Date.now() < 60_000);
    if (expired) {
      try {
        const exch = await exchangeShopifyToken(shop, clientId, clientSecret);
        token = exch.token;
        await ctx.updateAppSecrets({
          SHOPIFY_ADMIN_TOKEN: exch.token,
          SHOPIFY_TOKEN_EXPIRES_AT: exch.expiresAt,
        });
      } catch (e: any) {
        return { ok: false, error: 'SHOPIFY_REFRESH_FAILED', recoverable: true, message: safeConnectorMessage(e) };
      }
    }
  }

  if (!token) {
    // No token, no successful refresh path. Surface NEED_SETUP rather than 401.
    return {
      ok: false,
      error: 'NEED_SETUP',
      message: 'Shopify access token unavailable; configure SHOPIFY_ADMIN_TOKEN or client_credentials.',
    };
  }

  const method = (input && input.method) || 'listProducts';

  /**
   * Run a Shopify call once; if it returns 401 and we have client_credentials,
   * refresh the token and retry exactly once. Returns the final Response.
   */
  async function callWithRetry(doCall: (tok: string) => Promise<Response>): Promise<Response> {
    let r = await doCall(token);
    if (r.status === 401 && canRefresh) {
      try {
        const exch = await exchangeShopifyToken(shop, clientId, clientSecret);
        token = exch.token;
        await ctx.updateAppSecrets({
          SHOPIFY_ADMIN_TOKEN: exch.token,
          SHOPIFY_TOKEN_EXPIRES_AT: exch.expiresAt,
        });
        r = await doCall(token);
      } catch (e) {
        // Fall through with the original 401.
      }
    }
    return r;
  }
  try {
    if (method === 'listProducts') {
      const limit = (input && input.limit) || 20;
      const r = await callWithRetry((tok) => shopifyFetch(shop, tok, 'products.json?limit=' + limit));
      if (!r.ok) {
        const body = await r.text();
        return { ok: false, error: 'SHOPIFY_HTTP_' + r.status, recoverable: true, message: safeConnectorMessage(body) };
      }
      const data: any = await r.json();
      const products = (data.products || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        image: (p.images && p.images[0] && p.images[0].src) || null,
        price: (p.variants && p.variants[0] && p.variants[0].price) || '0.00',
      }));
      return { ok: true, products };
    }
    if (method === 'createProduct') {
      const product = (input && input.product) || {};
      const r = await callWithRetry((tok) => shopifyFetch(shop, tok, 'products.json', {
        method: 'POST',
        body: JSON.stringify({ product }),
      }));
      const data: any = await r.json();
      return r.ok ? { ok: true, product: data.product } : { ok: false, error: 'SHOPIFY_HTTP_' + r.status, recoverable: true, message: safeConnectorMessage(JSON.stringify(data)) };
    }
    if (method === 'updateProduct') {
      const id = input && input.id;
      const product = (input && input.product) || {};
      if (!id) return { ok: false, error: 'BAD_INPUT', message: 'id required for updateProduct' };
      const r = await callWithRetry((tok) => shopifyFetch(shop, tok, 'products/' + id + '.json', {
        method: 'PUT',
        body: JSON.stringify({ product: Object.assign({ id }, product) }),
      }));
      const data: any = await r.json();
      return r.ok ? { ok: true, product: data.product } : { ok: false, error: 'SHOPIFY_HTTP_' + r.status, recoverable: true, message: safeConnectorMessage(JSON.stringify(data)) };
    }
    return { ok: false, error: 'UNKNOWN_METHOD', message: 'method must be listProducts|createProduct|updateProduct' };
  } catch (e: any) {
    return { ok: false, error: 'EXCEPTION', recoverable: true, message: safeConnectorMessage(e) };
  }
}
`;

/**
 * 'Shopify 商品列表' — FULLSTACK. Calls the Shopify Connector via ctx.callApp
 * and renders either a product grid (ok:true) or a setup CTA (NEED_SETUP).
 *
 * The connector component id is injected via ctx.input.connectorComponentId so
 * we don't have to hardcode anything. The starter-app provisioner stamps both
 * IDs into a per-template `code` placeholder __CONNECTOR_ID__ at create time.
 */
const FULLSTACK_CODE_TEMPLATE = `// --- SERVER ---
export async function server(ctx: any) {
  const appId = ctx?.app?.id || ctx?.appId || '__APP_ID__';
  const connectorId = '__CONNECTOR_ID__';
  let result: any = null;
  try {
    if (typeof ctx.callApp === 'function') {
      result = await ctx.callApp(appId, connectorId, { method: 'listProducts' });
    } else {
      result = { ok: false, error: 'NO_CALLAPP', message: 'ctx.callApp not available' };
    }
  } catch (e: any) {
    result = { ok: false, error: 'CALLAPP_THREW', message: e?.message || String(e) };
  }
  if (result && result.ok) {
    return { ok: true, products: result.products || [] };
  }
  return { ok: false, error: result?.error || 'UNKNOWN', message: result?.message || '' };
}

// --- CLIENT ---
export function Client({ data }: { data: any }) {
  if (data && data.ok === false) {
    const isSetup = data.error === 'NEED_SETUP';
    return (
      <div data-testid="shopify-list-state" data-state={isSetup ? 'need-setup' : 'error'} style={{ padding: '1.5rem', fontFamily: 'system-ui', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <h2>🛍️ Product Browser</h2>
        {isSetup ? (
          <>
            <p style={{ color: '#444', margin: '1rem 0' }}>Connect your store to load products.</p>
            <button
              data-testid="shopify-setup-cta"
              onClick={() => { try { window.parent.postMessage({ type: 'open-secrets-tab' }, '*'); } catch {} }}
              style={{ padding: '0.75rem 1.5rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 6, fontSize: '1rem', cursor: 'pointer' }}
            >
              Connect store
            </button>
            <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '1rem' }}>
              Add your store credentials in setup, then refresh this app.
            </p>
          </>
        ) : (
          <p style={{ color: '#c00', margin: '1rem 0' }}>Store request failed: {data.error}{data.message ? ' — ' + data.message : ''}</p>
        )}
      </div>
    );
  }

  const products = (data && data.products) || [];
  return (
    <div data-testid="shopify-list-state" data-state="ok" style={{ padding: '1rem', fontFamily: 'system-ui' }}>
      <h2>🛍️ Product Browser</h2>
      {products.length === 0 && <p>No products yet</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
        {products.map((p: any) => (
          <div key={p.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
            {p.image && <img src={p.image} alt={p.title} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 4 }} />}
            <p style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.5rem' }}>{p.title}</p>
            <p style={{ color: '#666', fontSize: '0.75rem' }}>\${p.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
`;

export const STARTER_APP_FULLSTACK_CODE_TEMPLATE = FULLSTACK_CODE_TEMPLATE;
export const STARTER_APP_CONNECTOR_NAME = 'Store data source';
export const STARTER_APP_FULLSTACK_NAME = 'Product Browser';

export const starterAppTemplate: AppTemplate = {
  id: 'starter-app',
  name: 'Starter Store App',
  description:
    'A ready product browser you can adapt for a store or catalog.',
  components: [
    {
      name: STARTER_APP_CONNECTOR_NAME,
      type: 'BACKEND',
      icon: '🔌',
      code: SHOPIFY_CONNECTOR_CODE,
      isExported: true,
    },
    {
      name: STARTER_APP_FULLSTACK_NAME,
      type: 'FULLSTACK',
      icon: '🛍️',
      // Will be patched at create time with real {appId, connectorId}.
      code: FULLSTACK_CODE_TEMPLATE,
    },
  ],
};
