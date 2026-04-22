import type { Handler } from './index.js';
import { resolveShopifyCreds, shopifyFetch, shopHandle } from './shopifyClient.js';

/**
 * shopify.list_product handler — creates a draft product.
 * Backed by the canonical implementation; preserved as `shopify_upload` legacy
 * type for the existing demo workflows (see handler registry).
 */
export const shopifyUploadHandler: Handler = async (input, ctx) => {
  const { payload } = input;
  const stepConfig = ctx.stepConfig ?? {};

  const creds = await resolveShopifyCreds(ctx.tenantId);
  if (!creds) {
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
      vendor:
        (payload.vendor as string) ||
        (stepConfig.vendor as string) ||
        'PeopleClaw',
      product_type:
        (payload.product_type as string) ||
        (stepConfig.product_type as string) ||
        'General',
      status: (stepConfig.status as string) || 'active',
      published: true,
    },
  };

  let res: Response;
  try {
    res = await shopifyFetch(creds, 'products.json', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      status: 'failed',
      output: { error: 'ShopifyNetworkError', source: creds.source },
      error: `Shopify network error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!res.ok) {
    const text = await res.text();
    return {
      status: 'failed',
      output: { error: 'ShopifyApiError', status: res.status, source: creds.source },
      error: `ShopifyNotConfigured or invalid token (HTTP ${res.status}): ${text.slice(0, 300)}`,
    };
  }

  const data = (await res.json()) as { product?: { id?: number; title?: string; handle?: string } };
  const productId = data.product?.id;
  const productHandle = data.product?.handle ?? null;
  const shopDomain = creds.shop; // already normalized to myshopify.com domain
  return {
    output: {
      productId,
      productAdminUrl: productId
        ? `https://admin.shopify.com/store/${shopHandle(creds)}/products/${productId}`
        : null,
      productHandle,
      productPublicUrl: productHandle ? `https://${shopDomain}/products/${productHandle}` : null,
      shopifyTitle: data.product?.title,
      source: creds.source,
    },
  };
};

