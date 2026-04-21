import type { Handler } from './index.js';

/**
 * PLANET-1043 — Ecommerce Entry handler.
 *
 * Minimal entry point: accepts {image, price} from case payload and passes
 * them forward for subsequent steps to consume (e.g. ai.product_description,
 * shopify.list_product). No transformation is done here — the node is purely
 * a pass-through that records the initial product snapshot.
 */
export const ecommerceEntryHandler: Handler = async (input) => {
  const { image, price } = input.payload as { image?: string; price?: string | number };
  return {
    output: {
      ...input.payload,
      _entry: true,
      image: image ?? null,
      price: price !== undefined ? Number(price) : null,
    },
  };
};
