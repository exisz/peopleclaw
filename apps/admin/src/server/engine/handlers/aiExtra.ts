import type { Handler } from './index.js';
import { CREDIT_COSTS } from '../../lib/credits.js';
import { checkAndDeductCredit } from '../../lib/credit-check.js';

/** ai.product_image_caption — STUB. Deducts 1 credit and returns a mock caption. */
export const aiProductImageCaptionHandler: Handler = async (input, ctx) => {
  const remaining = await checkAndDeductCredit(
    ctx.tenantId,
    ctx.userId,
    CREDIT_COSTS.AI_OTHER,
    'ai_image_caption',
    { caseId: ctx.caseId },
  );
  const { payload } = input;
  const url = (payload.image_url as string) || '';
  const title = (payload.title as string) || 'product';
  const caption = `Photo of ${title}${url ? ` (source: ${url.slice(0, 60)})` : ''}`;
  return { output: { caption, mock: true, creditsRemaining: remaining } };
};

/** ai.product_translate — STUB. Deducts 1 credit and returns a marker translation. */
export const aiProductTranslateHandler: Handler = async (input, ctx) => {
  const remaining = await checkAndDeductCredit(
    ctx.tenantId,
    ctx.userId,
    CREDIT_COSTS.AI_OTHER,
    'ai_translate',
    { caseId: ctx.caseId },
  );
  const cfg = ctx.stepConfig ?? {};
  const { payload } = input;
  const text = (payload.text as string) || '';
  const target = (cfg.target as string) || 'zh';
  // Stub: just tag the input. Real impl will call OpenAI.
  const translated = `[${target}] ${text}`;
  return { output: { translated, target, mock: true, creditsRemaining: remaining } };
};
