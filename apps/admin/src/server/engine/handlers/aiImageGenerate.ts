/**
 * ai.image_generate handler — PLANET-1048 / PLANET-1115
 *
 * Calls Google Imagen 4 Fast, uploads result to Vercel Blob, returns { imageUrl }.
 *
 * Required env vars:
 *   GOOGLE_GENAI_API_KEY     — Google AI API key
 *   BLOB_READ_WRITE_TOKEN    — Vercel Blob token (optional; falls back gracefully)
 *
 * Credit cost: 3 per call (AI_IMAGE).
 */
import type { Handler } from './index.js';
import { CREDIT_COSTS } from '../../lib/credits.js';
import { checkAndDeductCredit } from '../../lib/credit-check.js';

export const aiImageGenerateHandler: Handler = async (input, ctx) => {
  const remaining = await checkAndDeductCredit(
    ctx.tenantId,
    ctx.userId,
    CREDIT_COSTS.AI_IMAGE,
    'ai_image_generate',
    { caseId: ctx.caseId },
  );

  const googleApiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!googleApiKey) throw new Error('GOOGLE_GENAI_API_KEY missing — refusing to mock in production');

  const { payload } = input;
  const prompt = (payload.prompt as string) || 'A beautiful product photo';
  const aspectRatio = (payload.aspectRatio as string) || '1:1';

  // Call Google Imagen 4 Fast
  const imagenRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${googleApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio },
      }),
    },
  );

  if (!imagenRes.ok) {
    const errText = await imagenRes.text();
    throw new Error(`Google Imagen API ${imagenRes.status}: ${errText.slice(0, 300)}`);
  }

  const imagenData = await imagenRes.json() as {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  };

  const prediction = imagenData.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error('Google Imagen returned no image data');
  }

  const b64 = prediction.bytesBase64Encoded;
  const mimeType = prediction.mimeType ?? 'image/png';
  const ext = mimeType.split('/')[1] ?? 'png';

  let imageUrl: string;

  // Method A: Vercel Blob (preferred — auto-injected in Storage-integrated projects)
  try {
    const { put } = await import('@vercel/blob');
    const filename = `ai-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const binary = Buffer.from(b64, 'base64');
    const uploaded = await put(filename, binary, {
      access: 'public',
      contentType: mimeType,
    });
    imageUrl = uploaded.url;
    console.log('[imagen]', { mode: 'blob', imageUrlLen: imageUrl.length });
  } catch (blobErr) {
    // Method B: return data URI if Blob not available
    console.warn('[ai.image_generate] Vercel Blob unavailable, returning data URI:', blobErr instanceof Error ? blobErr.message : blobErr);
    imageUrl = `data:${mimeType};base64,${b64}`;
    console.log('[imagen]', { mode: 'datauri', imageUrlLen: imageUrl.length });
  }

  return {
    output: {
      imageUrl,
      b64: imageUrl.startsWith('data:') ? b64 : undefined, // expose b64 for Shopify attachment upload when needed
      mimeType,
      prompt,
      aspectRatio,
      model: 'imagen-4.0-fast-generate-001',
      creditsRemaining: remaining,
    },
  };
};
