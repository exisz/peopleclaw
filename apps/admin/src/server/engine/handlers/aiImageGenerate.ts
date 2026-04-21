/**
 * ai.image_generate handler — PLANET-1048
 *
 * Calls OpenAI gpt-image-1 (or falls back to mock), downloads the result,
 * uploads to Vercel Blob for a permanent URL, and returns { imageUrl }.
 *
 * Required env vars:
 *   OPENAI_API_KEY   — OpenAI API key
 *   BLOB_READ_WRITE_TOKEN — Vercel Blob token
 *
 * Credit cost: 3 per call (AI_IMAGE).
 */
import type { Handler } from './index.js';
import { CREDIT_COSTS } from '../../lib/credits.js';
import { checkAndDeductCredit } from '../../lib/credit-check.js';

const ASPECT_RATIO_SIZES: Record<string, '1024x1024' | '1536x1024' | '1024x1536'> = {
  '1:1': '1024x1024',
  '4:3': '1536x1024',
  '3:4': '1024x1536',
  '16:9': '1536x1024',
  '9:16': '1024x1536',
};

export const aiImageGenerateHandler: Handler = async (input, ctx) => {
  const remaining = await checkAndDeductCredit(
    ctx.tenantId,
    ctx.userId,
    CREDIT_COSTS.AI_IMAGE,
    'ai_image_generate',
    { caseId: ctx.caseId },
  );

  const { payload } = input;
  const prompt = (payload.prompt as string) || 'A beautiful product photo';
  const aspectRatio = (payload.aspectRatio as string) || '1:1';
  const referenceImageUrl = (payload.referenceImage as string) || null;
  const size = ASPECT_RATIO_SIZES[aspectRatio] ?? '1024x1024';

  // Real OpenAI path
  if (process.env.OPENAI_API_KEY) {
    try {
      const reqBody: Record<string, unknown> = {
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size,
        output_format: 'url',
      };

      // If reference image URL provided, include as input (vision-enabled models)
      if (referenceImageUrl) {
        reqBody.input = [
          {
            type: 'image_url',
            image_url: { url: referenceImageUrl },
          },
        ];
      }

      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(reqBody),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI image API ${res.status}: ${errText.slice(0, 300)}`);
      }

      const data = await res.json() as {
        data?: Array<{ url?: string; b64_json?: string }>;
      };

      const imageItem = data.data?.[0];
      if (!imageItem) throw new Error('OpenAI returned no image data');

      let permanentUrl: string;

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        // Upload to Vercel Blob for a permanent URL
        const { put } = await import('@vercel/blob');
        const filename = `ai-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

        if (imageItem.url) {
          // Download from OpenAI temp URL then re-upload
          const imgRes = await fetch(imageItem.url);
          if (!imgRes.ok) throw new Error(`Failed to fetch OpenAI image: ${imgRes.status}`);
          const blob = await imgRes.blob();
          const uploaded = await put(filename, blob, {
            access: 'public',
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          permanentUrl = uploaded.url;
        } else if (imageItem.b64_json) {
          const binary = Buffer.from(imageItem.b64_json, 'base64');
          const uploaded = await put(filename, binary, {
            access: 'public',
            contentType: 'image/png',
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          permanentUrl = uploaded.url;
        } else {
          throw new Error('No URL or b64_json in OpenAI response');
        }
      } else {
        // BLOB_READ_WRITE_TOKEN not set — return the temp URL and warn
        permanentUrl = imageItem.url ?? '';
        console.warn('[ai.image_generate] BLOB_READ_WRITE_TOKEN not set — returning temp OpenAI URL (may expire)');
      }

      return {
        output: {
          imageUrl: permanentUrl,
          prompt,
          aspectRatio,
          model: 'gpt-image-1',
          creditsRemaining: remaining,
        },
      };
    } catch (e) {
      // If OpenAI fails, fall through to mock below so workflow doesn't die in dev
      console.error('[ai.image_generate] OpenAI error:', e instanceof Error ? e.message : e);
      if (process.env.NODE_ENV === 'production') throw e;
    }
  }

  // Mock / dev fallback — return a stable placeholder image URL
  const mockUrl = `https://picsum.photos/seed/${encodeURIComponent(prompt.slice(0, 20))}/512/512`;
  return {
    output: {
      imageUrl: mockUrl,
      prompt,
      aspectRatio,
      mock: true,
      creditsRemaining: remaining,
    },
  };
};
