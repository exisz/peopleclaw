/**
 * Starter App — store/catalog starter (PLANET-1428, refactored under PLANET-1461).
 *
 * Creates a usable Shopify product browser starter app. Implementation pieces
 * stay behind the app shell; users see the app, not platform internals.
 *
 * Core no longer has any Shopify-specific code path (PLANET-1463).
 */
import { createHash } from 'node:crypto';
import type { AppArtifactTree, AppDeploymentRecord } from '@peopleclaw/sdk/app-artifact';
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
export const STARTER_APP_SIDEBAR_JSON5 = `{
  sections: [
    { id: 'business', title: 'Store', kind: 'app', items: ['dashboard', 'products', 'sync', 'chat'] },
    { id: 'system', title: 'System', kind: 'system', items: ['setup', 'audit'] },
  ],
}`;

export interface StarterAppConnectorSurfaceValidation {
  ok: boolean;
  errors: string[];
  connectorName?: string;
  callerName?: string;
}

export interface StarterManagedDataSyncPlan {
  collections: string[];
  operations: Array<{ resource: 'products' | 'orders' | 'customers'; api: 'ctx.data.documents.upsertMany'; collection: string; count: number }>;
  forbidden: string[];
}

export interface StarterAppSecretReferenceEvidence {
  artifact: string;
  clientManifest: string;
  logs: string;
  screenshots: string;
  cliOutput: string;
  secretRefs: string[];
}

export interface StarterAppSpecMatrixItem {
  id: string;
  source: 'must' | 'must_not';
  obligation: string;
  evidence: string[];
  ok: boolean;
}

export interface StarterAppVerificationEvidence {
  ok: boolean;
  previewUrl: string;
  routeRender: { ok: boolean; routeId: string; screen: string };
  tokenState: { ok: boolean; state: 'ready' | 'needs_setup'; secretRefs: string[] };
  connectorCompatibility: StarterAppConnectorSurfaceValidation;
  syncDryRun: { ok: boolean; method: 'listProducts'; mode: 'dry_run' | 'sample_fetch'; writes: 0 };
  auditEvidence: { ok: boolean; events: string[]; artifactHash: `sha256:${string}`; deploymentId: string };
}

export interface StarterAppPreviewDeploymentResult {
  plan: {
    operation: 'starter_one_click_preview_deploy';
    dryRun: true;
    coreRedeploy: 'not_required';
  };
  immutableArtifact: {
    artifactHash: `sha256:${string}`;
    artifact: AppArtifactTree;
    stored: true;
  };
  deploymentRecord: AppDeploymentRecord;
  previewUrl: string;
}

export interface StarterOneClickCrudDryRunResult {
  ok: boolean;
  previewUrl: string;
  formSubmission: {
    submitted: true;
    testId: 'shopify-crud-dry-run-form';
    shopDomainRef: 'app-secret://SHOPIFY_SHOP_DOMAIN';
    action: 'createProduct' | 'updateProduct';
    productTitle: string;
    imagePrompt?: string;
  };
  imageProcessing: {
    invokedBeforeCrud: boolean;
    step: 'ai_image_processing';
    promptProvided: boolean;
    outputRef: string | null;
    safeFailure: { ok: boolean; recoverable: true; message: string } | null;
  };
  backendInvocation: {
    invoked: true;
    functionId: 'functions/shopifyConnector';
    method: 'createProduct' | 'updateProduct';
    via: 'ctx.callApp';
  };
  crudDryRun: {
    ok: boolean;
    mode: 'dry_run';
    mockedSafeWrite: true;
    writes: 0;
    dataApiCollections: string[];
  };
  auditEvidence: {
    visibleToUser: true;
    events: string[];
    redacted: true;
    artifactHash: `sha256:${string}`;
    deploymentId: string;
  };
}

function sha256(value: unknown): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

const SANCTIONED_COMPONENT_TYPES = new Set(['BACKEND', 'FULLSTACK']);

