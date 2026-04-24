/**
 * publish_shopify handler — PLANET-1200
 * Maps case payload (product_name / price / stock / image_url / description / category / sku)
 * directly to Shopify Admin API product create.
 * Writes productPublicUrl back to case payload for UI "查看商品" button.
 */
import type { Handler } from './index.js';
import { resolveShopifyCreds, shopifyFetch, shopHandle } from './shopifyClient.js';

export const publishShopifyHandler: Handler = async (input, ctx) => {
  const { payload } = input;

  const creds = await resolveShopifyCreds(ctx.tenantId);
  if (!creds) {
    return {
      status: 'failed',
      output: { error: 'ShopifyNotConfigured' },
      error: 'ShopifyNotConfigured: add a Shopify connection in Settings → Connections',
    };
  }

  // Build Shopify product body from case payload fields
  const title =
    (payload.product_name as string) ||
    (payload.title as string) ||
    'Untitled Product';

  const description =
    (payload.description as string) ||
    (payload.body_html as string) ||
    '';

  const price = payload.price != null ? String(payload.price) : '0.00';
  const stock = payload.stock != null ? Number(payload.stock) : undefined;
  const category = (payload.category as string) || undefined;
  const imageUrl = (payload.image_url as string) || (payload.imageUrl as string) || null;
  const sku = (payload.sku as string) || undefined;

  const variant: Record<string, unknown> = { price };
  if (sku) variant.sku = sku;
  if (stock != null) {
    variant.inventory_quantity = stock;
    variant.inventory_management = 'shopify';
  }

  const body: Record<string, unknown> = {
    product: {
      title,
      body_html: description,
      vendor: 'PeopleClaw',
      product_type: category || 'General',
      status: 'active',
      published: true,
      variants: [variant],
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
      output: { error: 'ShopifyNetworkError' },
      error: `Shopify network error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!res.ok) {
    const text = await res.text();
    return {
      status: 'failed',
      output: { error: 'ShopifyApiError', status: res.status },
      error: `Shopify API error (HTTP ${res.status}): ${text.slice(0, 300)}`,
    };
  }

  const data = (await res.json()) as {
    product?: { id?: number; title?: string; handle?: string };
  };

  const productId = data.product?.id;
  const productHandle = data.product?.handle ?? null;
  const shopDomain = creds.shop;

  // Upload image if present
  if (imageUrl && productId) {
    try {
      let imgBody: Record<string, unknown>;
      if (imageUrl.startsWith('data:')) {
        const b64 = imageUrl.split(',')[1] || '';
        imgBody = { image: { attachment: b64, filename: 'product.png' } };
      } else {
        imgBody = { image: { src: imageUrl } };
      }
      const imgRes = await shopifyFetch(creds, `products/${productId}/images.json`, {
        method: 'POST',
        body: JSON.stringify(imgBody),
      });
      if (!imgRes.ok) {
        const errText = await imgRes.text();
        console.warn('[publish_shopify] image upload failed', { status: imgRes.status, body: errText.slice(0, 200) });
      }
    } catch (imgErr) {
      console.warn('[publish_shopify] image upload error', imgErr instanceof Error ? imgErr.message : String(imgErr));
    }
  }

  const productPublicUrl = productHandle ? `https://${shopDomain}/products/${productHandle}` : null;
  const productAdminUrl = productId
    ? `https://admin.shopify.com/store/${shopHandle(creds)}/products/${productId}`
    : null;

  console.log('[publish_shopify] created', { productId, productPublicUrl, title });

  return {
    output: {
      productId,
      productHandle,
      productPublicUrl,
      productAdminUrl,
      shopifyTitle: data.product?.title,
      source: creds.source,
    },
  };
};
