import type { Handler } from './index.js';
import { CREDIT_COSTS } from '../../lib/credits.js';
import { checkAndDeductCredit } from '../../lib/credit-check.js';

export const aiDescriptionHandler: Handler = async (input, ctx) => {
  // Deduct credit first (throws InsufficientCreditsError → caught by executor)
  const remaining = await checkAndDeductCredit(
    ctx.tenantId,
    ctx.userId,
    CREDIT_COSTS.AI_DESCRIPTION,
    'ai_description',
    { caseId: ctx.caseId },
  );

  const { payload } = input;
  const title = (payload.title as string) || 'product';
  const features = (payload.features as string) || '';

  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You write concise, persuasive Shopify product descriptions in 2-3 sentences.' },
            { role: 'user', content: `Write a product description. Input: ${JSON.stringify(payload)}` },
          ],
          temperature: 0.7,
        }),
      });
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const description = data.choices?.[0]?.message?.content?.trim() || '';
      return { output: { description, model: 'gpt-4o-mini', creditsRemaining: remaining } };
    } catch (e) {
      // Fall through to mock on error
    }
  }

  // Deterministic mock
  const description = `Premium ${title} — handcrafted, durable, designed to delight.${features ? ` Features: ${features}.` : ''}`;
  return { output: { description, mock: true, creditsRemaining: remaining } };
};
