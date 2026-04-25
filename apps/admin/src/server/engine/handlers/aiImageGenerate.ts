/**
 * TODO (PLANET-1201): ai.image_generate is currently MOCKED by default.
 * Real Google Imagen 4 Fast calls are disabled to prevent accidental API charges
 * (3 credits per call). To re-enable real Imagen, set env: AI_IMAGE_MOCK=0
 *
 * ai.image_generate handler — PLANET-1048 / PLANET-1115
 *
 * Calls Google Imagen 4 Fast, uploads result to Vercel Blob, returns { imageUrl }.
 *
 * Required env vars (real path only):
 *   GOOGLE_GENAI_API_KEY     — Google AI API key
 *   BLOB_READ_WRITE_TOKEN    — Vercel Blob token (optional; falls back gracefully)
 *
 * Credit cost: 3 per call (AI_IMAGE) — only charged on real path.
 */
import type { Handler } from './index.js';
import { CREDIT_COSTS } from '../../lib/credits.js';
import { checkAndDeductCredit } from '../../lib/credit-check.js';

/** Map aspectRatio string to [width, height] for picsum. */
function aspectRatioDimensions(ar: string): [number, number] {
  switch (ar) {
    case '16:9': return [1280, 720];
    case '9:16': return [720, 1280];
    case '4:3':  return [1024, 768];
    case '3:4':  return [768, 1024];
    case '1:1':
    default:     return [1024, 1024];
  }
}

/** Stable short hash of a string for picsum seed. */
function promptHash(prompt: string): string {
  return Buffer.from(prompt).toString('base64url').slice(0, 12);
}

export const aiImageGenerateHandler: Handler = async (input, ctx) => {
  const { payload } = input;

  // PLANET-1260: skip if human already provided an image URL
  const existingImage = (payload.imageUrl as string) || (payload.image_url as string) || '';
  if (existingImage.trim().length > 0 && /^https?:\/\//.test(existingImage.trim())) {
    return { output: { imageUrl: existingImage.trim(), skipped: true } };
  }

  const prompt = (payload.prompt as string) || 'A beautiful product photo';
  const aspectRatio = (payload.aspectRatio as string) || '1:1';

  // PLANET-1201: Default = mock. Set AI_IMAGE_MOCK=0 to opt into real Imagen.
  const useMock = process.env.AI_IMAGE_MOCK !== '0';

  if (useMock) {
    const [w, h] = aspectRatioDimensions(aspectRatio);
    const seed = promptHash(prompt);
    const imageUrl = `https://picsum.photos/seed/${seed}/${w}/${h}`;
    console.log(`[ai.image_generate] mock mode → ${imageUrl}`);
    return {
      output: {
        imageUrl,
        mimeType: 'image/jpeg',
        prompt,
        aspectRatio,
        model: 'mock-picsum',
        creditsRemaining: null,
      },
    };
  }

  // Real Imagen path — only runs when AI_IMAGE_MOCK=0
  const remaining = await checkAndDeductCredit(
    ctx.tenantId,
    ctx.userId,
    CREDIT_COSTS.AI_IMAGE,
    'ai_image_generate',
    { caseId: ctx.caseId },
  );

  const googleApiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!googleApiKey) throw new Error('GOOGLE_GENAI_API_KEY missing — refusing to mock in production');

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
