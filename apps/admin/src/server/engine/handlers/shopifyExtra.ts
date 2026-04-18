import type { Handler } from './index.js';
import { resolveShopifyCreds, shopifyFetch } from './shopifyClient.js';

function failNotConfigured() {
  return {
    status: 'failed' as const,
    output: { error: 'ShopifyNotConfigured' },
    error: 'ShopifyNotConfigured: add a Shopify connection in Settings → Connections',
  };
}

/** shopify.update_inventory — set inventory level at a location. */
export const shopifyUpdateInventoryHandler: Handler = async (input, ctx) => {
  const { payload } = input;
  const cfg = ctx.stepConfig ?? {};
  const creds = await resolveShopifyCreds(ctx.tenantId);
  if (!creds) return failNotConfigured();

  const inventory_item_id = (payload.inventory_item_id as number) ?? (cfg.inventory_item_id as number);
  const location_id = (payload.location_id as number) ?? (cfg.location_id as number);
  const quantity = (payload.quantity as number) ?? (cfg.quantity as number) ?? 0;

  if (!inventory_item_id || !location_id) {
    return {
      status: 'failed',
      output: { error: 'MissingInputs' },
      error: 'shopify.update_inventory needs inventory_item_id and location_id',
    };
  }

  const res = await shopifyFetch(creds, 'inventory_levels/set.json', {
    method: 'POST',
    body: JSON.stringify({ inventory_item_id, location_id, available: quantity }),
  });
  if (!res.ok) {
    const t = await res.text();
    return {
      status: 'failed',
      output: { error: 'ShopifyApiError', status: res.status },
      error: `update_inventory HTTP ${res.status}: ${t.slice(0, 300)}`,
    };
  }
  const data = (await res.json()) as { inventory_level?: { available?: number } };
  return { output: { available: data.inventory_level?.available ?? quantity, source: creds.source } };
};

/** shopify.fetch_orders — list recent orders. */
export const shopifyFetchOrdersHandler: Handler = async (_input, ctx) => {
  const cfg = ctx.stepConfig ?? {};
  const creds = await resolveShopifyCreds(ctx.tenantId);
  if (!creds) return failNotConfigured();
  const status = (cfg.status as string) || 'any';
  const limit = (cfg.limit as number) || 50;
  const res = await shopifyFetch(creds, `orders.json?status=${encodeURIComponent(status)}&limit=${limit}`);
  if (!res.ok) {
    const t = await res.text();
    return {
      status: 'failed',
      output: { error: 'ShopifyApiError', status: res.status },
      error: `fetch_orders HTTP ${res.status}: ${t.slice(0, 300)}`,
    };
  }
  const data = (await res.json()) as { orders?: unknown[] };
  const orders = data.orders ?? [];
  return { output: { orders, count: orders.length, source: creds.source } };
};

/** shopify.update_order_status — POST a fulfillment to mark an order shipped. */
export const shopifyUpdateOrderStatusHandler: Handler = async (input, ctx) => {
  const { payload } = input;
  const cfg = ctx.stepConfig ?? {};
  const creds = await resolveShopifyCreds(ctx.tenantId);
  if (!creds) return failNotConfigured();

  const order_id = (payload.order_id as number) ?? (cfg.order_id as number);
  if (!order_id) {
    return {
      status: 'failed',
      output: { error: 'MissingInputs' },
      error: 'shopify.update_order_status needs order_id',
    };
  }
  const notify = (cfg.notify_customer as boolean) ?? true;

  const res = await shopifyFetch(creds, `orders/${order_id}/fulfillments.json`, {
    method: 'POST',
    body: JSON.stringify({ fulfillment: { notify_customer: notify } }),
  });
  if (!res.ok) {
    const t = await res.text();
    return {
      status: 'failed',
      output: { error: 'ShopifyApiError', status: res.status },
      error: `update_order_status HTTP ${res.status}: ${t.slice(0, 300)}`,
    };
  }
  const data = (await res.json()) as { fulfillment?: { id?: number; status?: string } };
  return {
    output: {
      fulfillmentId: data.fulfillment?.id,
      status: data.fulfillment?.status,
      source: creds.source,
    },
  };
};

/** shopify.get_product — fetch a single product. */
export const shopifyGetProductHandler: Handler = async (input, ctx) => {
  const { payload } = input;
  const cfg = ctx.stepConfig ?? {};
  const creds = await resolveShopifyCreds(ctx.tenantId);
  if (!creds) return failNotConfigured();

  const product_id = (payload.product_id as number) ?? (payload.productId as number) ?? (cfg.product_id as number);
  if (!product_id) {
    return {
      status: 'failed',
      output: { error: 'MissingInputs' },
      error: 'shopify.get_product needs product_id',
    };
  }
  const res = await shopifyFetch(creds, `products/${product_id}.json`);
  if (!res.ok) {
    const t = await res.text();
    return {
      status: 'failed',
      output: { error: 'ShopifyApiError', status: res.status },
      error: `get_product HTTP ${res.status}: ${t.slice(0, 300)}`,
    };
  }
  const data = (await res.json()) as { product?: unknown };
  return { output: { product: data.product, source: creds.source } };
};
