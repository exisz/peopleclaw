import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('TC-PC-152 frontend compiler source wording', () => {
  it('keeps raw FRONTEND runtime jargon out of compiler production comments/source', () => {
    const source = readFileSync(new URL('../frontend.ts', import.meta.url), 'utf8');
    const allowedInternalStorageConstants: string[] = [];
    const sourceWithoutAllowedConstants = allowedInternalStorageConstants.reduce(
      (text, constant) => text.replaceAll(constant, ''),
      source,
    );

    assert.doesNotMatch(sourceWithoutAllowedConstants, /\bFRONTEND\b/);
    assert.match(sourceWithoutAllowedConstants, /Browser screen compiler/);
  });
});
