/**
 * ai.generate_title handler — PLANET-1059 / PLANET-1069
 * Generates product title.
 * Uses OpenAI when available, falls back to mock.
 */
import type { Handler } from './index.js';

export const aiGenerateTitleHandler: Handler = async (input, _ctx) => {
  const { payload } = input;
  const features = (payload.features as string) || (payload.description as string) || '';
  const category = (payload.category as string) || (payload.product_type as string) || '';

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
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const title = data.choices?.[0]?.message?.content?.trim() || '';
      if (title) return { output: { title, model: 'gpt-4o-mini' } };
    } catch (e) {
      console.error('[ai.generate_title] OpenAI error:', e instanceof Error ? e.message : e);
    }
  }

  // Mock fallback
  const base = category ? `${category} ` : '';
  const title = `${base}示例商品标题 · AI生成`;
  return { output: { title, mock: true } };
};
