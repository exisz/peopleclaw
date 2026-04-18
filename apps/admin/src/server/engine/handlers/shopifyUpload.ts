import type { Handler } from './index.js';
import { getPrisma } from '../../lib/prisma.js';

interface ShopifyConfig {
  shop_domain?: string;
  admin_token?: string;
}

function normalizeShopDomain(s: string): string {
  let v = s.trim();
  if (!v) return v;
  if (!v.includes('.')) v = `${v}.myshopify.com`;
  return v;
}

export const shopifyUploadHandler: Handler = async (input, ctx) => {
  const { payload } = input;
  const prisma = getPrisma();

  let shop: string | undefined;
  let token: string | undefined;
  let source = 'connection';

  // Per-tenant Connection (preferred)
  if (ctx.tenantId) {
    const conn = await prisma.connection.findUnique({
      where: { tenantId_type: { tenantId: ctx.tenantId, type: 'shopify' } },
    });
    if (conn?.enabled) {
      try {
        const cfg = JSON.parse(conn.config) as ShopifyConfig;
        if (cfg.shop_domain && cfg.admin_token) {
          shop = normalizeShopDomain(cfg.shop_domain);
          token = cfg.admin_token;
        }
      } catch {/* fall through */}
    }
  }

  // Dev fallback only — production must use Connection
  if ((!shop || !token) && process.env.NODE_ENV !== 'production') {
    if (process.env.SHOPIFY_DEV_SHOP && process.env.SHOPIFY_DEV_ADMIN_TOKEN) {
      shop = process.env.SHOPIFY_DEV_SHOP;
      token = process.env.SHOPIFY_DEV_ADMIN_TOKEN;
      source = 'env-fallback';
    }
  }

  const mock = process.env.SHOPIFY_MOCK === 'true';
  if (mock) {
    return {
      output: { productId: 'mock_' + Date.now(), productAdminUrl: 'mock://admin', mock: true },
    };
  }

  if (!shop || !token) {
    return {
      status: 'failed',
      output: { error: 'ShopifyNotConfigured' },
      error: 'ShopifyNotConfigured: add a Shopify connection in Settings → Connections',
    };
  }

  const body = {
    product: {
      title: (payload.title as string) || 'Untitled Product',
      body_html: (payload.description as string) || '',
      vendor: (payload.vendor as string) || 'PeopleClaw',
      product_type: (payload.product_type as string) || 'General',
    },
  };

  let res: Response;
  try {
    res = await fetch(`https://${shop}/admin/api/2024-10/products.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      status: 'failed',
      output: { error: 'ShopifyNetworkError', source },
      error: `Shopify network error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!res.ok) {
    const text = await res.text();
    return {
      status: 'failed',
      output: { error: 'ShopifyApiError', status: res.status, source },
      error: `ShopifyNotConfigured or invalid token (HTTP ${res.status}): ${text.slice(0, 300)}`,
    };
  }

  const data = (await res.json()) as { product?: { id?: number; title?: string } };
  const productId = data.product?.id;
  const handle = shop.replace(/\.myshopify\.com$/, '');
  return {
    output: {
      productId,
      productAdminUrl: productId
        ? `https://admin.shopify.com/store/${handle}/products/${productId}`
        : null,
      shopifyTitle: data.product?.title,
      source,
    },
  };
};
