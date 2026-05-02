/**
 * Lightweight Shopify Admin API fetcher (PLANET-1461).
 *
 * Originally this file also exposed `resolveShopifyCreds` which mounted creds
 * from the Connection table into the component sandbox. That special path was
 * removed under PLANET-1463 — Shopify is now a regular App-level connector
 * driven by App.secrets, identical to any third-party API. The only remaining
 * caller is the tenant-facing connection-test endpoint, which still needs a
 * tiny REST helper to ping `shop.json` during setup.
 */

export interface ShopifyCreds {
  shop: string;
  token: string;
  source: string;
}

export async function shopifyFetch(
  creds: ShopifyCreds,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `https://${creds.shop}/admin/api/2024-10/${path.replace(/^\//, '')}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': creds.token,
    ...((init.headers as Record<string, string>) ?? {}),
  };
  return fetch(url, { ...init, headers });
}
