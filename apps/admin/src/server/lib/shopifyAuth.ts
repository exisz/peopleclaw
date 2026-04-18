/**
 * Shopify Admin API client_credentials token exchange.
 * Used by:
 *   - POST /api/tenants/:slug/connections (initial create)
 *   - POST /api/tenants/:slug/connections/:id/refresh (manual refresh)
 *   - POST /api/internal/refresh-shopify-tokens (Vercel Cron)
 *
 * Returns { admin_token, expires_in, token_expires_at } on success.
 * Throws Error('shopify_exchange_failed: <status> <body>') on failure.
 *
 * Connection.config (type=shopify) shape (PLANET-916):
 *   {
 *     shop_domain: string;       // e.g. "claw-eb6xipji.myshopify.com"
 *     admin_token: string;       // shpca_... (24h TTL)
 *     client_id: string;         // Dev Dashboard 2026 OAuth client id
 *     client_secret: string;     // shpss_...
 *     token_expires_at: string;  // ISO timestamp
 *   }
 */

export interface ShopifyClientCreds {
  shop_domain: string;
  client_id: string;
  client_secret: string;
}

export interface ShopifyExchangeResult {
  admin_token: string;
  expires_in: number;
  token_expires_at: string;
}

function normalizeShopDomain(s: string): string {
  let v = (s || '').trim();
  if (!v) return v;
  if (!v.includes('.')) v = `${v}.myshopify.com`;
  return v;
}

export async function exchangeShopifyClientCredentials(
  creds: ShopifyClientCreds,
): Promise<ShopifyExchangeResult> {
  const shop = normalizeShopDomain(creds.shop_domain);
  if (!shop || !creds.client_id || !creds.client_secret) {
    throw new Error('shopify_exchange_failed: missing shop_domain/client_id/client_secret');
  }
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`shopify_exchange_failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error('shopify_exchange_failed: missing access_token in response');
  }
  const expires_in = data.expires_in ?? 86400;
  return {
    admin_token: data.access_token,
    expires_in,
    token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
  };
}
