/**
 * ai.generate_skus handler — PLANET-1061 (placeholder)
 *
 * Placeholder node — returns an empty skus array.
 * Full implementation pending.
 */
import type { Handler } from './index.js';

export const aiGenerateSkusHandler: Handler = async (_input, _ctx) => {
  return {
    output: {
      skus: [],
    },
  };
};
