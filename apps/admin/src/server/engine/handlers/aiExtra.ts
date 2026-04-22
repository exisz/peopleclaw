import type { Handler } from './index.js';
import { CREDIT_COSTS } from '../../lib/credits.js';
import { checkAndDeductCredit } from '../../lib/credit-check.js';

/** ai.product_image_caption — image captioning via vision model (pending full implementation). */
export const aiProductImageCaptionHandler: Handler = async (_input, ctx) => {
  await checkAndDeductCredit(
    ctx.tenantId,
    ctx.userId,
    CREDIT_COSTS.AI_OTHER,
    'ai_image_caption',
    { caseId: ctx.caseId },
  );
  throw new Error('ai.product_image_caption: vision model not yet configured — pending PLANET-1115 follow-up');
};

/** ai.product_translate — translate product text using DeepSeek. */
export const aiProductTranslateHandler: Handler = async (input, ctx) => {
  const remaining = await checkAndDeductCredit(
    ctx.tenantId,
    ctx.userId,
    CREDIT_COSTS.AI_OTHER,
    'ai_translate',
    { caseId: ctx.caseId },
  );

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY missing — refusing to mock in production');

  const cfg = ctx.stepConfig ?? {};
  const { payload } = input;
  const text = (payload.text as string) || '';
  const target = (cfg.target as string) || 'zh';

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `You are a translator. Translate the following text to ${target}. Respond with ONLY the translated text.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const translated = data.choices?.[0]?.message?.content?.trim() || '';
  return { output: { translated, target, model: 'deepseek-chat', creditsRemaining: remaining } };
};
