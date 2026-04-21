/**
 * shopify.create_product handler — PLANET-1069
 * Full product creation: title + description + image + variants (SKUs).
 */
import type { Handler } from './index.js';
import { resolveShopifyCreds, shopifyFetch, shopHandle } from './shopifyClient.js';

function failNotConfigured() {
  return {
    status: 'failed' as const,
    output: { error: 'ShopifyNotConfigured' },
    error: 'ShopifyNotConfigured: add a Shopify connection in Settings → Connections',
  };
}

interface SkuItem {
  sku?: string;
  title?: string;
  price?: string | number;
  inventory_quantity?: number;
}

export const shopifyCreateProductHandler: Handler = async (input, ctx) => {
  const { payload } = input;
  const cfg = ctx.stepConfig ?? {};

  if (process.env.SHOPIFY_MOCK === 'true') {
    const mockId = Date.now();
    return {
      output: {
        productId: `mock_${mockId}`,
        productAdminUrl: `https://admin.shopify.com/store/mock/products/${mockId}`,
        mock: true,
      },
    };
  }

  const creds = await resolveShopifyCreds(ctx.tenantId);
  if (!creds) return failNotConfigured();

  const title = (payload.title as string) || (cfg.title as string) || 'Untitled Product';
  const description = (payload.description as string) || (cfg.description as string) || '';
  const imageUrl = (payload.imageUrl as string) || (payload.image as string) || null;
  const vendor = (payload.vendor as string) || (cfg.vendor as string) || 'PeopleClaw';
  const productType = (payload.product_type as string) || (cfg.product_type as string) || 'General';
  const status = (cfg.status as string) || 'draft';

  // Build variants from context.skus or fallback to a single default variant
  const rawSkus = (payload.skus as SkuItem[]) || [];
  const variants =
    rawSkus.length > 0
      ? rawSkus.map((s) => ({
          option1: s.title ?? s.sku ?? 'Default',
          sku: s.sku ?? '',
          price: String(s.price ?? '0.00'),
          inventory_management: 'shopify',
          inventory_quantity: s.inventory_quantity ?? 0,
        }))
      : [{ option1: 'Default', price: String(payload.price ?? '0.00'), inventory_management: 'shopify', inventory_quantity: 10 }];

  const body: Record<string, unknown> = {
    product: {
      title,
      body_html: description,
      vendor,
      product_type: productType,
      status,
      variants,
      options: rawSkus.length > 0 ? [{ name: 'Size', values: rawSkus.map((s) => s.title ?? s.sku ?? 'Default') }] : [],
    },
  };

  // Add image if available
  if (imageUrl) {
    (body.product as Record<string, unknown>).images = [{ src: imageUrl }];
  }

  let res: Response;
  try {
    res = await shopifyFetch(creds, 'products.json', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      status: 'failed',
      output: { error: 'ShopifyNetworkError' },
      error: `Shopify network error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!res.ok) {
    const text = await res.text();
    return {
      status: 'failed',
      output: { error: 'ShopifyApiError', status: res.status },
      error: `Shopify create_product HTTP ${res.status}: ${text.slice(0, 300)}`,
    };
  }

  const data = (await res.json()) as { product?: { id?: number; title?: string; handle?: string } };
  const productId = data.product?.id;
  const handle = shopHandle(creds);

  return {
    output: {
      productId,
      productAdminUrl: productId
        ? `https://admin.shopify.com/store/${handle}/products/${productId}`
        : null,
      shopifyTitle: data.product?.title,
      source: creds.source,
    },
  };
};
