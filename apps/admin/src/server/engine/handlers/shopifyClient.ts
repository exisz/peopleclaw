import { getPrisma } from '../../lib/prisma.js';

interface ShopifyConfig {
  shop_domain?: string;
  admin_token?: string;
}

export interface ShopifyCreds {
  shop: string;
  token: string;
  source: string;
}

function normalizeShopDomain(s: string): string {
  let v = s.trim();
  if (!v) return v;
  if (!v.includes('.')) v = `${v}.myshopify.com`;
  return v;
}

/**
 * Resolve Shopify credentials (Connection-first, then dev env fallback).
 * Returns null when no creds are available.
 */
export async function resolveShopifyCreds(tenantId: string): Promise<ShopifyCreds | null> {
  const prisma = getPrisma();
  if (tenantId) {
    const conn = await prisma.connection.findUnique({
      where: { tenantId_type: { tenantId, type: 'shopify' } },
    });
    if (conn?.enabled) {
      try {
        const cfg = JSON.parse(conn.config) as ShopifyConfig;
        if (cfg.shop_domain && cfg.admin_token) {
          return {
            shop: normalizeShopDomain(cfg.shop_domain),
            token: cfg.admin_token,
            source: 'connection',
          };
        }
      } catch {/* fall through */}
    }
  }
  if (process.env.NODE_ENV !== 'production'
    && process.env.SHOPIFY_DEV_SHOP
    && process.env.SHOPIFY_DEV_ADMIN_TOKEN) {
    return {
      shop: normalizeShopDomain(process.env.SHOPIFY_DEV_SHOP),
      token: process.env.SHOPIFY_DEV_ADMIN_TOKEN,
      source: 'env-fallback',
    };
  }
  return null;
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

export function shopHandle(creds: ShopifyCreds): string {
  return creds.shop.replace(/\.myshopify\.com$/, '');
}
