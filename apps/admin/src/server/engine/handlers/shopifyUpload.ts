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

  // PLANET-1321: color_variants from attribute panel take priority
  const colorVariants = Array.isArray(payload.color_variants)
    ? payload.color_variants as Array<{color?: string; stock?: number; price?: number}>
    : null;
  const productSku = (payload.sku as string) || '';

  // PLANET-1120 / PLANET-1121: support variants from ai.generate_skus payload.
  // Shopify REST requires `options: [{name}]` + `option1` per variant when there
  // are multiple variants — a `title` field on the variant alone yields 422
  // "Invalid variant". For a single variant, omit options entirely.
  const skus = Array.isArray(payload.skus)
    ? (payload.skus as Array<{ sku?: string; title?: string; price?: string | number; inventory_quantity?: number; option1?: string }>)
    : null;

  // Pick a unique option1 per variant. Prefer explicit option1, then derive from
  // title's last segment after the last " - " separator (DeepSeek output
  // pattern), then fall back to a generated label.
  let variants: Array<Record<string, unknown>> | undefined;
  let options: Array<{ name: string }> | undefined;

  // PLANET-1321: color_variants take priority over skus
  if (colorVariants && colorVariants.length > 0) {
    const fallbackPriceStr = payload.price != null && payload.price !== '' ? String(payload.price) : '0.00';
    variants = colorVariants.map((cv) => ({
      option1: cv.color || 'Default',
      sku: productSku,
      price: cv.price != null && cv.price !== 0 ? String(cv.price) : fallbackPriceStr,
      inventory_quantity: cv.stock ?? 0,
      inventory_management: 'shopify',
    }));
    if (variants.length > 1) options = [{ name: '颜色' }];
  } else if (skus && skus.length > 0) {
    const seen = new Set<string>();
    variants = skus.map((s, i) => {
      let opt = (s.option1 ?? '').toString().trim();
      if (!opt && s.title) {
        const parts = String(s.title).split(/\s*[-\u2013\u2014\u00b7]\s*/).filter(Boolean);
        opt = parts[parts.length - 1] || '';
      }
      if (!opt) opt = `Variant ${i + 1}`;
      // ensure uniqueness
      let candidate = opt;
      let n = 2;
      while (seen.has(candidate)) candidate = `${opt} ${n++}`;
      seen.add(candidate);
      const v: Record<string, unknown> = {
        option1: candidate,
        sku: s.sku ?? '',
        price: s.price != null ? String(s.price) : '0.00',
      };
      if (s.inventory_quantity != null) {
        v.inventory_quantity = s.inventory_quantity;
        v.inventory_management = 'shopify';
      }
      return v;
    });
    if (variants.length > 1) options = [{ name: '颜色' }];
  }

  // PLANET-1316 / PLANET-1344: human-entered price is fallback only.
  // If a variant already has its own non-zero price (from color_variants),
  // keep it. Only apply the top-level price to variants that lack one.
  if (payload.price != null && payload.price !== '' && variants) {
    const humanPrice = String(payload.price);
    variants = variants.map(v => {
      const vp = v.price as string | undefined;
      // Keep variant price if it exists and isn't zero/empty
      if (vp && vp !== '0' && vp !== '0.00' && vp !== '') return v;
      return { ...v, price: humanPrice };
    });
  }

  // fallback: no skus — use single price field if present
  const fallbackPrice = (payload.price as string | number) ?? null;

  console.log('[shopify:variants]', { count: variants?.length ?? 0, hasOptions: !!options });

  const body = {
    product: {
      title: (payload.product_name as string) || (payload.title as string) || 'Untitled Product',
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
      ...(variants
        ? options
          ? { options, variants }
          : { variants }
        : fallbackPrice != null
          ? { variants: [{ price: String(fallbackPrice) }] }
          : {}),
    },
  };

  // PLANET-1323: If productId exists in payload, UPDATE instead of CREATE
  const existingProductId = payload.productId as number | undefined;
  const isUpdate = !!existingProductId;
  const endpoint = isUpdate ? `products/${existingProductId}.json` : 'products.json';
  const method = isUpdate ? 'PUT' : 'POST';

  console.log('[shopify:upload]', { isUpdate, existingProductId, endpoint });

  let res: Response;
  try {
    res = await shopifyFetch(creds, endpoint, {
      method,
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

  // PLANET-1119: upload product image after creation (shopify.list_product was
  // missing image handling — PLANET-1118 only fixed shopify.create_product).
  const imageUrl = (payload.image_url as string) || (payload.imageUrl as string) || (payload.image as string) || null;
  if (imageUrl && productId) {
    // Delete existing images first (so the new image becomes the primary one)
    if (isUpdate) {
      try {
        const listRes = await shopifyFetch(creds, `products/${productId}/images.json`, { method: 'GET' });
        if (listRes.ok) {
          const listData = (await listRes.json()) as { images?: Array<{ id: number }> };
          for (const img of listData.images ?? []) {
            await shopifyFetch(creds, `products/${productId}/images/${img.id}.json`, { method: 'DELETE' });
          }
          console.log('[shopify:image] deleted old images', { count: listData.images?.length ?? 0, productId });
        }
      } catch (delErr) {
        console.warn('[shopify:image] failed to delete old images', { err: delErr instanceof Error ? delErr.message : String(delErr) });
      }
    }
    let imgBody: Record<string, unknown>;
    if (imageUrl.startsWith('data:')) {
      const b64 = (payload.b64 as string) || imageUrl.split(',')[1] || '';
      console.log('[shopify:image]', { handler: 'list_product', mode: 'attachment', attachmentSize: b64.length, productId });
      imgBody = { image: { attachment: b64, filename: 'product.png' } };
    } else {
      // Fetch the image and convert to base64 attachment (handles redirects, avoids Shopify 422)
      console.log('[shopify:image]', { handler: 'list_product', mode: 'fetch-then-attach', srcPreview: imageUrl.slice(0, 80), productId });
      try {
        const imgFetch = await fetch(imageUrl, { redirect: 'follow' });
        if (!imgFetch.ok) {
          console.warn('[shopify:image] fetch failed', { status: imgFetch.status, url: imageUrl.slice(0, 80) });
          imgBody = { image: { src: imageUrl } }; // fallback to src
        } else {
          const buf = Buffer.from(await imgFetch.arrayBuffer());
          const b64 = buf.toString('base64');
          const ext = imageUrl.match(/\.(png|jpe?g|gif|webp)/i)?.[1] || 'png';
          console.log('[shopify:image]', { handler: 'list_product', mode: 'fetched-attachment', size: buf.length, productId });
          imgBody = { image: { attachment: b64, filename: `product.${ext}` } };
        }
      } catch (fetchErr) {
        console.warn('[shopify:image] fetch error, falling back to src', { err: fetchErr instanceof Error ? fetchErr.message : String(fetchErr) });
        imgBody = { image: { src: imageUrl } }; // fallback to src
      }
    }
    try {
      const imgRes = await shopifyFetch(creds, `products/${productId}/images.json`, {
        method: 'POST',
        body: JSON.stringify(imgBody),
      });
      if (!imgRes.ok) {
        const errText = await imgRes.text();
        console.warn('[shopify:image] upload failed', { handler: 'list_product', status: imgRes.status, body: errText.slice(0, 300) });
      } else {
        console.log('[shopify:image] upload ok', { handler: 'list_product', productId });
      }
    } catch (imgErr) {
      console.warn('[shopify:image] upload error', { handler: 'list_product', err: imgErr instanceof Error ? imgErr.message : String(imgErr) });
    }
  }

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

