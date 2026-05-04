/**
 * Starter App — 起步示例 (PLANET-1428, refactored under PLANET-1461)
 *
 * 4 components on one canvas:
 * 1. FRONTEND  'AI 换脸-表单' (file + fields + submit)
 * 2. BACKEND   'AI 换脸-处理' (3-step probe stub)
 * 3. BACKEND   'Shopify Connector' (PLANET-1461 — exported, secret-driven)
 * 4. FULLSTACK 'Shopify 商品列表' (server fetch via ctx.callApp + client grid / setup CTA)
 *
 * Connections: 1→2 TRIGGER, 4→3 DATA_FLOW (商品列表 calls connector at runtime).
 *
 * The Shopify connector reads SHOPIFY_ADMIN_TOKEN + SHOPIFY_SHOP_DOMAIN from
 * App.secrets (PLANET-1458). When secrets are missing it returns
 * { ok: false, error: 'NEED_SETUP' } so the FULLSTACK component can render a
 * setup CTA instead of the broken empty state (PLANET-1465).
 *
 * Core no longer has any Shopify-specific code path (PLANET-1463).
 */
import type { AppTemplate } from './ecommerce-starter.js';

const FRONTEND_CODE = `import { useState } from 'react';

export function Client({ onSubmit }: { onSubmit?: (data: any) => Promise<any> | void }) {
  const [file, setFile] = useState<string | null>(null);
  const [targetFace, setTargetFace] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setFile(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = onSubmit ? await onSubmit({ imageUrl: file, targetFace }) : null;
      if (res) setResult(res);
    } catch (err: any) {
      setError(err.message ?? '处理失败');
    }
    setLoading(false);
  };

  if (result) return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui' }}>
      <h2>🎭 处理完成</h2>
      {result.swappedUrl && <img src={result.swappedUrl} alt="swapped" data-testid="face-swap-result" style={{ width: 240, borderRadius: 8, marginTop: '0.5rem' }} />}
      <p style={{ color: '#666', fontSize: '0.875rem', marginTop: '0.5rem' }}>provider: {result.provider ?? 'unknown'}</p>
      <button onClick={() => { setResult(null); setFile(null); }} style={{ marginTop: '0.5rem', padding: '0.25rem 0.75rem', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>重新开始</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ padding: '1rem', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 360 }}>
      <h2>🎭 AI 换脸 - 上传</h2>
      <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>原始图片</label>
      <input type="file" accept="image/*" onChange={handleFile} data-testid="face-swap-file-input" />
      {file && <img src={file} alt="preview" style={{ width: 160, borderRadius: 8 }} />}
      <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>目标脸型 (可选)</label>
      <input
        name="targetFace"
        placeholder="e.g. celebrity name"
        value={targetFace}
        onChange={e => setTargetFace(e.target.value)}
        style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
      />
      {error && <p style={{ color: 'red', fontSize: '0.875rem' }}>{error}</p>}
      <button
        type="submit"
        disabled={!file || loading}
        data-testid="face-swap-submit-btn"
        style={{ padding: '0.5rem 1rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: file && !loading ? 1 : 0.5 }}
      >
        {loading ? '处理中...' : '提交换脸'}
      </button>
    </form>
  );
}

export default Client;
`;

const BACKEND_CODE = `import { peopleClaw } from '@peopleclaw/sdk';

export default async function run(input: any, ctx: any) {
  await peopleClaw.nodeEntry('uploadOriginal');

  const imageUrl = input?.imageUrl ?? 'https://placekitten.com/400/400';
  const targetFace = input?.targetFace ?? 'default';

  await peopleClaw.nodeEntry('callFaceSwapAPI');

  // TODO: v2 接真 provider (Replicate / fal.ai)
  await new Promise(resolve => setTimeout(resolve, 500));

  await peopleClaw.nodeEntry('saveResult');

  return {
    swappedUrl: imageUrl,
    faceMatched: true,
    provider: 'stub-v1',
    targetFace,
  };
}
`;

/**
 * Shopify Connector (BACKEND, isExported=true) — PLANET-1461 / PLANET-1579.
 * Reads creds from ctx.secrets, talks to Shopify Admin REST. When the access
 * token is missing/expired or returns 401, refreshes via OAuth
 * client_credentials and persists the new token through ctx.updateAppSecrets.
 *
 * input.method: 'listProducts' | 'createProduct' | 'updateProduct'
 */
