/**
 * ai.generate_skus handler — PLANET-1061 / PLANET-1069
 * Generates SKU list with pricing.
 * Uses OpenAI when available, falls back to mock.
 */
import type { Handler } from './index.js';

export const aiGenerateSkusHandler: Handler = async (input, _ctx) => {
  const { payload } = input;
  const title = (payload.title as string) || (payload.product_name as string) || 'Product';
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
            {
              role: 'system',
              content:
                'Generate a JSON array of SKU variants for a Shopify product. Return ONLY valid JSON array with objects {sku, title, price, inventory_quantity}. 2-3 variants.',
            },
            {
              role: 'user',
              content: `Product: ${title}. Features: ${features}. Generate SKU variants.`,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = data.choices?.[0]?.message?.content?.trim() || '{}';
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {};
      }
      // Accept {skus:[...]} or {variants:[...]} or direct array
      const arr = Array.isArray(parsed)
        ? parsed
        : (parsed as Record<string, unknown>).skus ?? (parsed as Record<string, unknown>).variants ?? [];
      if (Array.isArray(arr) && arr.length > 0) {
        return { output: { skus: arr, model: 'gpt-4o-mini' } };
      }
    } catch (e) {
      console.error('[ai.generate_skus] OpenAI error:', e instanceof Error ? e.message : e);
    }
  }

  // Mock fallback
  const mockSkus = [
    { sku: `${title.slice(0, 6).toUpperCase().replace(/\s+/g, '-')}-S`, title: 'Small', price: '29.99', inventory_quantity: 10 },
    { sku: `${title.slice(0, 6).toUpperCase().replace(/\s+/g, '-')}-M`, title: 'Medium', price: '34.99', inventory_quantity: 15 },
    { sku: `${title.slice(0, 6).toUpperCase().replace(/\s+/g, '-')}-L`, title: 'Large', price: '39.99', inventory_quantity: 10 },
  ];
  return { output: { skus: mockSkus, mock: true } };
};
