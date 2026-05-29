import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { INVALID_COMPONENT_TYPE_ERROR } from '../apps';

const rawStorageTypeLabels = /\b(?:FRONTEND|BACKEND|FULLSTACK)\b/;

describe('TC-PC-154 apps route component type redaction', () => {
  it('keeps raw storage type labels out of apps route source and client-visible validation errors', () => {
    const source = readFileSync(new URL('../apps.ts', import.meta.url), 'utf8');

    assert.doesNotMatch(source, rawStorageTypeLabels);
    assert.doesNotMatch(INVALID_COMPONENT_TYPE_ERROR, rawStorageTypeLabels);
    assert.match(INVALID_COMPONENT_TYPE_ERROR, /page|module|component|app part/i);
  });
});
