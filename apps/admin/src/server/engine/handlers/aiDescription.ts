import type { Handler } from './index.js';
import { CREDIT_COSTS } from '../../lib/credits.js';
import { checkAndDeductCredit } from '../../lib/credit-check.js';

export const aiDescriptionHandler: Handler = async (input, ctx) => {
  const { payload } = input;

  // PLANET-1260: skip if human already provided a description (> 10 chars, not placeholder)
  const existingDesc = (payload.description as string) || '';
  if (existingDesc.trim().length > 10) {
    return { output: { description: existingDesc.trim(), skipped: true } };
  }

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

  // Whitelist short text fields only — avoid feeding base64 image data URIs etc.
  // into the LLM prompt (PLANET-1116: prior version JSON.stringify'd whole payload
  // which blew through DeepSeek 64K context window when imageUrl was a data URI).
  const promptInput: Record<string, string> = {};
  const allow = ['title', 'features', 'category', 'product_type', 'vendor', 'description', 'price', 'tags', 'sku', 'productTitle'];
  for (const k of allow) {
    const v = payload[k];
    if (typeof v === 'string' && v.length > 0 && v.length < 2000) promptInput[k] = v;
  }

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
        { role: 'user', content: `Write a product description. Input: ${JSON.stringify(promptInput)}` },
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
