import type { Handler } from './index.js';

// Pass-through: copy initial payload into outputs so timeline is non-empty.
export const createCaseHandler: Handler = async (input) => {
  return { output: { ...input.payload, _initialized: true } };
};
