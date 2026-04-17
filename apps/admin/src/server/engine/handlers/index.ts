import type { HandlerContext, HandlerResult } from '../executor.js';
import { createCaseHandler } from './createCase.js';
import { aiDescriptionHandler } from './aiDescription.js';
import { shopifyUploadHandler } from './shopifyUpload.js';

export type Handler = (
  input: { payload: Record<string, unknown> },
  ctx: HandlerContext,
) => Promise<HandlerResult>;

export const handlers: Record<string, Handler> = {
  create_case: createCaseHandler,
  ai_description: aiDescriptionHandler,
  shopify_upload: shopifyUploadHandler,
};