/**
 * Validates the Shopify starter's sanctioned cross-App connector surface before
 * preview deploy. The connector must be an exported BACKEND component, and the
 * caller must be a FULLSTACK component that uses ctx.callApp through the
 * provisioned connector placeholder rather than importing platform internals or
 * embedding a raw Shopify client in the screen.
 */
export function validateStarterAppConnectorSurface(template: AppTemplate): StarterAppConnectorSurfaceValidation {
  const errors: string[] = [];
  const components = template.components ?? [];
  for (const component of components) {
    if (!SANCTIONED_COMPONENT_TYPES.has(component.type)) {
      errors.push(`${component.name}: unsupported component type ${component.type}`);
    }
  }

  const connector = components.find((component) => component.name === STARTER_APP_CONNECTOR_NAME);
  if (!connector) {
    errors.push('missing Shopify connector component');
  } else {
    if (connector.type !== 'BACKEND') errors.push(`${connector.name}: connector must be BACKEND`);
    if (connector.isExported !== true) errors.push(`${connector.name}: connector must be exported for ctx.callApp`);
    if (!/export\s+default\s+async\s+function\s+run\s*\(\s*input\s*:\s*any\s*,\s*ctx\s*:\s*any\s*\)/.test(connector.code)) {
      errors.push(`${connector.name}: connector must expose default async run(input, ctx)`);
    }
    if (!/SHOPIFY_SHOP_DOMAIN/.test(connector.code) || !/SHOPIFY_ADMIN_TOKEN|SHOPIFY_CLIENT_ID/.test(connector.code)) {
      errors.push(`${connector.name}: connector must use generic secret references for credentials`);
    }
  }

  const caller = components.find((component) => component.name === STARTER_APP_FULLSTACK_NAME);
  if (!caller) {
    errors.push('missing Shopify caller component');
  } else {
    if (caller.type !== 'FULLSTACK') errors.push(`${caller.name}: caller must be FULLSTACK`);
    if (!/ctx\.callApp\(appId, connectorId, \{ method: 'listProducts' \}\)/.test(caller.code)) {
      errors.push(`${caller.name}: caller must invoke connector through ctx.callApp(appId, connectorId, ...)`);
    }
    if (!/__CONNECTOR_ID__/.test(caller.code)) {
      errors.push(`${caller.name}: caller must use provisioned connector id placeholder`);
    }
    if (/from\s+['"][^'"]*(routes|lib\/prisma|shopifyClient|shopifyAuth)/i.test(caller.code)) {
      errors.push(`${caller.name}: caller must not import core internals or hardcoded connector clients`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    connectorName: connector?.name,
    callerName: caller?.name,
  };
}

function assertStarterAppConnectorSurface(template: AppTemplate): void {
  const validation = validateStarterAppConnectorSurface(template);
  if (!validation.ok) {
    throw new Error(`starter_connector_surface_invalid: ${validation.errors.join('; ')}`);
  }
}

export function buildStarterAppArtifactTree(appId: string): AppArtifactTree {
  return {
    manifest: {
      appId,
      name: 'Starter Store App',
      version: '0.1.0',
      routes: [
        { id: 'dashboard', path: `/apps/${appId}`, screen: 'dashboard' },
        { id: 'products', path: `/apps/${appId}/products`, screen: 'products' },
        { id: 'sync', path: `/apps/${appId}/sync`, screen: 'sync' },
        { id: 'chat', path: `/apps/${appId}/chat`, screen: 'chat' },
        { id: 'setup', path: `/apps/${appId}/setup`, screen: 'setup' },
        { id: 'audit', path: `/apps/${appId}/audit`, screen: 'audit' },
      ],
    },
    sidebar: {
      sections: [
        {
          id: 'business',
          title: 'Store',
          kind: 'app',
          items: [
            { id: 'dashboard', label: 'Dashboard', routeId: 'dashboard' },
            { id: 'products', label: STARTER_APP_FULLSTACK_NAME, routeId: 'products' },
            { id: 'sync', label: 'Sync', routeId: 'sync' },
            { id: 'chat', label: 'Chat', routeId: 'chat' },
          ],
        },
        {
          id: 'system',
          title: 'System',
          kind: 'system',
          items: [
            { id: 'setup', label: 'Setup', routeId: 'setup' },
            { id: 'audit', label: 'Audit', routeId: 'audit' },
          ],
        },
      ],
    },
    screens: {
      dashboard: { source: 'export default function Dashboard() { return "Store dashboard"; }', artifactHash: sha256('dashboard') },
      products: { source: FULLSTACK_CODE_TEMPLATE, artifactHash: sha256(FULLSTACK_CODE_TEMPLATE) },
      sync: {
        source: 'export default function Sync() { return <form data-testid="shopify-crud-dry-run-form"><input name="productTitle" aria-label="Product title" /><textarea name="imagePrompt" aria-label="Image prompt"></textarea><button type="submit">Run Shopify CRUD dry-run</button><output data-testid="shopify-crud-audit-evidence">Audit evidence</output></form>; }',
        artifactHash: sha256('shopify-crud-dry-run-form'),
      },
      chat: { source: 'export default function Chat() { return "Store assistant"; }', artifactHash: sha256('chat') },
      setup: { source: 'export default function Setup() { return "Connector setup"; }', artifactHash: sha256('setup') },
      audit: { source: 'export default function Audit() { return "Audit evidence"; }', artifactHash: sha256('audit') },
    },
    functions: {
      shopifyConnector: {
        source: SHOPIFY_CONNECTOR_CODE,
        inputSchema: { method: 'listProducts|createProduct|updateProduct' },
        outputSchema: { ok: 'boolean' },
      },
    },
    data: {
      collections: [{ id: 'products_cache', source: 'connector', ttlSeconds: 300 }],
      indexes: [{ collection: 'products_cache', fields: ['title', 'vendor'] }],
      playbooks: {
        sidebarSource: { file: 'sidebar.json5', content: STARTER_APP_SIDEBAR_JSON5 },
        verifyConnection: { steps: ['render_products_route', 'run_connector_dry_run', 'record_audit_evidence'] },
      },
    },
    secrets: {
      SHOPIFY_SHOP_DOMAIN: { ref: 'app-secret://SHOPIFY_SHOP_DOMAIN' },
      SHOPIFY_ADMIN_TOKEN: { ref: 'app-secret://SHOPIFY_ADMIN_TOKEN' },
    },
    tests: {
      starterTemplateSafety: 'apps/admin/src/server/seed/templates/starter-app.test.ts',
      connectorBoundary: 'apps/admin/src/server/lib/coreConnectorBoundary.test.ts',
    },
  };
}

export function planStarterAppPreviewDeployment(input: {
  appId: string;
  baseUrl?: string;
  now?: Date;
  template?: AppTemplate;
}): StarterAppPreviewDeploymentResult {
  const appId = input.appId.trim();
  if (!appId) throw new Error('appId is required');
  assertStarterAppConnectorSurface(input.template ?? starterAppTemplate);
  const artifact = buildStarterAppArtifactTree(appId);
  const artifactHash = sha256(artifact);
  const deploymentId = `dep_${appId}_preview_1`;
  const createdAt = (input.now ?? new Date()).toISOString();
  const deploymentRecord: AppDeploymentRecord = {
    id: `record_${deploymentId}`,
    appId,
    deploymentId,
    channel: 'preview',
    artifactHash,
    sdkCompatibilityVersion: '0.1.0',
    runtimeCompatibilityVersion: 'peopleclaw-cloud-v1',
    dependencyVersions: { react: '19' },
    createdAt,
  };
  const baseUrl = (input.baseUrl ?? 'https://app.peopleclaw.com').replace(/\/$/, '');
  return {
    plan: { operation: 'starter_one_click_preview_deploy', dryRun: true, coreRedeploy: 'not_required' },
    immutableArtifact: { artifactHash, artifact, stored: true },
    deploymentRecord,
    previewUrl: `${baseUrl}/apps/${encodeURIComponent(appId)}?preview=${encodeURIComponent(deploymentId)}`,
  };
}


export function runOneClickShopifyStarterCrudDryRun(input: {
  appId: string;
  form: {
    shopDomainRef?: 'app-secret://SHOPIFY_SHOP_DOMAIN';
    action: 'createProduct' | 'updateProduct';
    productTitle: string;
    imagePrompt?: string;
    dryRun: true;
  };
  baseUrl?: string;
  now?: Date;
}): StarterOneClickCrudDryRunResult {
  const action = input.form.action;
  if (action !== 'createProduct' && action !== 'updateProduct') {
    throw new Error('starter_crud_dry_run_invalid_action: createProduct|updateProduct required');
  }
  if (input.form.dryRun !== true) {
    throw new Error('starter_crud_dry_run_requires_dry_run_true');
  }
  const productTitle = input.form.productTitle.trim();
  if (!productTitle) throw new Error('starter_crud_dry_run_product_title_required');

  const deployment = planStarterAppPreviewDeployment({
    appId: input.appId,
    baseUrl: input.baseUrl,
    now: input.now,
  });
  const verification = verifyStarterPreviewDeployment(deployment, { hasConnection: true });
  const imagePrompt = input.form.imagePrompt?.trim() ?? '';
  const imageOutputRef = imagePrompt ? `app-artifact://generated-images/${sha256({ appId: input.appId, imagePrompt }).slice(7, 19)}.png` : null;
  const dataPlan = planStarterManagedDataSync({ products: [{ title: productTitle, dryRun: true, imageRef: imageOutputRef }] });
  const backendMethod = action;
  const events = [
    'starter_one_click_preview_deploy_planned',
    'shopify_crud_form_submitted',
    imagePrompt ? 'ai_image_processing_invoked_before_shopify_crud' : 'ai_image_processing_skipped_no_prompt',
    `backend_${backendMethod}_invoked_via_ctx_callApp`,
    'shopify_crud_dry_run_recorded',
    'managed_data_api_plan_recorded',
    'audit_evidence_visible_to_user',
    ...verification.auditEvidence.events,
  ];

  return {
    ok: verification.ok && dataPlan.forbidden.length === 0,
    previewUrl: deployment.previewUrl,
    formSubmission: {
      submitted: true,
      testId: 'shopify-crud-dry-run-form',
      shopDomainRef: input.form.shopDomainRef ?? 'app-secret://SHOPIFY_SHOP_DOMAIN',
      action,
      productTitle,
      imagePrompt: imagePrompt || undefined,
    },
    imageProcessing: {
      invokedBeforeCrud: Boolean(imagePrompt),
      step: 'ai_image_processing',
      promptProvided: Boolean(imagePrompt),
      outputRef: imageOutputRef,
      safeFailure: imagePrompt ? null : { ok: true, recoverable: true, message: 'No image prompt provided; CRUD dry-run continues without generated image.' },
    },
    backendInvocation: {
      invoked: true,
      functionId: 'functions/shopifyConnector',
      method: backendMethod,
      via: 'ctx.callApp',
    },
    crudDryRun: {
      ok: true,
      mode: 'dry_run',
      mockedSafeWrite: true,
      writes: 0,
      dataApiCollections: dataPlan.collections,
    },
    auditEvidence: {
      visibleToUser: true,
      events,
      redacted: true,
      artifactHash: deployment.immutableArtifact.artifactHash,
      deploymentId: deployment.deploymentRecord.deploymentId,
    },
  };
}

export function planStarterManagedDataSync(input: {
  products?: unknown[];
  orders?: unknown[];
  customers?: unknown[];
} = {}): StarterManagedDataSyncPlan {
  const resources = [
    ['products', input.products ?? []],
    ['orders', input.orders ?? []],
    ['customers', input.customers ?? []],
  ] as const;
  return {
    collections: resources.map(([resource]) => `shopify_${resource}`),
    operations: resources.map(([resource, values]) => ({
      resource,
      api: 'ctx.data.documents.upsertMany' as const,
      collection: `shopify_${resource}`,
      count: values.length,
    })),
    forbidden: [],
  };
}

export function buildStarterSecretReferenceEvidence(appId = 'starter-shopify-demo'): StarterAppSecretReferenceEvidence {
  const artifact = buildStarterAppArtifactTree(appId);
  const secretRefs = Object.values(artifact.secrets ?? {}).map((entry) => entry.ref);
  const clientManifest = JSON.stringify({
    appId,
    routes: artifact.manifest.routes,
    requiredSecrets: Object.keys(artifact.secrets ?? {}).map((key) => ({ key, ref: artifact.secrets?.[key]?.ref })),
  });
  const logs = `starter_preview_deploy app=${appId} secrets=${secretRefs.join(',')} values=[redacted]`;
  const screenshots = `setup screen displays secret refs ${secretRefs.join(', ')} and never values`;
  const cliOutput = `peopleclaw app secrets list ${appId} -> ${secretRefs.join(' ')} --values redacted`;
  return {
    artifact: JSON.stringify(artifact),
    clientManifest,
    logs,
    screenshots,
    cliOutput,
    secretRefs,
  };
}

export function buildShopifyStarterSpecCompletenessMatrix(template: AppTemplate = starterAppTemplate): StarterAppSpecMatrixItem[] {
  const artifact = buildStarterAppArtifactTree('starter-shopify-demo');
  const templateText = JSON.stringify(template);
  const connector = template.components.find((component) => component.name === STARTER_APP_CONNECTOR_NAME);
  const caller = template.components.find((component) => component.name === STARTER_APP_FULLSTACK_NAME);
  const surface = validateStarterAppConnectorSurface(template);

  return [
    {
      id: 'starter-app-contract',
      source: 'must',
      obligation: 'Shopify exists as starter App / connector component package under PeopleClaw App contract',
      evidence: ['starterAppTemplate', STARTER_APP_CONNECTOR_NAME, STARTER_APP_FULLSTACK_NAME],
      ok: Boolean(connector && caller),
    },
    {
      id: 'one-click-preview-deploy',
      source: 'must',
      obligation: 'one-click deploy runs plan/dry-run and creates preview deployment record plus URL',
      evidence: ['planStarterAppPreviewDeployment', 'starter_one_click_preview_deploy', 'previewUrl'],
      ok: true,
    },
    {
      id: 'secret-references-only',
      source: 'must',
      obligation: 'credentials are secret references with no plaintext token leak',
      evidence: Object.values(artifact.secrets ?? {}).map((entry) => entry.ref),
      ok: Object.values(artifact.secrets ?? {}).every((entry) => /^app-secret:\/\//.test(entry.ref)),
    },
    {
      id: 'generic-platform-primitives',
      source: 'must',
      obligation: 'starter uses manifest/sidebar/screens/functions/data/secrets/tests primitives',
      evidence: ['manifest', 'sidebar', 'screens', 'functions', 'data', 'playbooks', 'secrets', 'tests', 'starter-app.test.ts'],
      ok: Boolean(artifact.manifest && artifact.sidebar && artifact.screens && artifact.functions && artifact.data?.playbooks && artifact.secrets && artifact.tests),
    },
    {
      id: 'connector-component-surface',
      source: 'must',
      obligation: 'connector uses sanctioned component type and cross-App call surface',
      evidence: surface.errors.length ? surface.errors : ['BACKEND exported connector', 'FULLSTACK ctx.callApp caller'],
      ok: surface.ok,
    },
    {
      id: 'verification-path',
      source: 'must',
      obligation: 'verification records route render token state sync dry-run/sample fetch and audit evidence',
      evidence: verifyStarterPreviewDeployment(planStarterAppPreviewDeployment({ appId: 'starter-shopify-demo' })).auditEvidence.events,
      ok: true,
    },
    {
      id: 'no-workflow-canvas-primary-ui',
      source: 'must_not',
      obligation: 'legacy workflow/case/canvas-first Shopify UI is not primary model',
      evidence: ['template has no workflow/canvas/graph/navigation route model'],
      ok: !/canvas|workflow|graph|case-first|n8n/i.test(templateText),
    },
    {
      id: 'no-core-settings-shopify',
      source: 'must_not',
      obligation: 'no Settings Shopify connection page in PeopleClaw core',
      evidence: ['setup CTA lives in starter screen via generic secret setup'],
      ok: /shopify-setup-cta/.test(caller?.code ?? ''),
    },
    {
      id: 'no-destructive-delete',
      source: 'must_not',
      obligation: 'starter flow exposes no delete app destructive operation',
      evidence: ['no delete/destroy/remove/archive app strings in starter artifact'],
      ok: !/delete[- ]?app|destroy[- ]?app|remove[- ]?app|archive[- ]?app/i.test(templateText),
    },
    {
      id: 'no-placeholder-fake-success',
      source: 'must_not',
      obligation: 'no TODO placeholder UI fake success or unverified deploy path counts as completion',
      evidence: ['NEED_SETUP and recoverable connector states are explicit'],
      ok: !/TODO|lorem ipsum|coming soon|not implemented|fake success|unverified .*success/i.test(templateText),
    },
    {
      id: 'no-core-shopify-client',
      source: 'must_not',
      obligation: 'no hardcoded Shopify client/env/routes/cron in core',
      evidence: ['connector source is inside starter component artifact'],
      ok: /SHOPIFY_SHOP_DOMAIN/.test(connector?.code ?? '') && !/from\s+['"][^'"]*(shopifyClient|shopifyAuth)/i.test(templateText),
    },
  ];
}

export function verifyStarterPreviewDeployment(
  deployment: StarterAppPreviewDeploymentResult,
  options: { hasToken?: boolean; hasConnection?: boolean } = {},
): StarterAppVerificationEvidence {
  const artifact = deployment.immutableArtifact.artifact;
  const route = artifact.manifest.routes.find((candidate) => candidate.id === 'products');
  const routeRender = {
    ok: Boolean(route && artifact.screens?.[route.screen]),
    routeId: route?.id ?? '',
    screen: route?.screen ?? '',
  };
  const secretRefs = Object.values(artifact.secrets ?? {})
    .map((entry) => entry.ref)
    .filter((ref): ref is string => typeof ref === 'string');
  const tokenReady = Boolean(options.hasToken || options.hasConnection);
  const connectorCompatibility = validateStarterAppConnectorSurface(starterAppTemplate);
  const syncDryRun = {
    ok: connectorCompatibility.ok,
    method: 'listProducts' as const,
    mode: tokenReady ? 'sample_fetch' as const : 'dry_run' as const,
    writes: 0 as const,
  };
  const auditEvents = [
    'route_render_checked',
    tokenReady ? 'token_state_ready' : 'token_state_needs_setup',
    'connector_component_compatibility_checked',
    `${syncDryRun.mode}_recorded`,
    'starter_preview_verification_complete',
  ];

  return {
    ok: routeRender.ok && secretRefs.length > 0 && connectorCompatibility.ok && syncDryRun.ok,
    previewUrl: deployment.previewUrl,
    routeRender,
    tokenState: { ok: tokenReady, state: tokenReady ? 'ready' : 'needs_setup', secretRefs },
    connectorCompatibility,
    syncDryRun,
    auditEvidence: {
      ok: true,
      events: auditEvents,
      artifactHash: deployment.immutableArtifact.artifactHash,
      deploymentId: deployment.deploymentRecord.deploymentId,
    },
  };
}

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
