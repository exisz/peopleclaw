import type { HandlerContext, HandlerResult } from '../executor.js';
import { createCaseHandler } from './createCase.js';
import { aiDescriptionHandler } from './aiDescription.js';
import { shopifyUploadHandler } from './shopifyUpload.js';
import { shopifyCreateProductHandler } from './shopifyCreateProduct.js';
import {
  shopifyUpdateInventoryHandler,
  shopifyFetchOrdersHandler,
  shopifyUpdateOrderStatusHandler,
  shopifyGetProductHandler,
} from './shopifyExtra.js';
import { aiProductImageCaptionHandler, aiProductTranslateHandler } from './aiExtra.js';
import { aiImageGenerateHandler } from './aiImageGenerate.js';
import { aiGenerateTitleHandler } from './aiGenerateTitle.js';
import { aiSwitchImageHandler } from './aiSwitchImage.js';
import { aiGenerateSkusHandler } from './aiGenerateSkus.js';
import {
  genericHttpRequestHandler,
  genericTransformJsonHandler,
  genericConditionHandler,
  genericDelayHandler,
} from './generic.js';
import { ecommerceEntryHandler } from './ecommerceEntry.js';

export type Handler = (
  input: { payload: Record<string, unknown> },
  ctx: HandlerContext,
) => Promise<HandlerResult>;

/**
 * Handler registry — keyed by the canonical step `handler` id (e.g.
 * "shopify.list_product"). Legacy `type` keys (shopify_upload, ai_description,
 * create_case) are retained so existing seeded workflows keep running until
 * they're re-seeded with new handler ids.
 */
export const handlers: Record<string, Handler> = {
  // Canonical (PLANET-917) — Shopify
  'shopify.create_product': shopifyCreateProductHandler,
  'shopify.list_product': shopifyUploadHandler,
  'shopify.update_inventory': shopifyUpdateInventoryHandler,
  'shopify.fetch_orders': shopifyFetchOrdersHandler,
  'shopify.update_order_status': shopifyUpdateOrderStatusHandler,
  'shopify.get_product': shopifyGetProductHandler,
  // Canonical — AI
  'ai.product_description': aiDescriptionHandler,
  'ai.product_image_caption': aiProductImageCaptionHandler,
  'ai.product_translate': aiProductTranslateHandler,
  'ai.image_generate': aiImageGenerateHandler,
  'ai.generate_title': aiGenerateTitleHandler,   // PLANET-1059 placeholder
  'ai.switch_image': aiSwitchImageHandler,         // PLANET-1060 placeholder
  'ai.generate_skus': aiGenerateSkusHandler,       // PLANET-1061 placeholder
  // Canonical — Generic
  'generic.http_request': genericHttpRequestHandler,
  'generic.transform_json': genericTransformJsonHandler,
  'generic.condition': genericConditionHandler,
  'generic.delay': genericDelayHandler,

  // Canonical — Ecommerce entry (PLANET-1043)
  'ecommerce.entry': ecommerceEntryHandler,

  // Legacy aliases (pre-PLANET-917) — keep the existing demo workflows green.
  create_case: createCaseHandler,
  ai_description: aiDescriptionHandler,
  shopify_upload: shopifyUploadHandler,
};
