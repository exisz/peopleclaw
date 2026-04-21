/**
 * ai.switch_image handler — PLANET-1060 (placeholder)
 *
 * Placeholder node — returns an empty imageUrl.
 * Full implementation pending.
 */
import type { Handler } from './index.js';

export const aiSwitchImageHandler: Handler = async (_input, _ctx) => {
  return {
    output: {
      imageUrl: '',
    },
  };
};