const SHOPIFY_CONNECTOR_CODE = `import { peopleClaw } from '@peopleclaw/sdk';

function normalizeShopDomain(s: string): string {
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
  await peopleClaw.nodeEntry('readSecrets');
  const rawShop = ctx?.secrets?.SHOPIFY_SHOP_DOMAIN || '';
  const clientId = ctx?.secrets?.SHOPIFY_CLIENT_ID || '';
  const clientSecret = ctx?.secrets?.SHOPIFY_CLIENT_SECRET || '';
  let token = ctx?.secrets?.SHOPIFY_ADMIN_TOKEN || '';
  const tokenExpiresAt = ctx?.secrets?.SHOPIFY_TOKEN_EXPIRES_AT || '';

  if (!rawShop) {
    return {
      ok: false,
      error: 'NEED_SETUP',
      message: '请去 🔐 Secrets tab 配置 SHOPIFY_SHOP_DOMAIN (+ SHOPIFY_ADMIN_TOKEN 或 SHOPIFY_CLIENT_ID/SHOPIFY_CLIENT_SECRET)',
    };
  }

  // If no token at all but client creds present → can mint one. If neither
  // token nor client creds → genuine NEED_SETUP.
  if (!token && !(clientId && clientSecret)) {
    return {
      ok: false,
      error: 'NEED_SETUP',
      message: '请去 🔐 Secrets tab 配置 SHOPIFY_ADMIN_TOKEN 或 (SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET)',
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
        await peopleClaw.nodeEntry('refreshToken');
        const exch = await exchangeShopifyToken(shop, clientId, clientSecret);
        token = exch.token;
        await ctx.updateAppSecrets({
          SHOPIFY_ADMIN_TOKEN: exch.token,
          SHOPIFY_TOKEN_EXPIRES_AT: exch.expiresAt,
        });
      } catch (e: any) {
        return { ok: false, error: 'SHOPIFY_REFRESH_FAILED', message: e?.message || String(e) };
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
        await peopleClaw.nodeEntry('refreshToken');
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

  await peopleClaw.nodeEntry('callShopify');
  try {
    if (method === 'listProducts') {
      const limit = (input && input.limit) || 20;
      const r = await callWithRetry((tok) => shopifyFetch(shop, tok, 'products.json?limit=' + limit));
      if (!r.ok) {
        const body = await r.text();
        return { ok: false, error: 'SHOPIFY_HTTP_' + r.status, message: body.slice(0, 300) };
      }
      const data: any = await r.json();
      const products = (data.products || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        image: (p.images && p.images[0] && p.images[0].src) || null,
        price: (p.variants && p.variants[0] && p.variants[0].price) || '0.00',
      }));
      await peopleClaw.nodeEntry('done');
      return { ok: true, products };
    }
    if (method === 'createProduct') {
      const product = (input && input.product) || {};
      const r = await callWithRetry((tok) => shopifyFetch(shop, tok, 'products.json', {
        method: 'POST',
        body: JSON.stringify({ product }),
      }));
      const data: any = await r.json();
      await peopleClaw.nodeEntry('done');
      return r.ok ? { ok: true, product: data.product } : { ok: false, error: 'SHOPIFY_HTTP_' + r.status, body: data };
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
      await peopleClaw.nodeEntry('done');
      return r.ok ? { ok: true, product: data.product } : { ok: false, error: 'SHOPIFY_HTTP_' + r.status, body: data };
    }
    return { ok: false, error: 'UNKNOWN_METHOD', message: 'method must be listProducts|createProduct|updateProduct' };
  } catch (e: any) {
    return { ok: false, error: 'EXCEPTION', message: e?.message || String(e) };
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
const FULLSTACK_CODE_TEMPLATE = `import { peopleClaw } from '@peopleclaw/sdk';

// --- SERVER ---
export async function server(ctx: any) {
  await peopleClaw.nodeEntry('callConnector');
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
  await peopleClaw.nodeEntry('done');
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
        <h2>🛍️ Shopify 商品列表</h2>
        {isSetup ? (
          <>
            <p style={{ color: '#444', margin: '1rem 0' }}>需要先配置 Shopify 凭证才能拉取商品。</p>
            <button
              data-testid="shopify-setup-cta"
              onClick={() => { try { window.parent.postMessage({ type: 'open-secrets-tab' }, '*'); } catch {} }}
              style={{ padding: '0.75rem 1.5rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 6, fontSize: '1rem', cursor: 'pointer' }}
            >
              🔐 配置 Shopify (去 Secrets tab)
            </button>
            <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '1rem' }}>
              在 🔐 Secrets tab 配置 <code>SHOPIFY_ADMIN_TOKEN</code> 和 <code>SHOPIFY_SHOP_DOMAIN</code>，刷新即可。
            </p>
          </>
        ) : (
          <p style={{ color: '#c00', margin: '1rem 0' }}>调用 Shopify 失败：{data.error}{data.message ? ' — ' + data.message : ''}</p>
        )}
      </div>
    );
  }

  const products = (data && data.products) || [];
  return (
    <div data-testid="shopify-list-state" data-state="ok" style={{ padding: '1rem', fontFamily: 'system-ui' }}>
      <h2>🛍️ Shopify 商品列表</h2>
      {products.length === 0 && <p>商品列表为空</p>}
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
export const STARTER_APP_CONNECTOR_NAME = 'Shopify Connector';
export const STARTER_APP_FULLSTACK_NAME = 'Shopify 商品列表';

export const starterAppTemplate: AppTemplate = {
  id: 'starter-app',
  name: '起步示例 App',
  description:
    'AI 换脸 (表单→后端) + Shopify Connector (secret-driven, exported) + Shopify 商品列表 (调 connector)',
  components: [
    {
      name: 'AI 换脸-表单',
      type: 'FRONTEND',
      icon: '🎭',
      code: FRONTEND_CODE,
      canvasX: 150,
      canvasY: 200,
    },
    {
      name: 'AI 换脸-处理',
      type: 'BACKEND',
      icon: '⚙️',
      code: BACKEND_CODE,
      canvasX: 500,
      canvasY: 200,
    },
    {
      name: STARTER_APP_CONNECTOR_NAME,
      type: 'BACKEND',
      icon: '🔌',
      code: SHOPIFY_CONNECTOR_CODE,
      canvasX: 100,
      canvasY: 450,
      isExported: true,
    },
    {
      name: STARTER_APP_FULLSTACK_NAME,
      type: 'FULLSTACK',
      icon: '🛍️',
      // Will be patched at create time with real {appId, connectorId}.
      code: FULLSTACK_CODE_TEMPLATE,
      canvasX: 450,
      canvasY: 450,
    },
  ],
  connections: [
    { fromIndex: 0, toIndex: 1, type: 'TRIGGER' },
    // FULLSTACK (3) DATA_FLOW from connector (2) — visualizes the runtime call.
    { fromIndex: 2, toIndex: 3, type: 'DATA_FLOW' },
  ],
};
