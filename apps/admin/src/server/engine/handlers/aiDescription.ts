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

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY missing — refusing to mock in production');

  const { payload } = input;

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You write concise, persuasive Shopify product descriptions in 2-3 sentences.' },
        { role: 'user', content: `Write a product description. Input: ${JSON.stringify(payload)}` },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const description = data.choices?.[0]?.message?.content?.trim() || '';
  return { output: { description, model: 'deepseek-chat', creditsRemaining: remaining } };
};
