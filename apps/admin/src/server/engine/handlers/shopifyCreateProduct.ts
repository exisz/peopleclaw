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

  const creds = await resolveShopifyCreds(ctx.tenantId);
  if (!creds) return failNotConfigured();

  const title = (payload.product_name as string) || (payload.title as string) || (cfg.title as string) || 'Untitled Product';
  const description = (payload.description as string) || (cfg.description as string) || '';
  const imageUrl = (payload.imageUrl as string) || (payload.image as string) || null;
  const vendor = (payload.vendor as string) || (cfg.vendor as string) || 'PeopleClaw';
  const productType = (payload.product_type as string) || (cfg.product_type as string) || 'General';
  const status = (cfg.status as string) || 'draft';

  // PLANET-1321: color_variants from attribute panel take priority
  const colorVariants = Array.isArray(payload.color_variants)
    ? payload.color_variants as Array<{color?: string; stock?: number; price?: number}>
    : null;
  const productSku = (payload.sku as string) || '';

  // Build variants from color_variants, context.skus, or fallback to a single default variant
  const rawSkus = (payload.skus as SkuItem[]) || [];
  // PLANET-1316: human-entered price overrides AI-generated SKU prices
  const humanPrice = payload.price != null && payload.price !== '' ? String(payload.price) : null;
  let variants;
  let variantOptions: Array<{ name: string; values?: string[] }> | undefined;

  if (colorVariants && colorVariants.length > 0) {
    const fallbackPriceStr = humanPrice ?? String(payload.price ?? '0.00');
    variants = colorVariants.map((cv) => ({
      option1: cv.color || 'Default',
      sku: productSku,
      price: cv.price != null && cv.price !== 0 ? String(cv.price) : fallbackPriceStr,
      inventory_management: 'shopify',
      inventory_quantity: cv.stock ?? 0,
    }));
    variantOptions = colorVariants.length > 1
      ? [{ name: '颜色', values: colorVariants.map(cv => cv.color || 'Default') }]
      : undefined;
  } else if (rawSkus.length > 0) {
    variants = rawSkus.map((s) => ({
      option1: s.title ?? s.sku ?? 'Default',
      sku: s.sku ?? '',
      price: humanPrice ?? String(s.price ?? '0.00'),
      inventory_management: 'shopify',
      inventory_quantity: s.inventory_quantity ?? 0,
    }));
    variantOptions = [{ name: '颜色', values: rawSkus.map((s) => s.title ?? s.sku ?? 'Default') }];
  } else {
    variants = [{ option1: 'Default', price: humanPrice ?? String(payload.price ?? '0.00'), inventory_management: 'shopify', inventory_quantity: 10 }];
    variantOptions = undefined;
  }

  const body: Record<string, unknown> = {
    product: {
      title,
      body_html: description,
      vendor,
      product_type: productType,
      status,
      variants,
      options: variantOptions ?? [],
    },
  };

  // Add image if available — use src for https URLs, attachment for data URIs
  // NOTE: We intentionally omit images from the create-product body and upload them
  // via the dedicated POST /products/:id/images.json endpoint after creation, which
  // has more reliable attachment support than the inline `images` field.

  // PLANET-1323: If productId exists in payload, UPDATE instead of CREATE
  const existingProductId = payload.productId as number | undefined;
  const isUpdate = !!existingProductId;
  const endpoint = isUpdate ? `products/${existingProductId}.json` : 'products.json';
  const method = isUpdate ? 'PUT' : 'POST';

  console.log('[shopify:create_product]', { isUpdate, existingProductId, endpoint });

  let res: Response;
  try {
    res = await shopifyFetch(creds, endpoint, {
      method,
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

  // Upload image via dedicated images endpoint (more reliable attachment support)
  if (imageUrl && productId) {
    let imgBody: Record<string, unknown>;
    if (imageUrl.startsWith('data:')) {
      const b64 = (payload.b64 as string) || imageUrl.split(',')[1] || '';
      const hasAttachment = b64.length > 0;
      console.log('[shopify:image]', { mode: 'attachment', hasAttachment, attachmentSize: b64?.length, hasSrc: false });
      imgBody = { image: { attachment: b64, filename: 'product.png' } };
    } else {
      console.log('[shopify:image]', { mode: 'src', hasAttachment: false, attachmentSize: 0, hasSrc: true });
      imgBody = { image: { src: imageUrl } };
    }
    try {
      const imgRes = await shopifyFetch(creds, `products/${productId}/images.json`, {
        method: 'POST',
        body: JSON.stringify(imgBody),
      });
      if (!imgRes.ok) {
        const errText = await imgRes.text();
        console.warn('[shopify:image] upload failed', { status: imgRes.status, body: errText.slice(0, 200) });
      } else {
        console.log('[shopify:image] upload ok', { productId });
      }
    } catch (imgErr) {
      console.warn('[shopify:image] upload error', imgErr instanceof Error ? imgErr.message : imgErr);
    }
  }

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
