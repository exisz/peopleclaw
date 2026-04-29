/**
 * ai.face_swap handler — PLANET-1372
 * Swaps the face in the user's product photo with a target face (user-provided or preset).
 * Uses Replicate API when REPLICATE_API_TOKEN is set, otherwise returns mock result.
 */
import type { Handler } from './index.js';

// Preset face library — high quality European/Western model faces (royalty-free stock)
const PRESET_FACES = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=512&h=512&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=512&h=512&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=512&h=512&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=512&h=512&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=512&h=512&fit=crop&crop=face',
];

function randomPresetFace(): string {
  return PRESET_FACES[Math.floor(Math.random() * PRESET_FACES.length)];
}

export const aiFaceSwapHandler: Handler = async (input, _ctx) => {
  const { payload } = input;

  const sourceImage = (payload.image_url as string) || (payload.imageUrl as string) || (payload.image as string);
  if (!sourceImage) {
    return {
      status: 'failed',
      output: { error: 'MissingSourceImage' },
      error: '缺少原图（image_url），请在属性中上传一张真人照片',
    };
  }

  // Target face: user-provided or random preset
  const targetFace = (payload.target_face_url as string) || randomPresetFace();

  const replicateToken = process.env.REPLICATE_API_TOKEN;

  if (!replicateToken) {
    // Mock mode — return the original image as-is with a note
    console.log('[ai.face_swap] mock mode — no REPLICATE_API_TOKEN, returning original image');
    return {
      output: {
        image_url: sourceImage,
        face_swap_status: 'mock',
        target_face_used: targetFace,
        note: 'Face swap skipped (no API token). Original image preserved.',
      },
    };
  }

  // Real mode — call Replicate API
  // Using the popular "yan-ops/face_swap" model on Replicate
  try {
    // Step 1: Create prediction
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'dd370750bfed3f9e05379913ed7a9a3e65903474ee0787c8ab557decb5c60350',  // yan-ops/face_swap
        input: {
          source_image: sourceImage,
          target_image: targetFace,
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return {
        status: 'failed',
        output: { error: 'ReplicateCreateFailed', status: createRes.status },
        error: `Replicate create prediction failed (${createRes.status}): ${errText.slice(0, 300)}`,
      };
    }

    const prediction = (await createRes.json()) as { id: string; status: string; output?: string | string[] };

    // Step 2: Poll for completion (max 60 seconds)
    const predictionId = prediction.id;
    const deadline = Date.now() + 60000;
    let result = prediction;

    while (result.status !== 'succeeded' && result.status !== 'failed' && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${replicateToken}` },
      });
      if (pollRes.ok) {
        result = (await pollRes.json()) as typeof result;
      }
    }

    if (result.status === 'failed') {
      return {
        status: 'failed',
        output: { error: 'ReplicateFaceSwapFailed' },
        error: 'Face swap model failed to process the image',
      };
    }

    if (result.status !== 'succeeded') {
      return {
        status: 'failed',
        output: { error: 'ReplicateTimeout' },
        error: 'Face swap timed out after 60 seconds',
      };
    }

    // Output is typically the swapped image URL
    const outputUrl = Array.isArray(result.output) ? result.output[0] : (result.output as string);

    return {
      output: {
        image_url: outputUrl || sourceImage,
        face_swap_status: 'success',
        target_face_used: targetFace,
        original_image: sourceImage,
      },
    };
  } catch (e) {
    return {
      status: 'failed',
      output: { error: 'ReplicateNetworkError' },
      error: `Face swap network error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
};
