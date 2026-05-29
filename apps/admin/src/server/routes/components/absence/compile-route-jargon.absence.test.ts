import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { UNSUPPORTED_COMPILE_COMPONENT_ERROR } from '../compile';

const rawStorageTypeLabels = /\b(?:FULLSTACK|FRONTEND)\b/;

describe('TC-PC-155 compile route storage type redaction', () => {
  it('preserves compile eligibility without exposing raw storage labels in route source or served errors', () => {
    const source = readFileSync(new URL('../compile.ts', import.meta.url), 'utf8');

    assert.doesNotMatch(source, rawStorageTypeLabels);
    assert.doesNotMatch(UNSUPPORTED_COMPILE_COMPONENT_ERROR, rawStorageTypeLabels);
    assert.match(source, /COMPONENT_TYPE_INTERACTIVE/);
    assert.match(source, /COMPONENT_TYPE_PAGE/);
  });
});
