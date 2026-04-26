/**
 * ai.generate_title handler — PLANET-1059 / PLANET-1069
 * Generates product title using DeepSeek.
 */
import type { Handler } from './index.js';

export const aiGenerateTitleHandler: Handler = async (input, _ctx) => {
  const { payload } = input;

  // PLANET-1260 + PLANET-1316: skip if human already provided a title or product_name
  const existingTitle = (payload.title as string) || (payload.product_name as string) || '';
  if (existingTitle.trim().length > 0) {
    return { output: { title: existingTitle.trim(), skipped: true } };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY missing — refusing to mock in production');

  const features = (payload.features as string) || (payload.description as string) || '';
  const category = (payload.category as string) || (payload.product_type as string) || '';

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
          content:
            'You write concise, catchy Shopify product titles (5-8 words max). Respond with ONLY the title text, no quotes.',
        },
        {
          role: 'user',
          content: `Generate a product title. Features: ${features}. Category: ${category}.`,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const title = data.choices?.[0]?.message?.content?.trim() || '';
  return { output: { title, model: 'deepseek-chat' } };
};
