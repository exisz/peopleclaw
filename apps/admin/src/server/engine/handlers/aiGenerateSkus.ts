/**
 * ai.generate_skus handler — PLANET-1061 / PLANET-1069
 * Generates SKU list with pricing using DeepSeek.
 */
import type { Handler } from './index.js';

export const aiGenerateSkusHandler: Handler = async (input, _ctx) => {
  const { payload } = input;

  // PLANET-1321: color_variants from attribute panel take priority — skip AI generation
  if (Array.isArray(payload.color_variants) && payload.color_variants.length > 0) {
    const skus = (payload.color_variants as Array<{color?: string; stock?: number; sku?: string}>).map((cv) => ({
      sku: cv.sku || '',
      title: `${(payload.product_name || payload.title || 'Product') as string} - ${cv.color || 'Default'}`,
      price: payload.price ?? '0.00',
      inventory_quantity: cv.stock ?? 0,
      option1: cv.color || 'Default',
    }));
    return { output: { skus, skipped: true } };
  }

  // PLANET-1260: skip if human already provided SKUs
  if (payload.skus) {
    if (Array.isArray(payload.skus) && payload.skus.length > 0) {
      return { output: { skus: payload.skus, skipped: true } };
    }
    if (typeof payload.skus === 'string' && payload.skus.trim().length > 0) {
      return { output: { skus: payload.skus, skipped: true } };
    }
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY missing — refusing to mock in production');

  const title = (payload.title as string) || (payload.product_name as string) || 'Product';
  const features = (payload.features as string) || '';

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

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${errText.slice(0, 300)}`);
  }

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

  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('DeepSeek returned no valid SKU array');
  }

  return { output: { skus: arr, model: 'deepseek-chat' } };
};
