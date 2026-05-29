import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { UNSUPPORTED_COMPILE_COMPONENT_ERROR } from './compile';

describe('TC-PC-136 component compile public API errors', () => {
  it('uses user-safe wording instead of raw component runtime type jargon', () => {
    const forbidden = [/Component is not FULLSTACK or FRONTEND type/, /FULLSTACK/, /FRONTEND/];

    for (const pattern of forbidden) {
      assert.doesNotMatch(UNSUPPORTED_COMPILE_COMPONENT_ERROR, pattern);
    }
    assert.match(UNSUPPORTED_COMPILE_COMPONENT_ERROR, /app part|browser preview/i);

    const routeSource = readFileSync(new URL('./compile.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(routeSource, /error:\s*['"]Component is not FULLSTACK or FRONTEND type['"]/);
  });
});
