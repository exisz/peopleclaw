/**
 * ai.generate_title handler — PLANET-1059 (placeholder)
 *
 * Placeholder node — returns a static "功能开发中" title.
 * Full implementation pending.
 */
import type { Handler } from './index.js';

export const aiGenerateTitleHandler: Handler = async (_input, _ctx) => {
  return {
    output: {
      title: '（功能开发中）',
    },
  };
};
